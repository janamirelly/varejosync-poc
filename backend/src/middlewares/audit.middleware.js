const { db } = require("../db/database");

/**
 * audit(acao)
 * - acao: string (ex: "VENDA_REGISTRADA")
 * Registra auditoria sem quebrar a rota (falha silenciosa se der erro).
 */
function audit(acao) {
  return (req, res, next) => {
    // captura info básica
    const id_usuario = req.user?.id_usuario ?? null;
    const recurso = req.originalUrl || req.url || "";
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.ip;
    const user_agent = req.headers["user-agent"] || "";

    // detalhes (compacto e seguro para PI)
    let detalhes = null;
    try {
      detalhes = JSON.stringify({
        params: req.params || {},
        query: req.query || {},
        body: req.body || {},
      });
    } catch {
      detalhes = null;
    }

    const sql = `
      INSERT INTO auditoria (id_usuario, acao, recurso, detalhes, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [id_usuario, acao, recurso, detalhes, ip, user_agent],
      (err) => {
        if (err) console.error("[AUDIT] erro:", err.message);
        return next();
      },
    );
  };
}

module.exports = { audit };
