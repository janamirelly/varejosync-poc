// backend/src/database.js
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// ===============================
// Caminho do banco 
// ===============================
const defaultDbPath = path.resolve(__dirname, "..", "db", "varejosync.db");
const dbPath = process.env.DB_PATH || defaultDbPath;
console.log("[DB PATH]", dbPath);

// ===============================
// OPEN READY: só prossegue após conectar + PRAGMAs
// ===============================
let _resolveOpen;
let _rejectOpen;

const openReady = new Promise((resolve, reject) => {
  _resolveOpen = resolve;
  _rejectOpen = reject;
});

// Abre o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("[DB] Erro ao conectar:", err.message);
    _rejectOpen(err);
    return;
  }

  console.log("Conectado ao SQLite.");

  // PRAGMAs em 1 exec (aguardado)
  db.exec(
    `
    PRAGMA encoding = 'UTF-8';
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    -- IMPORTANTE (Windows): desliga WAL para evitar -wal/-shm e travas
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = FULL;
    `,
    (e) => {
      if (e) {
        console.error("[DB] Erro PRAGMAs:", e.message);
        _rejectOpen(e);
        return;
      }

      console.log("PRAGMA foreign_keys = ON (OK).");
      _resolveOpen();
    },
  );
});

// ===============================
// Helpers Promises
// ===============================
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// ===============================
// Arquivos SQL (fora do src)
// ===============================
// root do backend (porque este arquivo está em backend/src)
const backendRoot = path.resolve(__dirname, "..");

// Pasta db dentro do projeto (onde ficam schema/migrations/seed)
const dbProjectDir = path.join(backendRoot, "db");

// Garante a pasta existir (não mexe no dbPath externo)
try {
  fs.mkdirSync(dbProjectDir, { recursive: true });
} catch {}

// Agora os caminhos corretos:
const schemaPath = path.join(dbProjectDir, "schema.sql");
const migrationsPath = path.join(dbProjectDir, "migrations.sql");

console.log("[SCHEMA PATH]", schemaPath);
console.log("[MIGRATIONS PATH]", migrationsPath);

if (!fs.existsSync(schemaPath)) {
  throw new Error(
    `[DB] schema.sql não encontrado em: ${schemaPath}\n` +
      "➡️ Coloque o arquivo em backend/db/schema.sql (fora de src).",
  );
}

const schema = fs.readFileSync(schemaPath, "utf-8");
const migrations = fs.existsSync(migrationsPath)
  ? fs.readFileSync(migrationsPath, "utf-8")
  : "";

// ===============================
// Patches idempotentes (JS)
// ===============================
async function columnExists(table, column) {
  const rows = await all(`PRAGMA table_info(${table});`);
  return rows.some((r) => r.name === column);
}

async function applyPatches() {
  // 1) variacao_produto.preco (para DB antigo)
  const hasPreco = await columnExists("variacao_produto", "preco");
  if (!hasPreco) {
    await run(
      `ALTER TABLE variacao_produto ADD COLUMN preco REAL NOT NULL DEFAULT 0;`,
    );
    console.log(
      "[PATCH] Adicionada coluna variacao_produto.preco (DEFAULT 0).",
    );
  } else {
    console.log("[PATCH] variacao_produto.preco OK.");
  }

  // 2) movimentacao_estoque.id_usuario (para DB antigo)
  const hasMovUser = await columnExists("movimentacao_estoque", "id_usuario");
  if (!hasMovUser) {
    await run(
      `ALTER TABLE movimentacao_estoque ADD COLUMN id_usuario INTEGER;`,
    );
    console.log("[PATCH] Adicionada coluna movimentacao_estoque.id_usuario.");
  } else {
    console.log("[PATCH] movimentacao_estoque.id_usuario OK.");
  }

  // 3) índice
  await run(
    `CREATE INDEX IF NOT EXISTS idx_mov_usuario ON movimentacao_estoque(id_usuario);`,
  );

  // 4) garantir usuário Sistema
  await run(`
    INSERT OR IGNORE INTO usuario (nome, email, id_perfil, ativo)
    SELECT 'Sistema', 'system@varejosync.com', id_perfil, 1
    FROM perfil
    WHERE nome='Gerente de Operações';
  `);

  // 5) saneamento: ids inválidos/NULL
  await run(`
    UPDATE movimentacao_estoque
    SET id_usuario = (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com')
    WHERE id_usuario IS NULL
       OR id_usuario NOT IN (SELECT id_usuario FROM usuario);
  `);

  await run(`
    UPDATE venda
    SET id_usuario = (SELECT id_usuario FROM usuario WHERE email='system@varejosync.com')
    WHERE id_usuario IS NULL
       OR id_usuario NOT IN (SELECT id_usuario FROM usuario);
  `);

  // 6) motivo_cancelamento
  const hasMotivo = await columnExists("venda", "motivo_cancelamento");
  if (!hasMotivo) {
    await run(`ALTER TABLE venda ADD COLUMN motivo_cancelamento TEXT;`);
    console.log("[PATCH] Adicionada coluna venda.motivo_cancelamento.");
  } else {
    console.log("[PATCH] venda.motivo_cancelamento OK.");
  }

  // 7) devolução
  const hasMotivoDev = await columnExists("venda", "motivo_devolucao");
  if (!hasMotivoDev) {
    await run(`ALTER TABLE venda ADD COLUMN motivo_devolucao TEXT;`);
    console.log("[PATCH] Adicionada coluna venda.motivo_devolucao.");
  } else {
    console.log("[PATCH] venda.motivo_devolucao OK.");
  }

  const hasDevolvidoEm = await columnExists("venda", "devolvido_em");
  if (!hasDevolvidoEm) {
    await run(`ALTER TABLE venda ADD COLUMN devolvido_em TEXT;`);
    console.log("[PATCH] Adicionada coluna venda.devolvido_em.");
  } else {
    console.log("[PATCH] venda.devolvido_em OK.");
  }
}

// ===============================
// SYSTEM_USER_ID
// ===============================
let SYSTEM_USER_ID = null;

async function loadSystemUser() {
  const row = await get(
    `SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1`,
  );
  if (row && row.id_usuario) {
    SYSTEM_USER_ID = row.id_usuario;
    console.log("[SYSTEM USER ID]", SYSTEM_USER_ID);
  } else {
    console.warn("[SYSTEM USER ID] não encontrado (ainda).");
  }
}

// ===============================
// Execução (schema -> migrations -> patches)
// ===============================
async function execSchemaIfNeeded() {
  const verRow = await get("PRAGMA user_version;");
  const userVersion = verRow?.user_version || 0;
  console.log("[DB] user_version =", userVersion);

  if (userVersion >= 1) {
    console.log(
      "[DB] schema já aplicado (user_version >= 1). Pulando schema.sql",
    );
    return;
  }

  // Smoke exec
  await new Promise((resolve, reject) => {
    db.exec("CREATE TABLE IF NOT EXISTS __boot_smoke(id INTEGER);", (e) => {
      if (e) return reject(e);
      console.log("[DB] smoke exec ok.");
      resolve();
    });
  });

  console.log("[DB] aplicando schema pela primeira vez (user_version < 1)...");
  console.log("[DB] executando schema via db.exec (modo estável)...");

  await new Promise((resolve, reject) => {
    const wd = setTimeout(() => {
      console.log("[DB] schema ainda executando após 30s (lock/IO).");
    }, 30000);

    db.exec(schema, (err) => {
      clearTimeout(wd);
      if (err) return reject(new Error("Erro schema.sql: " + err.message));
      console.log("[DB] schema executado com sucesso.");
      resolve();
    });
  });

  await new Promise((resolve, reject) => {
    db.run("PRAGMA user_version = 1;", (err) => {
      if (err)
        return reject(new Error("Erro ao setar user_version: " + err.message));
      console.log("[DB] user_version setado para 1.");
      resolve();
    });
  });
}

async function execMigrations() {
  if (!migrations || !migrations.trim()) {
    console.log("[DB] migrations.sql vazio/inexistente. Pulando migrations.");
    return;
  }

  console.log("[DB] executando migrations via db.exec...");
  await new Promise((resolve, reject) => {
    db.exec(migrations, (err) => {
      if (err) return reject(new Error("Erro migrations.sql: " + err.message));
      console.log("[DB] migrations executadas com sucesso.");
      resolve();
    });
  });
}

async function execPatches() {
  console.log("[DB] aplicando patches (JS)...");
  try {
    await run("BEGIN IMMEDIATE TRANSACTION");
    await applyPatches();
    await run("COMMIT");
    console.log("[DB] patches aplicados com sucesso.");
  } catch (e) {
    try {
      await run("ROLLBACK");
    } catch {}
    const msg = e?.message || String(e);
    throw new Error("Erro patches DB: " + msg);
  }
}

// ===============================
// READY Promise
// ===============================
const ready = new Promise((resolve, reject) => {
  console.log("[DB] iniciando schema+migrations+patches...");

  openReady
    .then(async () => {
      try {
        await execSchemaIfNeeded();
        await execMigrations();
        await execPatches();
        await loadSystemUser();

        console.log("[DB] pronto (schema+migrations+patches).");
        resolve();
      } catch (e) {
        reject(e || new Error("Falha ao inicializar DB (erro nulo)."));
      }
    })
    .catch((e) => reject(e || new Error("Falha ao abrir SQLite (erro nulo).")));
});

// ===============================
// Exports
// ===============================
module.exports = {
  db,
  ready,
  SYSTEM_USER_ID: () => SYSTEM_USER_ID,
};
