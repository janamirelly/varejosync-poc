const { db } = require("../db/database");

const { registrarAuditoria } = require("../utils/auditoria");

// Garantir que exista um registro em estoque para a variação
function garantirEstoque(idVariacao, callback) {
  const sqlCheck = `SELECT id_estoque FROM estoque WHERE id_variacao = ?`;

  db.get(sqlCheck, [idVariacao], (err, row) => {
    if (err) return callback(err);

    if (row) return callback(null, row.id_estoque);

    const sqlInsert = `
      INSERT INTO estoque (id_variacao, quantidade)
      VALUES (?, 0)
    `;

    db.run(sqlInsert, [idVariacao], function (err2) {
      if (err2) return callback(err2);
      return callback(null, this.lastID);
    });
  });
}

// GET /estoque/:id_variacao

function consultarEstoque(req, res) {
  const { id_variacao } = req.params;

  garantirEstoque(id_variacao, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao garantir estoque" });
    }

    const sql = `
      SELECT 
        e.id_estoque,
        e.id_variacao,
        e.quantidade,
        e.estoque_min,
        e.atualizado_em
      FROM estoque e
      WHERE e.id_variacao = ?
    `;

    db.get(sql, [id_variacao], (err2, row) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ erro: "Erro ao consultar estoque" });
      }
      res.json(row);
    });
  });
}

// POST /estoque/movimentacoes
function registrarMovimentacao(req, res) {
  const { id_variacao, tipo, quantidade, observacao } = req.body;

  if (!id_variacao || !tipo || !quantidade) {
    return res
      .status(400)
      .json({ erro: "id_variacao, tipo e quantidade são obrigatórios." });
  }

  const tipoNorm = String(tipo).toUpperCase();
  const qtd = Number(quantidade);

  if (!["ENTRADA", "SAIDA", "AJUSTE"].includes(tipoNorm)) {
    return res
      .status(400)
      .json({ erro: "Tipo inválido. Use ENTRADA, SAIDA ou AJUSTE." });
  }

  if (!Number.isFinite(qtd) || qtd <= 0) {
    return res
      .status(400)
      .json({ erro: "Quantidade deve ser um número maior que zero." });
  }

  garantirEstoque(id_variacao, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao garantir estoque" });
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // 1) Buscar estoque atual
      db.get(
        `SELECT quantidade FROM estoque WHERE id_variacao = ?`,
        [id_variacao],
        (err2, row) => {
          if (err2) {
            db.run("ROLLBACK");
            console.error(err2);
            return res
              .status(500)
              .json({ erro: "Erro ao buscar estoque atual" });
          }

          const atual = row?.quantidade ?? 0;
          let novaQuantidade = atual;

          if (tipoNorm === "ENTRADA") novaQuantidade = atual + qtd;
          if (tipoNorm === "SAIDA") novaQuantidade = atual - qtd;
          if (tipoNorm === "AJUSTE") novaQuantidade = qtd;

          if (novaQuantidade < 0) {
            db.run("ROLLBACK");
            return res
              .status(400)
              .json({ erro: "Estoque insuficiente para saída." });
          }

          // 2) Registrar movimentação
          const id_usuario = req.user?.id_usuario ?? null;
          const sqlMov = `
            INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
            VALUES (?, ?, ?, ?, ?)
          `;

          db.run(
            sqlMov,
            [id_variacao, tipoNorm, qtd, observacao ?? null, id_usuario],
            function (err3) {
              if (err3) {
                db.run("ROLLBACK");
                console.error(err3);
                return res
                  .status(500)
                  .json({ erro: "Erro ao registrar movimentação" });
              }

              const idMov = this.lastID;

              // 3) Atualizar estoque
              const sqlUpd = `
                UPDATE estoque
                SET quantidade = ?, atualizado_em = datetime('now')
                WHERE id_variacao = ?
              `;

              db.run(sqlUpd, [novaQuantidade, id_variacao], (err4) => {
                if (err4) {
                  db.run("ROLLBACK");
                  console.error(err4);
                  return res.status(500).json({
                    erro: "Movimentação registrada, mas falhou ao atualizar estoque",
                  });
                }

                db.run("COMMIT");

                return res.status(201).json({
                  id_movimentacao: idMov,
                  id_variacao: Number(id_variacao),
                  tipo: tipoNorm,
                  quantidade: qtd,
                  estoque_anterior: atual,
                  estoque_atual: novaQuantidade,
                });
              });
            },
          );
        },
      );
    });
  });
}

function atualizarEstoqueMinimo(req, res) {
  const { id_variacao } = req.params;
  const { estoque_min } = req.body;

  const min = Number(estoque_min);

  if (!Number.isFinite(min) || min < 0) {
    return res
      .status(400)
      .json({ erro: "estoque_min deve ser um número >= 0." });
  }

  garantirEstoque(id_variacao, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao garantir estoque" });
    }

    db.run(
      `UPDATE estoque
       SET estoque_min = ?, atualizado_em = datetime('now')
       WHERE id_variacao = ?`,
      [min, id_variacao],
      function (err2) {
        if (err2) {
          console.error(err2);
          return res
            .status(500)
            .json({ erro: "Erro ao atualizar estoque mínimo" });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            erro: "Nenhum registro de estoque encontrado para a variação informada.",
          });
        }

        db.get(
          `SELECT id_variacao, estoque_min
           FROM estoque
           WHERE id_variacao = ?`,
          [id_variacao],
          (err3, row) => {
            if (err3) {
              console.error(err3);
              return res.status(500).json({
                erro: "Estoque mínimo atualizado, mas falhou ao consultar retorno.",
              });
            }

            return res.json({
              id_variacao: Number(row.id_variacao),
              estoque_min: Number(row.estoque_min),
            });
          },
        );
      },
    );
  });
}

// GET /estoque  (lista completa com JOIN)
function listarEstoqueDetalhado(req, res) {
  const { q, cor, tamanho, status } = req.query;

  const filtros = [];
  const params = [];

  if (q) {
    filtros.push("produto LIKE ?");
    params.push(`%${q}%`);
  }
  if (cor) {
    filtros.push("cor = ?");
    params.push(String(cor));
  }
  if (tamanho) {
    filtros.push("tamanho = ?");
    params.push(String(tamanho));
  }
  if (status) {
    filtros.push("status = ?");
    params.push(String(status).toUpperCase());
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const sql = `
    SELECT *
    FROM vw_estoque_detalhado
    ${where}
    ORDER BY
      produto,
      cor,
      CASE tamanho
        WHEN 'P'  THEN 1
        WHEN 'M'  THEN 2
        WHEN 'G'  THEN 3
        WHEN 'GG' THEN 4
        ELSE 99
      END
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("[SQLITE]", err.message, err);

      return res.status(500).json({ erro: "Erro ao listar estoque" });
    }

    registrarAuditoria({
      id_usuario: req.user?.id_usuario ?? null,
      acao: "CONSULTAR_ESTOQUE",
      recurso: req.originalUrl,
      detalhes: JSON.stringify({ query: req.query }),
      ip: req.ip,
      user_agent: req.headers["user-agent"] ?? null,
    }).catch((e) => console.error("[AUDITORIA] falhou:", e.message));

    return res.json(rows);
  });
}

function listarAbaixoMinimoPorVariacao(req, res) {
  const sql = `
    SELECT
      id_variacao,
      id_produto,
      produto,
      cor,
      tamanho,
      quantidade AS estoque_atual,
      estoque_min AS estoque_minimo,
      (estoque_min - quantidade) AS faltam,
      status
    FROM vw_estoque_detalhado
    WHERE quantidade < estoque_min
    ORDER BY
      faltam DESC,
      produto,
      cor,
      CASE tamanho
        WHEN 'PP' THEN 0
        WHEN 'P'  THEN 1
        WHEN 'M'  THEN 2
        WHEN 'G'  THEN 3
        WHEN 'GG' THEN 4
        WHEN 'XG' THEN 5
        ELSE 99
      END
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("[SQLITE]", err.message, err);
      return res
        .status(500)
        .json({ erro: "Erro ao listar variações abaixo do mínimo" });
    }

    const resultado = rows.map((r) => ({
      id_variacao: r.id_variacao,
      id_produto: r.id_produto,
      produto: r.produto,
      cor: r.cor,
      tamanho: r.tamanho,
      variacao: [r.cor, r.tamanho].filter(Boolean).join(" / ") || "—",
      estoque_atual: Number(r.estoque_atual ?? 0),
      estoque_minimo: Number(r.estoque_minimo ?? 0),
      faltam: Number(r.faltam ?? 0),
      status: r.status,
    }));

    registrarAuditoria({
      id_usuario: req.user?.id_usuario ?? null,
      acao: "CONSULTAR_ESTOQUE_ABAIXO_MINIMO",
      recurso: req.originalUrl,
      detalhes: JSON.stringify({ total: resultado.length }),
      ip: req.ip,
      user_agent: req.headers["user-agent"] ?? null,
    }).catch((e) => console.error("[AUDITORIA] falhou:", e.message));

    return res.json(resultado);
  });
}

// GET /produtos/:id/estoque  (estoque por produto)
// GET /produtos/:id/estoque
function listarEstoquePorProduto(req, res) {
  const { id } = req.params;

  db.all(
    `SELECT *
     FROM vw_estoque_detalhado
     WHERE id_produto = ?
     ORDER BY
       cor,
       CASE tamanho
         WHEN 'P'  THEN 1
         WHEN 'M'  THEN 2
         WHEN 'G'  THEN 3
         WHEN 'GG' THEN 4
         ELSE 99
       END`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("[SQLITE]", err.message, err);

        return res
          .status(500)
          .json({ erro: "Erro ao listar estoque do produto" });
      }

      registrarAuditoria({
        id_usuario: req.user?.id_usuario ?? null,
        acao: "CONSULTAR_ESTOQUE_PRODUTO",
        recurso: req.originalUrl,
        detalhes: JSON.stringify({ params: req.params, query: req.query }),
        ip: req.ip,
        user_agent: req.headers["user-agent"] ?? null,
      }).catch((e) => console.error("[AUDITORIA] falhou:", e.message));

      return res.json(rows);
    },
  );
}

module.exports = {
  consultarEstoque,
  registrarMovimentacao,
  atualizarEstoqueMinimo,
  listarEstoqueDetalhado,
  listarEstoquePorProduto,
  listarAbaixoMinimoPorVariacao,
};
