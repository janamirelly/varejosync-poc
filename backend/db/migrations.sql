PRAGMA foreign_keys = ON;

-- =========================================================
-- VIEWS: Estoque detalhado
-- =========================================================
DROP VIEW IF EXISTS vw_estoque_detalhado;

CREATE VIEW vw_estoque_detalhado AS
SELECT
  p.id_produto,
  p.nome AS produto,
  v.id_variacao,
  v.cor,
  v.tamanho,
  v.sku,
  v.preco,
  COALESCE(e.quantidade, 0) AS quantidade,
  COALESCE(e.estoque_min, 10) AS estoque_min,
  e.atualizado_em,
  CASE
    WHEN COALESCE(e.quantidade, 0) <= 0 THEN 'ESGOTADO'
    WHEN COALESCE(e.quantidade, 0) <= CAST(COALESCE(e.estoque_min, 10) * 0.3 AS INT) THEN 'CRITICO'
    WHEN COALESCE(e.quantidade, 0) <= COALESCE(e.estoque_min, 10) THEN 'ATENCAO'
    ELSE 'DISPONIVEL'
  END AS status
FROM variacao_produto v
JOIN produto p ON p.id_produto = v.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao;

-- =========================================================
-- VIEW: Dashboard Resumo
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_resumo;

CREATE VIEW vw_dashboard_resumo AS
WITH
params AS (
  SELECT
    date('now')                 AS hoje,
    date('now','-6 days')       AS inicio7dias,
    datetime('now','-24 hours') AS inicio24h
),
estoque_total AS (
  SELECT COALESCE(SUM(quantidade), 0) AS estoque_total
  FROM estoque
),
itens_criticos AS (
  SELECT COUNT(*) AS itens_criticos
  FROM vw_estoque_detalhado
  WHERE status IN ('CRITICO','ESGOTADO')
),
pedidos_hoje AS (
  SELECT COUNT(*) AS pedidos_hoje
  FROM venda, params
  WHERE status = 'CONCLUIDA'
    AND date(criado_em) = params.hoje
),
faturamento_7dias AS (
  SELECT
    COALESCE(SUM(total), 0) AS faturamento_7dias,
    COALESCE(AVG(total), 0) AS ticket_medio_7dias,
    COALESCE(COUNT(*), 0)   AS pedidos_7dias
  FROM venda, params
  WHERE status = 'CONCLUIDA'
    AND date(criado_em) BETWEEN params.inicio7dias AND params.hoje
),
ultima_sinc AS (
  SELECT MAX(dt) AS ultima_sincronizacao
  FROM (
    SELECT MAX(atualizado_em) AS dt FROM estoque
    UNION ALL
    SELECT MAX(criado_em)     AS dt FROM movimentacao_estoque
    UNION ALL
    SELECT MAX(criado_em)     AS dt FROM venda
  )
)
SELECT
  estoque_total.estoque_total,
  itens_criticos.itens_criticos,
  pedidos_hoje.pedidos_hoje,
  faturamento_7dias.faturamento_7dias,
  faturamento_7dias.ticket_medio_7dias,
  faturamento_7dias.pedidos_7dias,
  ultima_sinc.ultima_sincronizacao
FROM estoque_total
CROSS JOIN itens_criticos
CROSS JOIN pedidos_hoje
CROSS JOIN faturamento_7dias
CROSS JOIN ultima_sinc;

-- =========================================================
-- VIEW: Dashboard estoque por produto
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_estoque_por_produto;

CREATE VIEW vw_dashboard_estoque_por_produto AS
SELECT
  p.id_produto,
  p.nome AS produto,
  COALESCE(SUM(e.quantidade), 0) AS quantidade_total
FROM produto p
JOIN variacao_produto v ON v.id_produto = p.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
GROUP BY p.id_produto, p.nome;

-- =========================================================
-- VIEW: Dashboard críticos por produto
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_criticos_por_produto;

CREATE VIEW vw_dashboard_criticos_por_produto AS
SELECT
  id_produto,
  produto,
  COUNT(*) AS itens_criticos
FROM vw_estoque_detalhado
WHERE status IN ('CRITICO','ESGOTADO','ATENCAO')
GROUP BY id_produto, produto;

-- =========================================================
-- VIEW: Estoque abaixo do mínimo por produto
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_estoque_abaixo_min_por_produto;

CREATE VIEW vw_dashboard_estoque_abaixo_min_por_produto AS
SELECT
  p.id_produto,
  p.nome AS produto,
  SUM(
    CASE
      WHEN COALESCE(e.quantidade, 0) < COALESCE(e.estoque_min, 10) THEN 1
      ELSE 0
    END
  ) AS variacoes_abaixo_min,
  SUM(
    CASE
      WHEN COALESCE(e.quantidade, 0) < COALESCE(e.estoque_min, 10)
      THEN (COALESCE(e.estoque_min, 10) - COALESCE(e.quantidade, 0))
      ELSE 0
    END
  ) AS unidades_faltantes
FROM produto p
JOIN variacao_produto v ON v.id_produto = p.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
GROUP BY p.id_produto, p.nome
ORDER BY unidades_faltantes DESC, variacoes_abaixo_min DESC, produto;

-- =========================================================
-- VIEW: Formas de pagamento (7 dias)
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_formas_pagamento_7dias;

CREATE VIEW vw_dashboard_formas_pagamento_7dias AS
WITH params AS (
  SELECT date('now') AS hoje, date('now','-6 days') AS inicio7dias
)
SELECT
  forma_pagamento,
  COUNT(*) AS quantidade,
  COALESCE(SUM(total), 0) AS total
FROM venda, params
WHERE status = 'CONCLUIDA'
  AND date(criado_em) BETWEEN params.inicio7dias AND params.hoje
GROUP BY forma_pagamento;

-- =========================================================
-- VIEW: Produtos mais vendidos (24h)
-- =========================================================
DROP VIEW IF EXISTS vw_dashboard_produtos_mais_vendidos_24h;

CREATE VIEW vw_dashboard_produtos_mais_vendidos_24h AS
WITH params AS (
  SELECT datetime('now','-24 hours') AS inicio24h
)
SELECT
  p.id_produto,
  p.nome AS produto,
  COALESCE(SUM(iv.quantidade), 0) AS unidades,
  COALESCE(SUM(iv.subtotal), 0) AS receita
FROM item_venda iv
JOIN venda ve ON ve.id_venda = iv.id_venda
JOIN variacao_produto v ON v.id_variacao = iv.id_variacao
JOIN produto p ON p.id_produto = v.id_produto
JOIN params ON 1=1
WHERE ve.status = 'CONCLUIDA'
  AND ve.criado_em >= params.inicio24h
GROUP BY p.id_produto, p.nome;

-- =========================================================
-- VIEW: Movimentação detalhada
-- =========================================================
DROP VIEW IF EXISTS vw_movimentacao_detalhada;

CREATE VIEW vw_movimentacao_detalhada AS
SELECT
  me.id_movimentacao,
  me.criado_em,
  me.tipo,
  me.quantidade,
  me.observacao,
  me.id_variacao,
  u.id_usuario,
  u.nome  AS usuario_nome,
  u.email AS usuario_email,
  p.nome  AS perfil,

  CASE
    WHEN lower(u.email) = 'system@varejosync.com' THEN 'SISTEMA'
    ELSE 'USUARIO'
  END AS origem

FROM movimentacao_estoque me
LEFT JOIN usuario u ON u.id_usuario = me.id_usuario
LEFT JOIN perfil  p ON p.id_perfil = u.id_perfil;

-- =========================================================
-- RELATÓRIO 1: Vendas por período (com status)
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_vendas_periodo;

CREATE VIEW vw_relatorio_vendas_periodo AS
SELECT
  date(v.criado_em) AS dia,
  v.status,
  COUNT(*)          AS qtd_vendas,
  COALESCE(SUM(v.total), 0) AS total
FROM venda v
GROUP BY date(v.criado_em), v.status;

-- =========================================================
-- VENDIDO POR VARIAÇÃO
-- =========================================================
DROP VIEW IF EXISTS vw_vendido_por_variacao;

CREATE VIEW vw_vendido_por_variacao AS
SELECT
  iv.id_variacao,
  SUM(iv.quantidade) AS qtd_vendida
FROM item_venda iv
JOIN venda v ON v.id_venda = iv.id_venda
WHERE v.status = 'CONCLUIDA'
GROUP BY iv.id_variacao;

-- =========================================================
-- VARIAÇÕES MAIS VENDIDAS 7 DIAS
-- =========================================================

DROP VIEW IF EXISTS vw_dashboard_variacoes_mais_vendidas_7dias;

CREATE VIEW vw_dashboard_variacoes_mais_vendidas_7dias AS
WITH params AS (
  SELECT date('now') AS hoje, date('now','-6 days') AS inicio7dias
)
SELECT
  vp.id_variacao,
  p.nome AS produto,
  vp.cor,
  vp.tamanho,
  vp.sku,
  SUM(iv.quantidade) AS unidades,
  ROUND(SUM(iv.subtotal),2) AS receita
FROM item_venda iv
JOIN venda v ON v.id_venda = iv.id_venda
JOIN variacao_produto vp ON vp.id_variacao = iv.id_variacao
JOIN produto p ON p.id_produto = vp.id_produto
JOIN params ON 1=1
WHERE v.status='CONCLUIDA'
  AND date(v.criado_em) BETWEEN params.inicio7dias AND params.hoje
GROUP BY vp.id_variacao, p.nome, vp.cor, vp.tamanho, vp.sku
ORDER BY unidades DESC, receita DESC;

-- =========================================================
-- RELATÓRIO 2: Produtos mais vendidos (por dia)
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_top_produtos_dia;

CREATE VIEW vw_relatorio_top_produtos_dia AS
SELECT
  date(ve.criado_em) AS dia,
  p.id_produto,
  p.nome AS produto,
  SUM(iv.quantidade) AS unidades,
  SUM(iv.subtotal)   AS receita
FROM item_venda iv
JOIN venda ve ON ve.id_venda = iv.id_venda
JOIN variacao_produto v ON v.id_variacao = iv.id_variacao
JOIN produto p ON p.id_produto = v.id_produto
WHERE ve.status = 'CONCLUIDA'
GROUP BY date(ve.criado_em), p.id_produto, p.nome;

-- =========================================================
-- RELATÓRIO 3: Movimentações por dia + usuário
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_mov_usuario_dia;

CREATE VIEW vw_relatorio_mov_usuario_dia AS
SELECT
  date(me.criado_em) AS dia,
  me.tipo,
  CASE
    WHEN lower(u.email) = 'system@varejosync.com' THEN 'SISTEMA'
    WHEN me.observacao LIKE 'Venda #%'
      OR me.observacao LIKE 'Estorno Venda #%'
      OR me.observacao LIKE 'Devolução Venda #%'
      THEN 'PDV (VENDAS)'
    ELSE 'ESTOQUE (MANUAL)'
  END AS origem,
  u.id_usuario,
  u.nome  AS usuario_nome,
  p.nome  AS perfil,
  COUNT(*) AS qtd_mov,
  SUM(me.quantidade) AS total_quantidade
FROM movimentacao_estoque me
LEFT JOIN usuario u ON u.id_usuario = me.id_usuario
LEFT JOIN perfil  p ON p.id_perfil = u.id_perfil
GROUP BY
  date(me.criado_em),
  me.tipo,
  origem,
  u.id_usuario,
  u.nome,
  p.nome;

-- =========================================================
-- AUDITORIA (tabela + índices)
-- =========================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario   INTEGER,
  acao         TEXT NOT NULL,
  recurso      TEXT NOT NULL,
  detalhes     TEXT,
  ip           TEXT,
  user_agent   TEXT,
  criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(id_usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao    ON auditoria(acao);

-- =========================================================
-- VIEW: Rastreabilidade completa (Venda + Itens + Movimentos + Usuário)
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_rastreabilidade_venda;

CREATE VIEW vw_relatorio_rastreabilidade_venda AS
SELECT
  v.id_venda,
  v.criado_em              AS venda_criado_em,
  v.status                 AS venda_status,
  v.forma_pagamento,
  v.total                  AS total_final,
  COALESCE(v.total_bruto, v.total) AS total_bruto,
  COALESCE(v.desconto_total, 0)    AS desconto_total,
  uv.id_usuario            AS venda_id_usuario,
  uv.nome                  AS venda_usuario_nome,
  pv.nome                  AS venda_usuario_perfil,
  iv.id_item,
  iv.id_variacao,
  iv.quantidade            AS item_quantidade,
  iv.preco_unit            AS preco_unit_final,
  iv.subtotal              AS subtotal_final,
  COALESCE(iv.preco_unit_original, iv.preco_unit) AS preco_unit_original,
  COALESCE(iv.desconto_percent, 0)                AS desconto_percent,
  COALESCE(iv.desconto_valor, 0)                  AS desconto_valor,
  iv.motivo_desconto                              AS motivo_desconto,
  p.id_produto,
  p.nome                   AS produto,
  vp.cor,
  vp.tamanho,
  vp.sku,
  me.id_movimentacao,
  me.criado_em             AS mov_criado_em,
  me.tipo                  AS mov_tipo,
  me.quantidade            AS mov_quantidade,
  me.observacao            AS mov_observacao,
  um.id_usuario            AS mov_id_usuario,
  um.nome                  AS mov_usuario_nome,
  pm.nome                  AS mov_usuario_perfil
FROM venda v
LEFT JOIN usuario uv ON uv.id_usuario = v.id_usuario
LEFT JOIN perfil  pv ON pv.id_perfil  = uv.id_perfil
JOIN item_venda iv        ON iv.id_venda     = v.id_venda
JOIN variacao_produto vp  ON vp.id_variacao  = iv.id_variacao
JOIN produto p            ON p.id_produto    = vp.id_produto
LEFT JOIN movimentacao_estoque me
  ON me.id_variacao = iv.id_variacao
 AND (
      me.observacao = ('Venda #' || v.id_venda)
   OR me.observacao LIKE ('Estorno Venda #'   || v.id_venda || '%')
   OR me.observacao LIKE ('Devolução Venda #' || v.id_venda || '%')
 )
LEFT JOIN usuario um ON um.id_usuario = me.id_usuario
LEFT JOIN perfil  pm ON pm.id_perfil  = um.id_perfil;

-- =========================================================
-- VIEW: Fechamento de Caixa (por dia)
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_fechamento_caixa_dia;

CREATE VIEW vw_relatorio_fechamento_caixa_dia AS
SELECT
  date(criado_em) AS dia,
  SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS qtd_concluidas,
  ROUND(SUM(CASE WHEN status = 'CONCLUIDA' THEN total ELSE 0 END), 2) AS total_concluidas,
  CASE
    WHEN SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) > 0
    THEN ROUND(
      SUM(CASE WHEN status = 'CONCLUIDA' THEN total ELSE 0 END)
      / SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END),
      2
    )
    ELSE 0
  END AS ticket_medio,
  SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) AS qtd_canceladas,
  ROUND(SUM(CASE WHEN status = 'CANCELADA' THEN total ELSE 0 END), 2) AS total_canceladas,
  SUM(CASE WHEN status = 'DEVOLVIDA' THEN 1 ELSE 0 END) AS qtd_devolvidas,
  ROUND(SUM(CASE WHEN status = 'DEVOLVIDA' THEN total ELSE 0 END), 2) AS total_devolvidas,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='DINHEIRO' THEN total ELSE 0 END), 2) AS total_dinheiro,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='CREDITO'  THEN total ELSE 0 END), 2) AS total_credito,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='DEBITO'   THEN total ELSE 0 END), 2) AS total_debito,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='PIX'      THEN total ELSE 0 END), 2) AS total_pix,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='OUTRO'    THEN total ELSE 0 END), 2) AS total_outro
FROM venda
GROUP BY date(criado_em);

-- =========================================================
-- VIEW: Fiscal por período
-- =========================================================
DROP VIEW IF EXISTS vw_relatorio_fiscal_periodo;

CREATE VIEW vw_relatorio_fiscal_periodo AS
SELECT
  date(df.emitido_em) AS dia,
  df.status,
  COUNT(*) AS qtd_documentos,
  COALESCE(SUM(df.valor_total), 0) AS total
FROM documento_fiscal df
GROUP BY date(df.emitido_em), df.status;

-- =========================================================
-- MIGRATION: DESCONTOS / PROMOÇÕES (backfill)
-- =========================================================
UPDATE item_venda
SET preco_unit_original = preco_unit
WHERE preco_unit_original IS NULL;

UPDATE venda
SET total_bruto = total
WHERE total_bruto = 0;

UPDATE venda
SET desconto_total = 0
WHERE desconto_total IS NULL;