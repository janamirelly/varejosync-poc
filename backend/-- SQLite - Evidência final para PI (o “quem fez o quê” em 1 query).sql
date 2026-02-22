-- SQLite
SELECT
  me.criado_em,
  me.tipo,
  me.quantidade,
  me.observacao,
  me.id_variacao,
  COALESCE(u.nome, 'Sistema/Legado') AS responsavel
FROM movimentacao_estoque me
LEFT JOIN usuario u ON u.id_usuario = me.id_usuario
ORDER BY me.criado_em DESC
LIMIT 20;

--Evidência final para PI 
--(o “quem fez o quê” em 1 query)

SELECT
  id_venda,
  venda_status,
  produto,
  sku,
  item_quantidade,
  mov_tipo,
  mov_quantidade,
  mov_observacao,
  venda_usuario_nome,
  mov_usuario_nome
FROM vw_relatorio_rastreabilidade_venda
WHERE id_venda = 5
ORDER BY id_item, mov_criado_em DESC;
