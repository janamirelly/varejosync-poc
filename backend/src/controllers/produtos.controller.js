const { db } = require("../db/database");

// GET /produtos
function listarProdutos(req, res) {
  const sql = `
    SELECT 
      id_produto,
      nome,
      descricao,
      ativo,
      criado_em
    FROM produto
    ORDER BY nome
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao buscar produtos" });
    }

    res.json(rows);
  });
}

// POST /produtos
function criarProduto(req, res) {
  const { nome, descricao, variacoes, preco_venda } = req.body;

  if (!nome || typeof nome !== "string" || nome.trim() === "") {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório.' });
  }

  const nomeLimpo = nome.trim();
  const descricaoLimpa =
    typeof descricao === "string" && descricao.trim() !== ""
      ? descricao.trim()
      : null;

  const listaVariacoes = Array.isArray(variacoes) ? variacoes : [];
  const precoBase = Number(preco_venda) || 0;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      `
      INSERT INTO produto (nome, descricao)
      VALUES (?, ?)
      `,
      [nomeLimpo, descricaoLimpa],
      function (err) {
        if (err) {
          console.error(err);
          db.run("ROLLBACK");
          return res.status(500).json({ erro: "Erro ao cadastrar produto" });
        }

        const idProduto = this.lastID;

        if (listaVariacoes.length === 0) {
          db.get(
            `
            SELECT id_produto, nome, descricao, ativo, criado_em
            FROM produto
            WHERE id_produto = ?
            `,
            [idProduto],
            (err2, row) => {
              if (err2) {
                console.error(err2);
                db.run("ROLLBACK");
                return res.status(500).json({
                  erro: "Produto cadastrado, mas falhou ao buscar retorno",
                });
              }

              db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                  console.error(commitErr);
                  db.run("ROLLBACK");
                  return res.status(500).json({
                    erro: "Produto cadastrado, mas falhou ao finalizar transação",
                  });
                }

                return res.status(201).json({
                  ...row,
                  variacoes: [],
                });
              });
            },
          );

          return;
        }

        let restante = listaVariacoes.length;
        let falhou = false;

        listaVariacoes.forEach((variacao) => {
          const cor =
            typeof variacao.cor === "string" ? variacao.cor.trim() : "";
          const tamanho =
            typeof variacao.tamanho === "string" ? variacao.tamanho.trim() : "";
          const sku =
            typeof variacao.sku === "string" ? variacao.sku.trim() : "";

          if (!cor || !tamanho || !sku) {
            falhou = true;
            db.run("ROLLBACK");
            return res.status(400).json({
              erro: "Cada variação deve possuir cor, tamanho e sku.",
            });
          }

          db.run(
            `
            INSERT INTO variacao_produto
              (id_produto, cor, tamanho, sku, preco)
            VALUES (?, ?, ?, ?, ?)
            `,
            [idProduto, cor, tamanho, sku, precoBase],
            (errVar) => {
              if (falhou) return;

              if (errVar) {
                falhou = true;
                console.error(errVar);
                db.run("ROLLBACK");

                if (String(errVar.message || "").includes("UNIQUE")) {
                  return res.status(400).json({
                    erro: `SKU já cadastrado: ${sku}`,
                  });
                }

                return res.status(500).json({
                  erro: "Erro ao cadastrar variações do produto",
                });
              }

              restante -= 1;

              if (restante === 0 && !falhou) {
                db.all(
                  `
                  SELECT
                    id_variacao,
                    id_produto,
                    cor,
                    tamanho,
                    sku,
                    preco,
                    ativo,
                    criado_em
                  FROM variacao_produto
                  WHERE id_produto = ?
                  ORDER BY id_variacao
                  `,
                  [idProduto],
                  (err3, variacoesCriadas) => {
                    if (err3) {
                      console.error(err3);
                      db.run("ROLLBACK");
                      return res.status(500).json({
                        erro: "Produto cadastrado, mas falhou ao buscar variações",
                      });
                    }

                    db.get(
                      `
                      SELECT id_produto, nome, descricao, ativo, criado_em
                      FROM produto
                      WHERE id_produto = ?
                      `,
                      [idProduto],
                      (err4, produtoCriado) => {
                        if (err4) {
                          console.error(err4);
                          db.run("ROLLBACK");
                          return res.status(500).json({
                            erro: "Produto cadastrado, mas falhou ao buscar retorno",
                          });
                        }

                        db.run("COMMIT", (commitErr) => {
                          if (commitErr) {
                            console.error(commitErr);
                            db.run("ROLLBACK");
                            return res.status(500).json({
                              erro: "Produto cadastrado, mas falhou ao finalizar transação",
                            });
                          }

                          return res.status(201).json({
                            ...produtoCriado,
                            variacoes: variacoesCriadas,
                          });
                        });
                      },
                    );
                  },
                );
              }
            },
          );
        });
      },
    );
  });
}

module.exports = {
  listarProdutos,
  criarProduto,
};
