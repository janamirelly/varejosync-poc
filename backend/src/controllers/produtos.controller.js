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
  const { nome, descricao } = req.body;

  if (!nome || typeof nome !== "string" || nome.trim() === "") {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório.' });
  }

  const nomeLimpo = nome.trim();
  const descricaoLimpa =
    typeof descricao === "string" ? descricao.trim() : null;

  const sql = `
    INSERT INTO produto (nome, descricao)
    VALUES (?, ?)
  `;

  db.run(sql, [nomeLimpo, descricaoLimpa], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao cadastrar produto" });
    }

    // this.lastID é o id gerado pelo SQLite
    const idNovo = this.lastID;

    db.get(
      `
      SELECT id_produto, nome, descricao, ativo, criado_em
      FROM produto
      WHERE id_produto = ?
      `,
      [idNovo],
      (err2, row) => {
        if (err2) {
          console.error(err2);
          return res
            .status(500)
            .json({ erro: "Produto cadastrado, mas falhou ao buscar retorno" });
        }

        return res.status(201).json(row);
      },
    );
  });
}

module.exports = {
  listarProdutos,
  criarProduto,
};
