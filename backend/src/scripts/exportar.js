const fs = require("fs");
const { db } = require("../db/database");

const sql = `
SELECT *
FROM vw_dashboard_criticos_por_produto
ORDER BY itens_criticos DESC, produto
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (!rows.length) {
    console.log("Sem dados");
    process.exit(0);
  }

  const header = Object.keys(rows[0]).join(",");
  const lines = rows.map((r) => Object.values(r).join(","));
  const csv = [header, ...lines].join("\n");

  fs.writeFileSync("evid_criticos_por_produto.csv", csv);
  console.log("CSV gerado com sucesso.");
  process.exit(0);
});
