-- SQLite
SELECT mov_tipo, mov_observacao, mov_usuario_nome
FROM vw_relatorio_rastreabilidade_venda
WHERE id_venda = 5
ORDER BY mov_criado_em DESC;


SELECT
  v.id_venda,
  v.status,
  v.forma_pagamento,
  v.total,
  SUM(CASE WHEN me.tipo='SAIDA'   THEN 1 ELSE 0 END) AS qtd_saida,
  SUM(CASE WHEN me.tipo='ENTRADA' THEN 1 ELSE 0 END) AS qtd_entrada
FROM venda v
LEFT JOIN item_venda iv ON iv.id_venda = v.id_venda
LEFT JOIN movimentacao_estoque me
  ON me.id_variacao = iv.id_variacao
 AND (
      me.observacao = ('Venda #' || v.id_venda)
   OR me.observacao LIKE ('Estorno Venda #' || v.id_venda || '%')
   OR me.observacao LIKE ('Devolução Venda #' || v.id_venda || '%')
 )
WHERE v.id_venda IN (15, 16)
GROUP BY v.id_venda, v.status, v.forma_pagamento, v.total;
SELECT
  p.id_produto,
  p.nome AS produto,
  v.id_variacao,
  v.sku,
  v.cor,
  v.tamanho,
  v.preco,
  v.ativo
FROM produto p
JOIN variacao_produto v ON v.id_produto = p.id_produto
ORDER BY p.id_produto, v.id_variacao;

SELECT sku, COUNT(*) qtd
FROM variacao_produto
GROUP BY sku
HAVING COUNT(*) > 1;

SELECT id_variacao, sku, preco
FROM variacao_produto
WHERE preco <= 0;


SELECT e.*
FROM estoque e
LEFT JOIN variacao_produto v ON v.id_variacao = e.id_variacao
WHERE v.id_variacao IS NULL;

SELECT
  id_auditoria,
  criado_em,
  id_usuario,
  acao,
  recurso
FROM auditoria
ORDER BY id_auditoria DESC
LIMIT 15;
