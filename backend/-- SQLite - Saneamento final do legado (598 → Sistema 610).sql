-- SQLite
-- descobrir o ID do usuário Sistema
SELECT id_usuario FROM usuario WHERE email='system@varejosync.com';

-- corrigir vendas antigas com 598 (ajuste o número se houver outros)
UPDATE venda
SET id_usuario = (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com')
WHERE id_usuario = 598;

UPDATE movimentacao_estoque
SET id_usuario = (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com')
WHERE id_usuario = 598;

--validando
SELECT COUNT(*) AS vendas_598 FROM venda WHERE id_usuario = 598;
SELECT COUNT(*) AS mov_598   FROM movimentacao_estoque WHERE id_usuario = 598;
