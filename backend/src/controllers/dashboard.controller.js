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
    const cards =
      (await get(`
    WITH params AS (
      SELECT
        date('now', 'localtime') AS hoje,
        date('now', 'localtime', '-6 days') AS inicio_7dias
    ),
    resumo_vendas AS (
  SELECT
    COUNT(DISTINCT v.id_venda) AS pedidos_dia,
    ROUND(COALESCE(SUM(v.total), 0), 2) AS faturamento_dia,
    ROUND(
      COALESCE(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
      2
    ) AS ticket_medio_dia
  FROM venda v
  JOIN params ON 1=1
  WHERE v.status = 'CONCLUIDA'
    AND date(datetime(v.criado_em, 'localtime')) = params.hoje
),
    resumo_estoque AS (
      SELECT
        COALESCE(SUM(quantidade), 0) AS estoque_total
      FROM estoque
    ),
    resumo_criticos AS (
      SELECT
        COUNT(*) AS itens_criticos
      FROM vw_estoque_detalhado
      WHERE status IN ('CRITICO', 'ESGOTADO')
    ),
    resumo_sync AS (
      SELECT
        MAX(dt) AS ultima_sincronizacao
      FROM (
        SELECT MAX(atualizado_em) AS dt FROM estoque
        UNION ALL
        SELECT MAX(criado_em) AS dt FROM movimentacao_estoque
        UNION ALL
        SELECT MAX(criado_em) AS dt FROM venda
      )
    )
    SELECT
      re.estoque_total,
      rc.itens_criticos,
      rv.pedidos_dia,
      rv.faturamento_dia,
      rv.ticket_medio_dia,
      rs.ultima_sincronizacao
    FROM resumo_vendas rv
    CROSS JOIN resumo_estoque re
    CROSS JOIN resumo_criticos rc
    CROSS JOIN resumo_sync rs
  `)) || {};
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

    const formas_pagamento_dia = await all(`
  SELECT
    v.forma_pagamento,
    COUNT(*) AS quantidade,
    ROUND(COALESCE(SUM(v.total), 0), 2) AS total
  FROM venda v
  WHERE v.status = 'CONCLUIDA'
    AND date(datetime(v.criado_em, 'localtime')) = date('now', 'localtime')
  GROUP BY v.forma_pagamento
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
        pedidos_dia: Number(cards.pedidos_dia || 0),
        faturamento_dia: Number(cards.faturamento_dia || 0),
        ticket_medio_dia: Number(cards.ticket_medio_dia || 0),
        ultima_sincronizacao: cards.ultima_sincronizacao || null,
      },
      breakdowns: {
        resumo_0701,
        estoque_por_produto,
        criticos_por_produto,
        abaixo_min_por_produto,
        formas_pagamento_dia,
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
      ROUND(COALESCE(SUM(v.total), 0), 2) AS faturamento_dia,
      ROUND(
        COALESCE(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
        2
      ) AS ticket_medio,
      COUNT(DISTINCT v.id_venda) AS vendas_finalizadas
    FROM venda v
    WHERE v.status = 'CONCLUIDA'
      AND date(datetime(v.criado_em, 'localtime')) = date('now', 'localtime')
  `)) || {};

    const ultimas_vendas = await all(`
      SELECT
        v.id_venda,
        ROUND(COALESCE(v.total, 0), 2) AS valor_total,
        v.status,
        datetime(v.criado_em, 'localtime') AS criado_em
      FROM venda v
      WHERE v.status = 'CONCLUIDA'
      ORDER BY datetime(v.criado_em, 'localtime') DESC
      LIMIT 3
    `);

    const produtos_mais_vendidos_dia = await all(`
      SELECT
        p.nome AS produto,
        MIN(vp.sku) AS sku,
        SUM(iv.quantidade) AS unidades
      FROM item_venda iv
      JOIN variacao_produto vp
        ON vp.id_variacao = iv.id_variacao
      JOIN produto p
        ON p.id_produto = vp.id_produto
      JOIN venda v
        ON v.id_venda = iv.id_venda
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) = date('now', 'localtime')
      GROUP BY p.id_produto, p.nome
      ORDER BY unidades DESC, produto
      LIMIT 3
    `);

    const variacoes_vendidas_dia = await all(`
      SELECT
        p.nome AS produto,
        vp.sku AS sku,
        vp.cor AS cor,
        vp.tamanho AS tamanho,
        SUM(iv.quantidade) AS unidades
      FROM item_venda iv
      JOIN variacao_produto vp
        ON vp.id_variacao = iv.id_variacao
      JOIN produto p
        ON p.id_produto = vp.id_produto
      JOIN venda v
        ON v.id_venda = iv.id_venda
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) = date('now', 'localtime')
      GROUP BY vp.id_variacao, p.nome, vp.sku, vp.cor, vp.tamanho
      ORDER BY unidades DESC, produto
      LIMIT 10
    `);

    const faturamento_semana =
      (await get(`
    WITH params AS (
      SELECT
        date('now', 'localtime') AS hoje,
        date('now', 'localtime', '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days') AS inicio_semana
    )
    SELECT
      ROUND(COALESCE(SUM(v.total), 0), 2) AS faturamento_semana,
      ROUND(
        COALESCE(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
        2
      ) AS ticket_medio_semana
    FROM venda v
    JOIN params ON 1=1
    WHERE v.status = 'CONCLUIDA'
      AND date(datetime(v.criado_em, 'localtime')) BETWEEN params.inicio_semana AND params.hoje
  `)) || {};

    const comparativo_semana =
      (await get(`
    WITH params AS (
      SELECT
        date('now', 'localtime') AS hoje,
        date('now', 'localtime', '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days') AS inicio_semana_atual
    ),
    atual AS (
      SELECT COALESCE(SUM(v.total), 0) AS valor
      FROM venda v
      JOIN params ON 1=1
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) BETWEEN params.inicio_semana_atual AND params.hoje
    ),
    anterior AS (
      SELECT COALESCE(SUM(v.total), 0) AS valor
      FROM venda v
      JOIN params ON 1=1
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) >= date(params.inicio_semana_atual, '-7 days')
        AND date(datetime(v.criado_em, 'localtime')) < params.inicio_semana_atual
    )
    SELECT
      ROUND(atual.valor, 2) AS valor_atual,
      ROUND(anterior.valor, 2) AS valor_anterior,
      CASE
        WHEN anterior.valor > 0
          THEN ROUND(((atual.valor - anterior.valor) * 100.0) / anterior.valor, 2)
        WHEN atual.valor > 0
          THEN 100
        ELSE 0
      END AS variacao_percentual
    FROM atual, anterior
  `)) || {};

    const produtos_semana = await all(`
      WITH params AS (
        SELECT
          date('now', 'localtime') AS hoje,
          date('now', 'localtime', '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days') AS inicio_semana
      )
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
      JOIN params ON 1=1
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) BETWEEN params.inicio_semana AND params.hoje
      GROUP BY p.nome
      ORDER BY unidades DESC, p.nome
      LIMIT 3
    `);

    const grafico_semana = await all(`
      WITH params AS (
        SELECT
          date('now', 'localtime') AS hoje,
          date('now', 'localtime', '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days') AS inicio_semana
      )
      SELECT
        date(datetime(v.criado_em, 'localtime')) AS dia,
        ROUND(COALESCE(SUM(v.total), 0), 2) AS valor
      FROM venda v
      JOIN params ON 1=1
      WHERE v.status = 'CONCLUIDA'
        AND date(datetime(v.criado_em, 'localtime')) BETWEEN params.inicio_semana AND params.hoje
      GROUP BY date(datetime(v.criado_em, 'localtime'))
      ORDER BY dia
    `);

    const avisos = {};

    const reposicao_necessaria = (await get(`
      SELECT COUNT(*) AS qtd
      FROM vw_estoque_detalhado
      WHERE status IN ('ATENCAO', 'CRITICO', 'ESGOTADO')
    `)) || { qtd: 0 };

    const pendencias_sistema = (await get(`
      SELECT COUNT(*) AS qtd
      FROM venda
      WHERE status IN ('CANCELADA', 'DEVOLVIDA')
        AND date(datetime(criado_em, 'localtime')) = date('now', 'localtime')
    `)) || { qtd: 0 };

    avisos.reposicao_necessaria = Number(reposicao_necessaria.qtd || 0);
    avisos.pendencias_sistema = Number(pendencias_sistema.qtd || 0);

    return res.json({
      resumo: {
        vendas_dia: Number(resumo.vendas_dia || 0),
        faturamento_dia: Number(resumo.faturamento_dia || 0),
        ticket_medio: Number(resumo.ticket_medio || 0),
        vendas_finalizadas: Number(resumo.vendas_finalizadas || 0),
      },
      ultimas_vendas: ultimas_vendas || [],
      produtos_mais_vendidos_dia: produtos_mais_vendidos_dia || [],
      variacoes_vendidas_dia: variacoes_vendidas_dia || [],
      produtos_mais_vendidos: produtos_mais_vendidos_dia || [],
      faturamento_semana: {
        valor: Number(faturamento_semana.faturamento_semana || 0),
        ticket_medio: Number(faturamento_semana.ticket_medio_semana || 0),
        variacao_percentual: Number(
          comparativo_semana.variacao_percentual || 0,
        ),
        valor_anterior: Number(comparativo_semana.valor_anterior || 0),
      },
      produtos_semana: produtos_semana || [],
      grafico_semana: grafico_semana || [],
      avisos,
    });
  } catch (err) {
    console.error("[DASHBOARD PDV] erro:", err);
    return res.status(500).json({ erro: "Erro ao montar dashboard do PDV" });
  }
}

async function obterFaturamentoAnalitico(req, res) {
  try {
    const periodo = String(req.query.periodo || "mensal").toLowerCase();
    const referencia = String(req.query.referencia || "").trim();

    const periodosValidos = ["diario", "semanal", "mensal", "anual"];
    if (!periodosValidos.includes(periodo)) {
      return res.status(400).json({
        erro: "periodo inválido. Use: diario, semanal, mensal ou anual.",
      });
    }

    let sqlAtual = "";
    let sqlAnterior = "";
    let paramsAtual = [];
    let paramsAnterior = [];
    let rotuloAtual = "";
    let rotuloAnterior = "";

    let sqlTopProdutos = "";
    let sqlTopVariacoes = "";
    let paramsTopProdutos = [];
    let paramsTopVariacoes = [];

    if (periodo === "diario") {
      const ref = referencia || new Date().toISOString().slice(0, 10);

      sqlAtual = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND date(datetime(criado_em, 'localtime')) = date(?)
      `;
      paramsAtual = [ref];

      sqlAnterior = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND date(datetime(criado_em, 'localtime')) = date(?, '-1 day')
      `;
      paramsAnterior = [ref];

      sqlTopProdutos = `
        SELECT
          p.nome AS produto,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) = date(?)
        GROUP BY p.id_produto, p.nome
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopProdutos = [ref];

      sqlTopVariacoes = `
        SELECT
          p.nome AS produto,
          vp.sku,
          vp.cor,
          vp.tamanho,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) = date(?)
        GROUP BY vp.id_variacao, p.nome, vp.sku, vp.cor, vp.tamanho
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopVariacoes = [ref];

      rotuloAtual = ref;
      rotuloAnterior = "Dia anterior";
    }

    if (periodo === "semanal") {
      const ref = referencia || new Date().toISOString().slice(0, 10);

      sqlAtual = `
        WITH base AS (
          SELECT
            date(?) AS data_ref,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days') AS inicio_periodo,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days', '+6 days') AS fim_periodo
        )
        SELECT
          COUNT(DISTINCT v.id_venda) AS pedidos,
          ROUND(COALESCE(SUM(v.total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda v
        JOIN base b ON 1=1
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) BETWEEN b.inicio_periodo AND b.fim_periodo
      `;
      paramsAtual = [ref, ref, ref, ref, ref];

      sqlAnterior = `
        WITH base AS (
          SELECT
            date(?) AS data_ref,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days', '-7 days') AS inicio_periodo,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days', '-1 day') AS fim_periodo
        )
        SELECT
          COUNT(DISTINCT v.id_venda) AS pedidos,
          ROUND(COALESCE(SUM(v.total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda v
        JOIN base b ON 1=1
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) BETWEEN b.inicio_periodo AND b.fim_periodo
      `;
      paramsAnterior = [ref, ref, ref, ref, ref];

      sqlTopProdutos = `
        WITH base AS (
          SELECT
            date(?) AS data_ref,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days') AS inicio_periodo,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days', '+6 days') AS fim_periodo
        )
        SELECT
          p.nome AS produto,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        JOIN base b ON 1=1
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) BETWEEN b.inicio_periodo AND b.fim_periodo
        GROUP BY p.id_produto, p.nome
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopProdutos = [ref, ref, ref, ref, ref];

      sqlTopVariacoes = `
        WITH base AS (
          SELECT
            date(?) AS data_ref,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days') AS inicio_periodo,
            date(?, '-' || ((strftime('%w', ?) + 6) % 7) || ' days', '+6 days') AS fim_periodo
        )
        SELECT
          p.nome AS produto,
          vp.sku,
          vp.cor,
          vp.tamanho,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        JOIN base b ON 1=1
        WHERE v.status = 'CONCLUIDA'
          AND date(datetime(v.criado_em, 'localtime')) BETWEEN b.inicio_periodo AND b.fim_periodo
        GROUP BY vp.id_variacao, p.nome, vp.sku, vp.cor, vp.tamanho
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopVariacoes = [ref, ref, ref, ref, ref];

      rotuloAtual = "Semana selecionada";
      rotuloAnterior = "Semana anterior";
    }

    if (periodo === "mensal") {
      const ref = referencia || new Date().toISOString().slice(0, 7);

      sqlAtual = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND strftime('%Y-%m', datetime(criado_em, 'localtime')) = ?
      `;
      paramsAtual = [ref];

      sqlAnterior = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND strftime('%Y-%m', datetime(criado_em, 'localtime')) =
              strftime('%Y-%m', date(? || '-01', '-1 month'))
      `;
      paramsAnterior = [ref];

      sqlTopProdutos = `
        SELECT
          p.nome AS produto,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND strftime('%Y-%m', datetime(v.criado_em, 'localtime')) = ?
        GROUP BY p.id_produto, p.nome
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopProdutos = [ref];

      sqlTopVariacoes = `
        SELECT
          p.nome AS produto,
          vp.sku,
          vp.cor,
          vp.tamanho,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND strftime('%Y-%m', datetime(v.criado_em, 'localtime')) = ?
        GROUP BY vp.id_variacao, p.nome, vp.sku, vp.cor, vp.tamanho
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopVariacoes = [ref];

      rotuloAtual = ref;
      rotuloAnterior = "Mês anterior";
    }

    if (periodo === "anual") {
      const ref = referencia || String(new Date().getFullYear());

      sqlAtual = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND strftime('%Y', datetime(criado_em, 'localtime')) = ?
      `;
      paramsAtual = [ref];

      sqlAnterior = `
        SELECT
          COUNT(DISTINCT id_venda) AS pedidos,
          ROUND(COALESCE(SUM(total), 0), 2) AS faturamento,
          ROUND(
            COALESCE(SUM(total), 0) / NULLIF(COUNT(DISTINCT id_venda), 0),
            2
          ) AS ticket_medio
        FROM venda
        WHERE status = 'CONCLUIDA'
          AND strftime('%Y', datetime(criado_em, 'localtime')) = CAST(? AS INTEGER) - 1
      `;
      paramsAnterior = [ref];

      sqlTopProdutos = `
        SELECT
          p.nome AS produto,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND strftime('%Y', datetime(v.criado_em, 'localtime')) = ?
        GROUP BY p.id_produto, p.nome
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopProdutos = [ref];

      sqlTopVariacoes = `
        SELECT
          p.nome AS produto,
          vp.sku,
          vp.cor,
          vp.tamanho,
          SUM(iv.quantidade) AS unidades,
          ROUND(SUM(iv.subtotal), 2) AS receita
        FROM item_venda iv
        JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
        JOIN produto p ON p.id_produto = vp.id_produto
        JOIN venda v ON v.id_venda = iv.id_venda
        WHERE v.status = 'CONCLUIDA'
          AND strftime('%Y', datetime(v.criado_em, 'localtime')) = ?
        GROUP BY vp.id_variacao, p.nome, vp.sku, vp.cor, vp.tamanho
        ORDER BY receita DESC, unidades DESC
        LIMIT 3
      `;
      paramsTopVariacoes = [ref];

      rotuloAtual = ref;
      rotuloAnterior = "Ano anterior";
    }

    const atual = (await get(sqlAtual, paramsAtual)) || {};
    const anterior = (await get(sqlAnterior, paramsAnterior)) || {};
    const top_produtos = (await all(sqlTopProdutos, paramsTopProdutos)) || [];
    const top_variacoes =
      (await all(sqlTopVariacoes, paramsTopVariacoes)) || [];

    const faturamentoAtual = Number(atual.faturamento || 0);
    const faturamentoAnterior = Number(anterior.faturamento || 0);

    let variacaoPercentual = 0;
    if (faturamentoAnterior > 0) {
      variacaoPercentual = Number(
        (
          ((faturamentoAtual - faturamentoAnterior) * 100) /
          faturamentoAnterior
        ).toFixed(2),
      );
    } else if (faturamentoAtual > 0) {
      variacaoPercentual = 100;
    }

    return res.json({
      periodo,
      referencia,
      atual: {
        rotulo: rotuloAtual,
        faturamento: faturamentoAtual,
        pedidos: Number(atual.pedidos || 0),
        ticket_medio: Number(atual.ticket_medio || 0),
      },
      anterior: {
        rotulo: rotuloAnterior,
        faturamento: faturamentoAnterior,
        pedidos: Number(anterior.pedidos || 0),
        ticket_medio: Number(anterior.ticket_medio || 0),
      },
      variacao_percentual: variacaoPercentual,
      top_produtos,
      top_variacoes,
    });
  } catch (err) {
    console.error("[DASHBOARD FATURAMENTO] erro:", err);
    return res.status(500).json({
      erro: "Erro ao montar faturamento analítico.",
    });
  }
}

module.exports = {
  obterDashboard,
  obterDashboardPdv,
  obterFaturamentoAnalitico,
};
