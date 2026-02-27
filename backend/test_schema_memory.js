const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const schemaPath = path.resolve(__dirname, "src/db/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

const db = new sqlite3.Database(":memory:", (err) => {
  if (err) throw err;
  console.log("OPEN :memory: ok");

  db.exec(schema, (e) => {
    console.log("EXEC schema:", e ? e.message : "ok");
    db.close(() => console.log("CLOSED"));
  });
});
