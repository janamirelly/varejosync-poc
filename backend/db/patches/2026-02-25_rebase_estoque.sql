PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- 1) Base do estoque (copie do seed: é a "referência do card")
DROP TABLE IF EXISTS tmp_estoque_base;
CREATE TEMP TABLE tmp_estoque_base (
  id_variacao INTEGER PRIMARY KEY,
  qtd_base    INTEGER NOT NULL
);

INSERT INTO tmp_estoque_base (id_variacao, qtd_base) VALUES
(1,5),(2,5),(3,5),(4,5),
(5,5),(6,5),(7,1),(8,4),
(9,5),(10,5),(11,5),(12,5),
(13,4),(14,4),(15,4),(16,4),
(17,4),(18,4),(19,4),(20,4),
(21,5),(22,5),(23,5),(24,5),
(25,10),(26,11),(27,11),(28,10);

-- 2) Vendido por variação (somente vendas CONCLUIDA)
DROP TABLE IF EXISTS tmp_vendido;
CREATE TEMP TABLE tmp_vendido AS
SELECT
  iv.id_variacao,
  SUM(iv.quantidade) AS qtd_vendida
FROM item_venda iv
JOIN venda v ON v.id_venda = iv.id_venda
WHERE v.status = 'CONCLUIDA'
GROUP BY iv.id_variacao;

-- 3) Calcula novo estoque (base - vendido), sem negativo
DROP TABLE IF EXISTS tmp_novo_estoque;
CREATE TEMP TABLE tmp_novo_estoque AS
SELECT
  b.id_variacao,
  b.qtd_base,
  COALESCE(vd.qtd_vendida, 0) AS qtd_vendida,
  CASE
    WHEN (b.qtd_base - COALESCE(vd.qtd_vendida, 0)) < 0 THEN 0
    ELSE (b.qtd_base - COALESCE(vd.qtd_vendida, 0))
  END AS qtd_nova
FROM tmp_estoque_base b
LEFT JOIN tmp_vendido vd ON vd.id_variacao = b.id_variacao;

-- 4) Garante linha de estoque para todas variações
INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min)
SELECT id_variacao, 0, 4 FROM tmp_estoque_base;

-- 5) Registra AJUSTE (diferença entre atual e novo)
INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
SELECT
  e.id_variacao,
  'AJUSTE',
  ABS(e.quantidade - n.qtd_nova) AS quantidade,
  'Patch PI: rebase estoque (base - vendas CONCLUIDAS) para coerência do dashboard.',
  (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
FROM estoque e
JOIN tmp_novo_estoque n ON n.id_variacao = e.id_variacao
WHERE e.quantidade <> n.qtd_nova;

-- 6) Aplica novo estoque
UPDATE estoque
SET quantidade = (SELECT qtd_nova FROM tmp_novo_estoque n WHERE n.id_variacao = estoque.id_variacao),
    atualizado_em = datetime('now')
WHERE id_variacao IN (SELECT id_variacao FROM tmp_novo_estoque);

COMMIT;