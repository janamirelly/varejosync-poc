const { db } = require("../db/database");

function authorizeRoles(...perfisPermitidos) {
  return (req, res, next) => {
    const perfil = req.user?.perfil;
    const id_usuario = req.user?.id_usuario ?? null;

    if (!perfil) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!perfisPermitidos.includes(perfil)) {
      // tenta auditar, sem quebrar a rota
      const recurso = req.originalUrl || req.url || "";
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.ip;
      const user_agent = req.headers["user-agent"] || "";

      let detalhes = null;
      try {
        detalhes = JSON.stringify({
          metodo: req.method,
          perfil_atual: perfil,
          permitido: perfisPermitidos,
        });
      } catch {
        detalhes = null;
      }

      db.run(
        `INSERT INTO auditoria (id_usuario, acao, recurso, detalhes, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_usuario, "ACESSO_NEGADO", recurso, detalhes, ip, user_agent],
        () => {
          // falha silenciosa
          return res.status(403).json({
            erro: "Acesso negado para este perfil.",
            perfil_atual: perfil,
            permitido: perfisPermitidos,
          });
        },
      );

      return; // importante para não cair no next()
    }

    return next();
  };
}

module.exports = { authorizeRoles };
