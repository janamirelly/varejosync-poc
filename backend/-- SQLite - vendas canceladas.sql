-- SQLite
SELECT id_venda, status, total, id_usuario 
FROM venda WHERE id_venda = 5;

--Venda virou CANCELADA/estoque voltou
SELECT iv.id_variacao, e.quantidade
FROM item_venda iv
JOIN estoque e ON e.id_variacao = iv.id_variacao
WHERE iv.id_venda = 5;

--Movimentação ENTRADA do estorno:
SELECT tipo, quantidade, observacao, id_usuario
FROM vw_movimentacao_detalhada
WHERE observacao LIKE 'Estorno Venda #5%'
ORDER BY criado_em DESC;

--auditoria
SELECT acao, recurso, id_usuario, criado_em
FROM auditoria
ORDER BY criado_em DESC
LIMIT 10;

