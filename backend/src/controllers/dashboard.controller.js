const { db } = require("../db/database");

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function obterDashboard(req, res) {
  try {
    const cards = (await get(`SELECT * FROM vw_dashboard_resumo`)) || {};

    const estoque_por_produto = await all(`
      SELECT * FROM vw_dashboard_estoque_por_produto
      ORDER BY produto
    `);

    const criticos_por_produto = await all(`
      SELECT * FROM vw_dashboard_criticos_por_produto
      ORDER BY itens_criticos DESC, produto
    `);

    const abaixo_min_por_produto = await all(`
     SELECT * FROM vw_dashboard_estoque_abaixo_min_por_produto
    `);

    const formas_pagamento_7dias = await all(`
      SELECT * FROM vw_dashboard_formas_pagamento_7dias
      ORDER BY total DESC
    `);

    const produtos_mais_vendidos_24h = await all(`
      SELECT * FROM vw_dashboard_produtos_mais_vendidos_24h
      ORDER BY unidades DESC, receita DESC
      LIMIT 5
    `);

    return res.json({
      cards: {
        estoque_total: Number(cards.estoque_total || 0),
        itens_criticos: Number(cards.itens_criticos || 0),
        pedidos_hoje: Number(cards.pedidos_hoje || 0),
        faturamento_7dias: Number(cards.faturamento_7dias || 0),
        ticket_medio_7dias: Number(cards.ticket_medio_7dias || 0),
        pedidos_7dias: Number(cards.pedidos_7dias || 0),
        ultima_sincronizacao: cards.ultima_sincronizacao || null,
      },
      breakdowns: {
        estoque_por_produto,
        criticos_por_produto,
        abaixo_min_por_produto,
        formas_pagamento_7dias,
        produtos_mais_vendidos_24h,
      },
    });
  } catch (err) {
    console.error("[DASHBOARD] erro:", err);
    return res.status(500).json({ erro: "Erro ao montar dashboard" });
  }
}

module.exports = {
  obterDashboard,
};
