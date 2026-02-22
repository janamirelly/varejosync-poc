// backend/src/utils/auditoria.js
const { db } = require("../db/database");

/**
 * Registrar auditoria de forma segura.
 * Retorna Promise para permitir uso com .catch()
 */
function registrarAuditoria({
  id_usuario = null,
  acao,
  recurso,
  detalhes = null,
  ip = null,
  user_agent = null,
}) {
  return new Promise((resolve, reject) => {
    // proteção mínima
    if (!acao || !recurso) return resolve(false);

    let detalhesTxt = null;
    try {
      detalhesTxt = detalhes ? JSON.stringify(detalhes) : null;
    } catch {
      detalhesTxt = null;
    }

    db.run(
      `INSERT INTO auditoria (id_usuario, acao, recurso, detalhes, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_usuario, acao, recurso, detalhesTxt, ip, user_agent],
      function (err) {
        if (err) return reject(err);
        return resolve(true);
      },
    );
  });
}

module.exports = { registrarAuditoria };
