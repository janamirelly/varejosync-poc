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
    const resumo_0701 = await all(`
      SELECT
       p.id_produto AS id_produto,
       p.nome AS produto,
       SUM(iv.quantidade) AS unidades,
       ROUND(SUM(iv.subtotal), 2) AS receita
     FROM item_venda iv
     JOIN variacao_produto vp
     ON vp.id_variacao = iv.id_variacao
     JOIN produto p
     ON p.id_produto = vp.id_produto
     JOIN venda v
    ON v.id_venda = iv.id_venda
    WHERE v.status = 'CONCLUIDA'
      AND datetime(v.criado_em) >= datetime('now', '-7 day', 'localtime')
   GROUP BY p.id_produto, p.nome
   ORDER BY unidades DESC, receita DESC
   LIMIT 5;
`);

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
        resumo_0701,
        estoque_por_produto,
        criticos_por_produto,
        abaixo_min_por_produto,
        formas_pagamento_7dias,
        produtos_mais_vendidos_24h,
      },
    });
  } catch (err) {
    console.error("[DASHBOARD] erro:", err);
    console.error(err);
    return res.status(500).json({ erro: "Erro ao montar dashboard" });
  }
}

async function obterDashboardPdv(req, res) {
  try {
    const resumo =
      (await get(`
      SELECT
        COUNT(DISTINCT v.id_venda) AS vendas_dia,
        ROUND(COALESCE(SUM(iv.subtotal), 0), 2) AS faturamento_dia,
        ROUND(
          COALESCE(SUM(iv.subtotal), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
          2
        ) AS ticket_medio,
        COUNT(DISTINCT CASE WHEN v.status = 'CONCLUIDA' THEN v.id_venda END) AS vendas_finalizadas
      FROM venda v
      LEFT JOIN item_venda iv
        ON iv.id_venda = v.id_venda
      WHERE date(v.criado_em) = date('now')
    `)) || {};

    const ultimas_vendas = await all(`
      SELECT
        v.id_venda,
        ROUND(COALESCE(SUM(iv.subtotal), 0), 2) AS valor_total,
        v.status,
        v.criado_em
      FROM venda v
      LEFT JOIN item_venda iv
        ON iv.id_venda = v.id_venda
      GROUP BY v.id_venda, v.status, v.criado_em
      ORDER BY datetime(v.criado_em) DESC
      LIMIT 3
    `);

    const produtos_mais_vendidos = await all(`
  SELECT
    p.nome AS produto,
    vp.sku AS sku,
    SUM(iv.quantidade) AS unidades
  FROM item_venda iv
  JOIN variacao_produto vp
    ON vp.id_variacao = iv.id_variacao
  JOIN produto p
    ON p.id_produto = vp.id_produto
  JOIN venda v
    ON v.id_venda = iv.id_venda
  WHERE v.status = 'CONCLUIDA'
  GROUP BY p.nome, vp.sku
  ORDER BY unidades DESC, produto
  LIMIT 3
`);

    const faturamento_semana =
      (await get(`
  SELECT
    ROUND(COALESCE(SUM(iv.subtotal), 0), 2) AS faturamento_semana,
    ROUND(
      COALESCE(SUM(iv.subtotal), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
      2
    ) AS ticket_medio_semana
  FROM venda v
  LEFT JOIN item_venda iv
    ON iv.id_venda = v.id_venda
  WHERE v.status = 'CONCLUIDA'
    AND datetime(v.criado_em) >= datetime('now', '-7 day')
`)) || {};

    const produtos_semana = await all(`
  SELECT
    p.nome AS produto,
    SUM(iv.quantidade) AS unidades
  FROM item_venda iv
  JOIN variacao_produto vp
    ON vp.id_variacao = iv.id_variacao
  JOIN produto p
    ON p.id_produto = vp.id_produto
  JOIN venda v
    ON v.id_venda = iv.id_venda
  WHERE v.status = 'CONCLUIDA'
    AND datetime(v.criado_em) >= datetime('now', '-7 day')
  GROUP BY p.nome
  ORDER BY unidades DESC, p.nome
  LIMIT 3
`);

    return res.json({
      resumo: {
        vendas_dia: Number(resumo.vendas_dia || 0),
        faturamento_dia: Number(resumo.faturamento_dia || 0),
        ticket_medio: Number(resumo.ticket_medio || 0),
        vendas_finalizadas: Number(resumo.vendas_finalizadas || 0),
      },
      ultimas_vendas: ultimas_vendas || [],
      produtos_mais_vendidos: produtos_mais_vendidos || [],
      faturamento_semana: {
        valor: Number(faturamento_semana.faturamento_semana || 0),

        ticket_medio: Number(faturamento_semana.ticket_medio_semana || 0),
      },
      produtos_semana: produtos_semana || [],
    });
  } catch (err) {
    console.error("[DASHBOARD PDV] erro:", err);
    return res.status(500).json({ erro: "Erro ao montar dashboard do PDV" });
  }
}

module.exports = {
  obterDashboard,
  obterDashboardPdv,
};
