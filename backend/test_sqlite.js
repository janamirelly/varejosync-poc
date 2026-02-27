const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "sqlite_smoke.db");
console.log("DB:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  console.log("OPEN:", err ? err.message : "ok");

  db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER);", (e) => {
    console.log("EXEC:", e ? e.message : "ok");
    db.close(() => console.log("CLOSED"));
  });
});
