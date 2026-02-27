const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const os = require("os");

const schemaPath = path.resolve(__dirname, "src/db/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

// coloca o DB numa pasta temporária do Windows (menos chance de lock/index)
const dbPath = path.join(os.tmpdir(), "varejosync_schema_test.db");
console.log("DB:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) throw err;
  console.log("OPEN file ok");

  db.configure("busyTimeout", 5000);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;",
    () => {
      db.exec(schema, (e) => {
        console.log("EXEC schema:", e ? e.message : "ok");
        db.close(() => console.log("CLOSED"));
      });
    },
  );
});
