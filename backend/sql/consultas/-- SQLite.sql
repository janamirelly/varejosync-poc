-- SQLite
SELECT p.id_produto, p.nome, 
vp.id_variacao, 
vp.sku, vp.cor, vp.tamanho
FROM produto p
JOIN variacao_produto vp 
ON vp.id_produto = p.id_produto
LIMIT 10;


SELECT id_variacao, quantidade, estoque_min
FROM estoque
LIMIT 10;

SELECT id_venda, id_usuario, status, forma_pagamento, total, criado_em
FROM venda
LIMIT 10;

SELECT *
FROM documento_fiscal
LIMIT 10;

SELECT id_item, id_venda, id_variacao, quantidade, subtotal
FROM item_venda
LIMIT 10;