-- SQLite
--estoque baixou
SELECT id_variacao, quantidade
FROM estoque
WHERE id_variacao = 2;

--movimentação criada
SELECT *
FROM vw_movimentacao_detalhada
ORDER BY criado_em DESC
LIMIT 5;

--venda registrada com usuario
SELECT id_venda, id_usuario, total, criado_em
FROM venda
ORDER BY criado_em DESC
LIMIT 5;
