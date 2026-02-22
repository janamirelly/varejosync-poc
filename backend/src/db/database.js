const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Caminho do banco (fica na raiz do backend)
const dbPath = path.resolve(__dirname, "../../varejosync_pi.db");
console.log("[DB PATH]", dbPath);

// Cria ou abre o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar no banco:", err.message);
  } else {
    console.log("Conectado ao SQLite.");
    db.run("PRAGMA encoding = 'UTF-8';");
  }

  console.log("Banco SQLite conectado com sucesso.");

  // Garante FK ativada na conexão atual
  db.run("PRAGMA foreign_keys = ON", (e) => {
    if (e) console.error("Erro ao ativar foreign_keys:", e.message);
    else console.log("PRAGMA foreign_keys = ON (OK).");
  });
});

// --- helpers (promises) ---
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
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

async function columnExists(table, column) {
  const rows = await all(`PRAGMA table_info(${table});`);
  return rows.some((r) => r.name === column);
}

// --- migrações simples (patches idempotentes) ---
async function applyPatches() {
  // 1) Garantir coluna preco em variacao_produto (caso o DB seja antigo)
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

  // 2) Garantir coluna id_usuario em movimentacao_estoque
  const hasMovUser = await columnExists("movimentacao_estoque", "id_usuario");
  if (!hasMovUser) {
    await run(
      `ALTER TABLE movimentacao_estoque ADD COLUMN id_usuario INTEGER;`,
    );
    console.log("[PATCH] Adicionada coluna movimentacao_estoque.id_usuario.");
  } else {
    console.log("[PATCH] movimentacao_estoque.id_usuario OK.");
  }

  // 3) Índice de id_usuario
  await run(
    `CREATE INDEX IF NOT EXISTS idx_mov_usuario ON movimentacao_estoque(id_usuario);`,
  );

  // 4) Garantir usuário Sistema (fallback)
  await run(`
    INSERT OR IGNORE INTO usuario (nome, email, id_perfil, ativo)
    SELECT 'Sistema', 'system@varejosync.com', id_perfil, 1
    FROM perfil
    WHERE nome='Gerente de Operações';
  `);

  // 5) Saneamento histórico (corrige NULL e ids inválidos)
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

  // 6) Garantir coluna motivo_cancelamento em venda
  const hasMotivo = await columnExists("venda", "motivo_cancelamento");
  if (!hasMotivo) {
    await run(`ALTER TABLE venda ADD COLUMN motivo_cancelamento TEXT;`);
    console.log("[PATCH] Adicionada coluna venda.motivo_cancelamento.");
  } else {
    console.log("[PATCH] venda.motivo_cancelamento OK.");
  }

  // 7) Garantir colunas de devolução em venda
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

// -------------------------------
// Execução: schema -> migrations -> patches
// -------------------------------
const schemaPath = path.resolve(__dirname, "schema.sql");
const migrationsPath = path.resolve(__dirname, "migrations.sql");

console.log("[SCHEMA PATH]", schemaPath);
console.log("[MIGRATIONS PATH]", migrationsPath);


const schema = fs.readFileSync(schemaPath, "utf-8");
const migrations = fs.existsSync(migrationsPath)
  ? fs.readFileSync(migrationsPath, "utf-8")
  : "";

// Executa schema e depois migrations
db.exec(schema, (err) => {
  if (err) {
    console.error("Erro ao executar schema.sql:", err.message);
    return;
  }
  console.log("Schema executado com sucesso.");

  db.exec(migrations, async (err2) => {
    if (err2) {
      console.error("Erro ao executar migrations.sql:", err2.message);
      return;
    }
    console.log("Migrations executadas com sucesso.");

    // Depois aplica patches (JS)
    try {
      await run("BEGIN");
      await applyPatches();
      await run("COMMIT");
      console.log("Patches aplicados com sucesso.");
    } catch (e) {
      try {
        await run("ROLLBACK");
      } catch {}
      console.error("Erro ao aplicar patches no banco:", e.message);
    }
  });
});

let SYSTEM_USER_ID = null;

async function loadSystemUser() {
  const rows = await all(
    `SELECT id_usuario FROM usuario WHERE email='system@varejosync.com' LIMIT 1`,
  );
  if (rows.length > 0) {
    SYSTEM_USER_ID = rows[0].id_usuario;
    console.log("[SYSTEM USER ID]", SYSTEM_USER_ID);
  }
}

loadSystemUser();

module.exports = {
  db,
  SYSTEM_USER_ID: () => SYSTEM_USER_ID,
};
