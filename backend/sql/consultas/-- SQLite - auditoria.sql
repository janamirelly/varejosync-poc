-- SQLite
SELECT
  a.criado_em,
  a.acao,
  a.recurso,
  a.id_usuario,
  u.nome AS usuario
FROM auditoria a
LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
ORDER BY a.criado_em DESC
LIMIT 30;

SELECT COUNT(*) AS total FROM auditoria;

PRAGMA database_list;

SELECT name
FROM sqlite_master
WHERE type='table' AND name='auditoria';

SELECT id_auditoria, acao, recurso, id_usuario, criado_em
FROM auditoria
ORDER BY id_auditoria DESC
LIMIT 20;

SELECT name FROM sqlite_master 
WHERE type='table' AND name='auditoria';
