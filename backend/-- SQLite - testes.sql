-- SQLite
SELECT tipo, quantidade, observacao, id_usuario, usuario_nome, perfil
FROM vw_movimentacao_detalhada
ORDER BY criado_em DESC
LIMIT 5;

SELECT acao, recurso, id_usuario, criado_em
FROM auditoria
ORDER BY criado_em DESC
LIMIT 10;

--correção de caracteres
UPDATE movimentacao_estoque
SET observacao = 'Reposição autorizada (Estoquista)'
WHERE observacao LIKE '%Reposi%';

