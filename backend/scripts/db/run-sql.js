const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const sqlFileArg = process.argv[2];
if (!sqlFileArg) {
  console.error("Uso: node scripts/db/run-sql.js <arquivo.sql>");
  process.exit(1);
}

// DB da banca (repo) por padrão:
const dbPath =
  process.env.DB_PATH || path.resolve(process.cwd(), "db", "varejosync.db");
const sqlFile = path.resolve(process.cwd(), sqlFileArg);

if (!fs.existsSync(sqlFile)) {
  console.error(`Arquivo SQL não encontrado: ${sqlFileArg}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, "utf8");

const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(sql, (err) => {
    if (err) {
      console.error(`Erro executando ${sqlFileArg}:`, err.message);
      db.close();
      process.exit(1);
    }
    console.log(`OK: executado ${sqlFileArg} em ${dbPath}`);
    db.close();
  });
});
