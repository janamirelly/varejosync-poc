const { db } = require("../db/database");

// POST /produtos/:id/variacoes
function criarVariacao(req, res) {
  const { id } = req.params;
  const { cor, tamanho, sku, preco } = req.body;

  if (!cor || !tamanho || !sku || preco == null) {
    return res
      .status(400)
      .json({ erro: "Cor, tamanho, SKU e preco são obrigatórios." });
  }

  const p = Number(preco);
  if (!Number.isFinite(p) || p < 0) {
    return res.status(400).json({ erro: "preco deve ser um número >= 0." });
  }

  const sql = `
    INSERT INTO variacao_produto (id_produto, cor, tamanho, sku, preco)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [id, cor, tamanho, sku, p], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao cadastrar variação." });
    }

    res.status(201).json({
      id_variacao: this.lastID,
      id_produto: id,
      cor,
      tamanho,
      sku,
      preco: p,
    });
  });
}

// GET /produtos/:id/variacoes
function listarVariacoes(req, res) {
  const { id } = req.params;

  const sql = `
    SELECT 
      id_variacao,
      cor,
      tamanho,
      sku,
      preco,
      ativo
    FROM variacao_produto
    WHERE id_produto = ?
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao buscar variações." });
    }

    res.json(rows);
  });
}

function criarVariacoesEmLote(req, res) {
  const { id } = req.params;
  const { cores, tamanhos, preco, sku_prefix } = req.body;

  if (
    !Array.isArray(cores) ||
    cores.length === 0 ||
    !Array.isArray(tamanhos) ||
    tamanhos.length === 0
  ) {
    return res
      .status(400)
      .json({ erro: "cores e tamanhos (arrays) são obrigatórios." });
  }

  const p = Number(preco);
  if (!Number.isFinite(p) || p < 0) {
    return res.status(400).json({ erro: "preco deve ser um número >= 0." });
  }

  const prefix = String(sku_prefix || "SKU")
    .trim()
    .toUpperCase();
  if (!prefix) {
    return res.status(400).json({ erro: "sku_prefix inválido." });
  }

  const normalizar = (s) => String(s).trim();
  const normSkuPart = (s) => normalizar(s).toUpperCase().replace(/\s+/g, "-");

  const combinacoes = [];
  for (const cor of cores) {
    for (const tamanho of tamanhos) {
      const c = normalizar(cor);
      const t = normalizar(tamanho);
      if (!c || !t) continue;

      const sku = `${prefix}-${normSkuPart(c)}-${normSkuPart(t)}`;
      combinacoes.push({ cor: c, tamanho: t, sku });
    }
  }

  if (combinacoes.length === 0) {
    return res.status(400).json({ erro: "Nenhuma combinação válida gerada." });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    let inseridos = 0;
    let ignorados = 0;

    const inserirProximo = (i) => {
      if (i >= combinacoes.length) {
        db.run("COMMIT");
        return res.status(201).json({
          id_produto: Number(id),
          preco: p,
          total_combinacoes: combinacoes.length,
          inseridos,
          ignorados,
        });
      }

      const { cor, tamanho, sku } = combinacoes[i];

      const sql = `
        INSERT OR IGNORE INTO variacao_produto (id_produto, cor, tamanho, sku, preco)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.run(sql, [id, cor, tamanho, sku, p], function (err) {
        if (err) {
          db.run("ROLLBACK");
          console.error(err);
          return res
            .status(500)
            .json({ erro: "Erro ao criar variações em lote." });
        }

        if (this.changes === 1) inseridos += 1;
        else ignorados += 1;

        inserirProximo(i + 1);
      });
    };

    inserirProximo(0);
  });
}

module.exports = {
  criarVariacao,
  listarVariacoes,
  criarVariacoesEmLote,
};
