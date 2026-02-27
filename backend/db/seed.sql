PRAGMA foreign_keys = ON;

-- =========================================================
-- 1) PERFIS
-- =========================================================
INSERT OR IGNORE INTO perfil (nome) VALUES ('Gerente de Operações');
INSERT OR IGNORE INTO perfil (nome) VALUES ('Estoquista');
INSERT OR IGNORE INTO perfil (nome) VALUES ('Vendedora');

-- =========================================================
-- 2) USUÁRIOS (inclui SISTEMA)
-- =========================================================
INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'João Almeida', 'gerente@varejosync.com', id_perfil
FROM perfil WHERE nome='Gerente de Operações';

INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'Marcos Lima', 'estoque@varejosync.com', id_perfil
FROM perfil WHERE nome='Estoquista';

INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'Ana Paula', 'vendas@varejosync.com', id_perfil
FROM perfil WHERE nome='Vendedora';

-- Usuário Sistema (essencial)
INSERT OR IGNORE INTO usuario (nome, email, id_perfil, ativo)
SELECT 'Sistema', 'system@varejosync.com', id_perfil, 1
FROM perfil WHERE nome='Gerente de Operações';

-- =========================================================
-- 3) GUARD (falha com mensagem clara se Sistema não existir)
-- (depende da tabela auditoria existir no migrations.sql)
-- =========================================================
INSERT INTO auditoria (id_usuario, acao, recurso, detalhes)
SELECT
  (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1),
  'SEED_GUARD',
  'seed.sql',
  'OK: usuario Sistema encontrado'
WHERE (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1) IS NOT NULL;

INSERT INTO auditoria (id_usuario, acao, recurso, detalhes)
SELECT
  NULL,
  'SEED_ERROR',
  'seed.sql',
  'ERRO: usuario Sistema (system@varejosync.com) nao encontrado. Verifique inserts de PERFIL/USUARIO.'
WHERE (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1) IS NULL;

-- =========================================================
-- 4) PRODUTOS
-- =========================================================
INSERT OR IGNORE INTO produto (id_produto, nome, descricao, ativo) VALUES
(1, 'Camiseta Básica', 'Camiseta básica em algodão (PI)', 1),
(2, 'Vestido Midi',    'Vestido midi casual (PI)',        1),
(3, 'Calça Jeans',     'Calça jeans skinny (PI)',         1);

-- =========================================================
-- 5) VARIAÇÕES (IDs fixos 1..28)
-- =========================================================
-- Camiseta Básica (12)
INSERT OR IGNORE INTO variacao_produto (id_variacao, id_produto, cor, tamanho, sku, preco, ativo) VALUES
(1,  1, 'BRANCO', 'P',  'CAM-BRANCO-P',  59.90, 1),
(2,  1, 'BRANCO', 'M',  'CAM-BRANCO-M',  59.90, 1),
(3,  1, 'BRANCO', 'G',  'CAM-BRANCO-G',  59.90, 1),
(4,  1, 'BRANCO', 'GG', 'CAM-BRANCO-GG', 59.90, 1),
(5,  1, 'PRETO',  'P',  'CAM-PRETO-P',   59.90, 1),
(6,  1, 'PRETO',  'M',  'CAM-PRETO-M',   59.90, 1),
(7,  1, 'PRETO',  'G',  'CAM-PRETO-G',   59.90, 1),
(8,  1, 'PRETO',  'GG', 'CAM-PRETO-GG',  59.90, 1),
(9,  1, 'AZUL',   'P',  'CAM-AZUL-P',    59.90, 1),
(10, 1, 'AZUL',   'M',  'CAM-AZUL-M',    59.90, 1),
(11, 1, 'AZUL',   'G',  'CAM-AZUL-G',    59.90, 1),
(12, 1, 'AZUL',   'GG', 'CAM-AZUL-GG',   59.90, 1);

-- Vestido Midi (12)
INSERT OR IGNORE INTO variacao_produto (id_variacao, id_produto, cor, tamanho, sku, preco, ativo) VALUES
(13, 2, 'BRANCO', 'P',  'VEM-BRANCO-P',  129.90, 1),
(14, 2, 'BRANCO', 'M',  'VEM-BRANCO-M',  129.90, 1),
(15, 2, 'BRANCO', 'G',  'VEM-BRANCO-G',  129.90, 1),
(16, 2, 'BRANCO', 'GG', 'VEM-BRANCO-GG', 129.90, 1),
(17, 2, 'PRETO',  'P',  'VEM-PRETO-P',   129.90, 1),
(18, 2, 'PRETO',  'M',  'VEM-PRETO-M',   129.90, 1),
(19, 2, 'PRETO',  'G',  'VEM-PRETO-G',   129.90, 1),
(20, 2, 'PRETO',  'GG', 'VEM-PRETO-GG',  129.90, 1),
(21, 2, 'AZUL',   'P',  'VEM-AZUL-P',    129.90, 1),
(22, 2, 'AZUL',   'M',  'VEM-AZUL-M',    129.90, 1),
(23, 2, 'AZUL',   'G',  'VEM-AZUL-G',    129.90, 1),
(24, 2, 'AZUL',   'GG', 'VEM-AZUL-GG',   129.90, 1);

-- Calça Jeans (4)
INSERT OR IGNORE INTO variacao_produto (id_variacao, id_produto, cor, tamanho, sku, preco, ativo) VALUES
(25, 3, 'AZUL', 'P',  'CAJ-AZUL-P',  99.90, 1),
(26, 3, 'AZUL', 'M',  'CAJ-AZUL-M',  99.90, 1),
(27, 3, 'AZUL', 'G',  'CAJ-AZUL-G',  99.90, 1),
(28, 3, 'AZUL', 'GG', 'CAJ-AZUL-GG', 99.90, 1);

-- =========================================================
-- 6) ESTOQUE BASE (estável para PI)
-- =========================================================
INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min) VALUES
-- Camisetas (total 58)
(1,  5, 4),(2,  5, 4),(3,  5, 4),(4,  5, 4),
(5,  5, 4),(6,  5, 4),(7,  4, 4),(8,  4, 4),
(9,  5, 4),(10, 5, 4),(11, 5, 4),(12, 5, 4),

-- Vestidos (total 52)
(13, 4, 4),(14, 4, 4),(15, 4, 4),(16, 4, 4),
(17, 4, 4),(18, 4, 4),(19, 4, 4),(20, 4, 4),
(21, 5, 4),(22, 5, 4),(23, 5, 4),(24, 5, 4),

-- Calças (total 42)
(25, 10, 4),(26, 11, 4),(27, 11, 4),(28, 10, 4);

-- Força 1 variação em situação crítica (pro gerente enxergar)
UPDATE estoque SET quantidade = 1, estoque_min = 4 WHERE id_variacao = 7;

-- =========================================================
-- 7) MOVIMENTAÇÕES (auditoria/estoque)
-- =========================================================
INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
VALUES (
  7, 'AJUSTE', 1,
  'Seed PI: ajuste para simular item crítico no dashboard.',
  COALESCE(
    (SELECT id_usuario FROM usuario WHERE email='estoque@varejosync.com' LIMIT 1),
    (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
  )
);

INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
VALUES (
  1, 'ENTRADA', 5,
  'Seed PI: entrada inicial registrada pelo estoquista.',
  COALESCE(
    (SELECT id_usuario FROM usuario WHERE email='estoque@varejosync.com' LIMIT 1),
    (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
  )
);

-- =========================================================
-- 8) VENDA CONCLUÍDA (para indicadores e relatórios)
-- =========================================================
INSERT INTO venda (id_usuario, status, forma_pagamento, total_bruto, desconto_total, total, criado_em)
VALUES (
  (SELECT id_usuario FROM usuario WHERE email='vendas@varejosync.com' LIMIT 1),
  'CONCLUIDA',
  'PIX',
  189.70, 0, 189.70,
  datetime('now','-1 hour')
);

INSERT INTO item_venda (id_venda, id_variacao, quantidade, preco_unit_original, desconto_valor, desconto_percent, motivo_desconto, preco_unit, subtotal)
VALUES
((SELECT MAX(id_venda) FROM venda), 1,  1,  59.90, 0, 0, NULL,  59.90,  59.90),
((SELECT MAX(id_venda) FROM venda), 13, 1, 129.90, 0, 0, NULL, 129.90, 129.90);

UPDATE estoque SET quantidade = quantidade - 1, atualizado_em = datetime('now') WHERE id_variacao IN (1,13);

INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
VALUES (
  1, 'SAIDA', 1,
  'Seed PI: saída automática por venda concluída.',
  (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
);

INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
VALUES (
  13, 'SAIDA', 1,
  'Seed PI: saída automática por venda concluída.',
  (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
);

-- =========================================================
-- 9) VENDA COM DOCUMENTO FISCAL EMITIDA (BLOQUEIO_FISCAL)
-- =========================================================
INSERT INTO venda (id_usuario, status, forma_pagamento, total_bruto, desconto_total, total, criado_em)
VALUES (
  (SELECT id_usuario FROM usuario WHERE email='vendas@varejosync.com' LIMIT 1),
  'CONCLUIDA',
  'CREDITO',
  59.90, 0, 59.90,
  datetime('now','-10 minutes')
);

INSERT INTO item_venda (id_venda, id_variacao, quantidade, preco_unit_original, desconto_valor, desconto_percent, motivo_desconto, preco_unit, subtotal)
VALUES
((SELECT MAX(id_venda) FROM venda), 2, 1, 59.90, 0, 0, NULL, 59.90, 59.90);

UPDATE estoque SET quantidade = quantidade - 1, atualizado_em = datetime('now') WHERE id_variacao = 2;

INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
VALUES (
  2, 'SAIDA', 1,
  'Seed PI: saída automática por venda concluída (venda fiscal).',
  (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1)
);

INSERT INTO documento_fiscal (id_venda, numero, serie, status, chave_acesso, valor_total, emitido_em)
VALUES (
  (SELECT MAX(id_venda) FROM venda),
  2,
  '1',
  'EMITIDA',
  'DF-2-2',
  59.90,
  datetime('now','-9 minutes')
);