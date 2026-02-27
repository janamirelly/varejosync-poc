const fs = require("fs");
const path = require("path");

// DB da banca (repo)
const dbFile =
  process.env.DB_PATH || path.resolve(process.cwd(), "db", "varejosync.db");

if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log("OK: removido", dbFile);
} else {
  console.log("DB não existe:", dbFile);
}
