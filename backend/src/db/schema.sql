PRAGMA foreign_keys = ON;

-- =========================================================
-- 1) PERFIL / USUÁRIO
-- =========================================================
CREATE TABLE IF NOT EXISTS perfil (
  id_perfil INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  email      TEXT UNIQUE,
  id_perfil  INTEGER NOT NULL,
  ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil)
);

-- =========================================================
-- 2) PRODUTO / VARIAÇÃO
-- =========================================================
CREATE TABLE IF NOT EXISTS produto (
  id_produto INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS variacao_produto (
  id_variacao INTEGER PRIMARY KEY AUTOINCREMENT,
  id_produto  INTEGER NOT NULL,
  cor         TEXT NOT NULL,
  tamanho     TEXT NOT NULL,
  sku         TEXT NOT NULL UNIQUE,
  preco       REAL NOT NULL DEFAULT 0 CHECK (preco >= 0),
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

-- =========================================================
-- 3) ESTOQUE / MOVIMENTAÇÃO
-- =========================================================
CREATE TABLE IF NOT EXISTS estoque (
  id_estoque    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_variacao   INTEGER NOT NULL UNIQUE,
  quantidade    INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_min   INTEGER NOT NULL DEFAULT 10 CHECK (estoque_min >= 0),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_variacao) REFERENCES variacao_produto(id_variacao)
);

CREATE TABLE IF NOT EXISTS movimentacao_estoque (
  id_movimentacao INTEGER PRIMARY KEY AUTOINCREMENT,
  id_variacao      INTEGER NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE')),
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  observacao       TEXT,
  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  id_usuario       INTEGER NOT NULL,
  FOREIGN KEY (id_variacao) REFERENCES variacao_produto(id_variacao),
  FOREIGN KEY (id_usuario)  REFERENCES usuario(id_usuario)
);

-- =========================================================
-- 4) VENDA / ITENS DA VENDA
-- =========================================================
CREATE TABLE IF NOT EXISTS venda (
  id_venda            INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario          INTEGER,
  status              TEXT NOT NULL DEFAULT 'CONCLUIDA'
                     CHECK (status IN ('CONCLUIDA','CANCELADA','DEVOLVIDA')),
  forma_pagamento     TEXT NOT NULL
                     CHECK (forma_pagamento IN ('DINHEIRO','CREDITO','DEBITO','PIX','OUTRO')),

  total_bruto REAL NOT NULL DEFAULT 0 CHECK (total_bruto >= 0),
  desconto_total REAL NOT NULL DEFAULT 0 CHECK (desconto_total >= 0),

  total               REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
  motivo_cancelamento TEXT,
  motivo_devolucao    TEXT,
  devolvido_em        TEXT,
  criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);


CREATE TABLE IF NOT EXISTS item_venda (
  id_item      INTEGER PRIMARY KEY AUTOINCREMENT,
  id_venda     INTEGER NOT NULL,
  id_variacao  INTEGER NOT NULL,
  quantidade   INTEGER NOT NULL CHECK (quantidade > 0),

  preco_unit_original REAL,
  desconto_valor REAL NOT NULL DEFAULT 0 CHECK (desconto_valor >= 0),
  desconto_percent REAL NOT NULL DEFAULT 0 CHECK (desconto_percent >= 0),
  motivo_desconto TEXT,

  preco_unit   REAL NOT NULL CHECK (preco_unit >= 0),
  subtotal     REAL NOT NULL CHECK (subtotal >= 0),

  FOREIGN KEY (id_venda) REFERENCES venda(id_venda),
  FOREIGN KEY (id_variacao) REFERENCES variacao_produto(id_variacao)
);


-- =========================================================
-- 5) ÍNDICES ÚTEIS (POC)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_variacao_produto ON variacao_produto(id_produto);
CREATE INDEX IF NOT EXISTS idx_mov_variacao     ON movimentacao_estoque(id_variacao);
CREATE INDEX IF NOT EXISTS idx_mov_usuario      ON movimentacao_estoque(id_usuario);
CREATE INDEX IF NOT EXISTS idx_item_venda_venda ON item_venda(id_venda);
CREATE INDEX IF NOT EXISTS idx_item_venda_var   ON item_venda(id_variacao);

-- =========================================================
-- 6) DADOS INICIAIS (SEED)
-- =========================================================
INSERT OR IGNORE INTO perfil (nome) VALUES ('Gerente de Operações');
INSERT OR IGNORE INTO perfil (nome) VALUES ('Estoquista');
INSERT OR IGNORE INTO perfil (nome) VALUES ('Vendedora');

-- Usuários  (POC)
INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'João Almeida', 'gerente@varejosync.com', id_perfil FROM perfil WHERE nome='Gerente de Operações';

INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'Marcos Lima', 'estoque@varejosync.com', id_perfil FROM perfil WHERE nome='Estoquista';

INSERT OR IGNORE INTO usuario (nome, email, id_perfil)
SELECT 'Ana Paula', 'vendas@varejosync.com', id_perfil FROM perfil WHERE nome='Vendedora';

-- =========================================================
-- 6.1) SEED PRODUTOS / VARIAÇÕES / ESTOQUE (PI)
-- 3 produtos | 28 variações | preços fixos por produto
-- SKUs: CAM-<COR>-<TAM> | VEM-<COR>-<TAM> | CAJ-AZUL-<TAM>
-- =========================================================

-- Produtos
INSERT OR IGNORE INTO produto (id_produto, nome, descricao, ativo) VALUES
(1, 'Camiseta Básica', 'Camiseta básica em algodão (PI)', 1),
(2, 'Vestido Midi',    'Vestido midi casual (PI)',        1),
(3, 'Calça Jeans',     'Calça jeans skinny (PI)',    1);

-- Variações (preço por produto)
-- Camiseta Básica: R$ 59,90 | cores: BRANCO, PRETO, AZUL | tam: P,M,G,GG (12)
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

-- Vestido Midi: R$ 129,90 | cores: BRANCO, PRETO, AZUL | tam: P,M,G,GG (12)
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

-- Calça Jeans: R$ 99,90 | cor: AZUL | tam: P,M,G,GG (4)
INSERT OR IGNORE INTO variacao_produto (id_variacao, id_produto, cor, tamanho, sku, preco, ativo) VALUES
(25, 3, 'AZUL', 'P',  'CAJ-AZUL-P',  99.90, 1),
(26, 3, 'AZUL', 'M',  'CAJ-AZUL-M',  99.90, 1),
(27, 3, 'AZUL', 'G',  'CAJ-AZUL-G',  99.90, 1),
(28, 3, 'AZUL', 'GG', 'CAJ-AZUL-GG', 99.90, 1);

-- Estoque (base estável para PI; pode ajustar depois)
-- Produtos: Camisetas total 58, Vestidos 52, Calças 42 (como no dashboard da PI)
-- Distribuição simples e coerente por variação.

-- Camisetas (12 variações) => total 58
INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min) VALUES
(1,  5, 4),(2,  5, 4),(3,  5, 4),(4,  5, 4),
(5,  5, 4),(6,  5, 4),(7,  4, 4),(8,  4, 4),
(9,  5, 4),(10, 5, 4),(11, 5, 4),(12, 5, 4);

-- Vestidos (12 variações) => total 52
INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min) VALUES
(13, 4, 4),(14, 4, 4),(15, 4, 4),(16, 4, 4),
(17, 4, 4),(18, 4, 4),(19, 4, 4),(20, 4, 4),
(21, 5, 4),(22, 5, 4),(23, 5, 4),(24, 5, 4);

-- Calças (4 variações) => total 42
INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min) VALUES
(25, 10, 4),(26, 11, 4),(27, 11, 4),(28, 10, 4);

-- =========================================================
-- 7) VIEWS (estoque + dashboards + relatórios)
-- =========================================================

-- VIEW: vw_estoque_detalhado
DROP VIEW IF EXISTS vw_estoque_detalhado;

CREATE VIEW vw_estoque_detalhado AS
SELECT
  p.id_produto,
  p.nome AS produto,
  v.id_variacao,
  v.cor,
  v.tamanho,
  v.sku,
  v.preco,
  COALESCE(e.quantidade, 0) AS quantidade,
  COALESCE(e.estoque_min, 10) AS estoque_min,
  e.atualizado_em,
  CASE
    WHEN COALESCE(e.quantidade, 0) <= 0 THEN 'ESGOTADO'
    WHEN COALESCE(e.quantidade, 0) <= CAST(COALESCE(e.estoque_min, 10) * 0.3 AS INT) THEN 'CRITICO'
    WHEN COALESCE(e.quantidade, 0) <= COALESCE(e.estoque_min, 10) THEN 'ATENCAO'
    ELSE 'DISPONIVEL'
  END AS status
FROM variacao_produto v
JOIN produto p ON p.id_produto = v.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao;

-- VIEW: vw_dashboard_resumo
DROP VIEW IF EXISTS vw_dashboard_resumo;

CREATE VIEW vw_dashboard_resumo AS
WITH
params AS (
  SELECT
    date('now')                 AS hoje,
    date('now','-6 days')       AS inicio7dias,
    datetime('now','-24 hours') AS inicio24h
),
estoque_total AS (
  SELECT COALESCE(SUM(quantidade), 0) AS estoque_total
  FROM estoque
),
itens_criticos AS (
  SELECT COUNT(*) AS itens_criticos
  FROM vw_estoque_detalhado
  WHERE status IN ('CRITICO','ESGOTADO')
),
pedidos_hoje AS (
  SELECT COUNT(*) AS pedidos_hoje
  FROM venda, params
  WHERE status = 'CONCLUIDA'
    AND date(criado_em) = params.hoje
),
faturamento_7dias AS (
  SELECT
    COALESCE(SUM(total), 0) AS faturamento_7dias,
    COALESCE(AVG(total), 0) AS ticket_medio_7dias,
    COALESCE(COUNT(*), 0)   AS pedidos_7dias
  FROM venda, params
  WHERE status = 'CONCLUIDA'
    AND date(criado_em) BETWEEN params.inicio7dias AND params.hoje
),
ultima_sinc AS (
  SELECT MAX(dt) AS ultima_sincronizacao
  FROM (
    SELECT MAX(atualizado_em) AS dt FROM estoque
    UNION ALL
    SELECT MAX(criado_em)     AS dt FROM movimentacao_estoque
    UNION ALL
    SELECT MAX(criado_em)     AS dt FROM venda
  )
)
SELECT
  estoque_total.estoque_total,
  itens_criticos.itens_criticos,
  pedidos_hoje.pedidos_hoje,
  faturamento_7dias.faturamento_7dias,
  faturamento_7dias.ticket_medio_7dias,
  faturamento_7dias.pedidos_7dias,
  ultima_sinc.ultima_sincronizacao
FROM estoque_total
CROSS JOIN itens_criticos
CROSS JOIN pedidos_hoje
CROSS JOIN faturamento_7dias
CROSS JOIN ultima_sinc;

-- VIEW: vw_dashboard_estoque_por_produto
DROP VIEW IF EXISTS vw_dashboard_estoque_por_produto;

CREATE VIEW vw_dashboard_estoque_por_produto AS
SELECT
  p.id_produto,
  p.nome AS produto,
  COALESCE(SUM(e.quantidade), 0) AS quantidade_total
FROM produto p
JOIN variacao_produto v ON v.id_produto = p.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
GROUP BY p.id_produto, p.nome;

-- VIEW: vw_dashboard_criticos_por_produto
DROP VIEW IF EXISTS vw_dashboard_criticos_por_produto;

CREATE VIEW vw_dashboard_criticos_por_produto AS
SELECT
  id_produto,
  produto,
  COUNT(*) AS itens_criticos
FROM vw_estoque_detalhado
WHERE status IN ('CRITICO','ESGOTADO','ATENCAO')
GROUP BY id_produto, produto;

-- VIEW : vw_dashboard_estoque_abaixo_min_por_produto
DROP VIEW IF EXISTS vw_dashboard_estoque_abaixo_min_por_produto;

CREATE VIEW vw_dashboard_estoque_abaixo_min_por_produto AS
SELECT
  p.id_produto,
  p.nome AS produto,

  -- Quantas variações desse produto estão abaixo do mínimo
  SUM(
    CASE
      WHEN COALESCE(e.quantidade, 0) < COALESCE(e.estoque_min, 10) THEN 1
      ELSE 0
    END
  ) AS variacoes_abaixo_min,

  -- Quantas UNIDADES faltam no total para bater o mínimo (gap)
  SUM(
    CASE
      WHEN COALESCE(e.quantidade, 0) < COALESCE(e.estoque_min, 10)
      THEN (COALESCE(e.estoque_min, 10) - COALESCE(e.quantidade, 0))
      ELSE 0
    END
  ) AS unidades_faltantes

FROM produto p
JOIN variacao_produto v ON v.id_produto = p.id_produto
LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
GROUP BY p.id_produto, p.nome
ORDER BY unidades_faltantes DESC, variacoes_abaixo_min DESC, produto;


-- VIEW: vw_dashboard_formas_pagamento_7dias
DROP VIEW IF EXISTS vw_dashboard_formas_pagamento_7dias;

CREATE VIEW vw_dashboard_formas_pagamento_7dias AS
WITH params AS (
  SELECT date('now') AS hoje, date('now','-6 days') AS inicio7dias
)
SELECT
  forma_pagamento,
  COUNT(*) AS quantidade,
  COALESCE(SUM(total), 0) AS total
FROM venda, params
WHERE status = 'CONCLUIDA'
  AND date(criado_em) BETWEEN params.inicio7dias AND params.hoje
GROUP BY forma_pagamento;

-- VIEW: vw_dashboard_produtos_mais_vendidos_24h
DROP VIEW IF EXISTS vw_dashboard_produtos_mais_vendidos_24h;

CREATE VIEW vw_dashboard_produtos_mais_vendidos_24h AS
WITH params AS (
  SELECT datetime('now','-24 hours') AS inicio24h
)
SELECT
  p.id_produto,
  p.nome AS produto,
  COALESCE(SUM(iv.quantidade), 0) AS unidades,
  COALESCE(SUM(iv.subtotal), 0) AS receita
FROM item_venda iv
JOIN venda ve ON ve.id_venda = iv.id_venda
JOIN variacao_produto v ON v.id_variacao = iv.id_variacao
JOIN produto p ON p.id_produto = v.id_produto
JOIN params ON 1=1
WHERE ve.status = 'CONCLUIDA'
  AND ve.criado_em >= params.inicio24h
GROUP BY p.id_produto, p.nome;

-- VIEW: vw_movimentacao_detalhada
DROP VIEW IF EXISTS vw_movimentacao_detalhada;

CREATE VIEW vw_movimentacao_detalhada AS
SELECT
  me.id_movimentacao,
  me.criado_em,
  me.tipo,
  me.quantidade,
  me.observacao,
  me.id_variacao,
  u.id_usuario,
  u.nome  AS usuario_nome,
  u.email AS usuario_email,
  p.nome  AS perfil
FROM movimentacao_estoque me
LEFT JOIN usuario u ON u.id_usuario = me.id_usuario
LEFT JOIN perfil  p ON p.id_perfil = u.id_perfil;

-- VIEW: vw_relatorio_fechamento_caixa_dia
DROP VIEW IF EXISTS vw_relatorio_fechamento_caixa_dia;

CREATE VIEW vw_relatorio_fechamento_caixa_dia AS
SELECT
  date(criado_em) AS dia,

  -- Concluídas
  SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS qtd_concluidas,
  ROUND(SUM(CASE WHEN status = 'CONCLUIDA' THEN total ELSE 0 END), 2) AS total_concluidas,

  -- Ticket médio (somente concluidas)
  CASE
    WHEN SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) > 0
    THEN ROUND(
      SUM(CASE WHEN status = 'CONCLUIDA' THEN total ELSE 0 END)
      / SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END),
      2
    )
    ELSE 0
  END AS ticket_medio,

  -- Canceladas
  SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) AS qtd_canceladas,
  ROUND(SUM(CASE WHEN status = 'CANCELADA' THEN total ELSE 0 END), 2) AS total_canceladas,

  -- Totais por forma de pagamento (somente CONCLUIDA)
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='DINHEIRO' THEN total ELSE 0 END), 2) AS total_dinheiro,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='CREDITO'  THEN total ELSE 0 END), 2) AS total_credito,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='DEBITO'   THEN total ELSE 0 END), 2) AS total_debito,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='PIX'      THEN total ELSE 0 END), 2) AS total_pix,
  ROUND(SUM(CASE WHEN status='CONCLUIDA' AND forma_pagamento='OUTRO'    THEN total ELSE 0 END), 2) AS total_outro

FROM venda
GROUP BY date(criado_em)
ORDER BY dia DESC;

-- =========================================================
-- 8) FISCAL (SIMULADO / PI)
-- =========================================================
CREATE TABLE IF NOT EXISTS documento_fiscal (
  id_documento        INTEGER PRIMARY KEY AUTOINCREMENT,
  id_venda            INTEGER NOT NULL UNIQUE,
  numero              INTEGER NOT NULL,
  serie               TEXT NOT NULL DEFAULT '1',
  status              TEXT NOT NULL DEFAULT 'EMITIDA'
                      CHECK (status IN ('EMITIDA','CANCELADA')),
  chave_acesso        TEXT NOT NULL,
  valor_total         REAL NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  emitido_em          TEXT NOT NULL DEFAULT (datetime('now')),
  cancelado_em        TEXT,
  motivo_cancelamento TEXT,
  FOREIGN KEY (id_venda) REFERENCES venda(id_venda)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_docfiscal_numero
  ON documento_fiscal(numero);
  
CREATE INDEX IF NOT EXISTS idx_docfiscal_status     ON documento_fiscal(status);
CREATE INDEX IF NOT EXISTS idx_docfiscal_emitido_em ON documento_fiscal(emitido_em);

