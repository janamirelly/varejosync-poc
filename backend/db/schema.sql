
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
-- 6) FISCAL (SIMULADO / PI)
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

-- índices do fiscal (deixar aqui para não duplicar)
CREATE UNIQUE INDEX IF NOT EXISTS uq_docfiscal_numero
  ON documento_fiscal(numero);

CREATE INDEX IF NOT EXISTS idx_docfiscal_status     ON documento_fiscal(status);
CREATE INDEX IF NOT EXISTS idx_docfiscal_emitido_em ON documento_fiscal(emitido_em);