const { db } = require("../db/database");

// Middleware: lê Authorization: Bearer <token>
// Token POC: base64("id:email")
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ erro: "Token ausente. Use Authorization: Bearer <token>" });
  }

  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return res.status(401).json({ erro: "Token inválido." });
  }

  const [idStr, email] = decoded.split(":");
  const id_usuario = Number(idStr);

  if (!Number.isFinite(id_usuario) || id_usuario <= 0 || !email) {
    return res.status(401).json({ erro: "Token inválido." });
  }

  // valida no banco (garante que usuário existe e está ativo)
  const sql = `
    SELECT u.id_usuario, u.nome, u.email, u.id_perfil, p.nome AS perfil, u.ativo
    FROM usuario u
    JOIN perfil p ON p.id_perfil = u.id_perfil
    WHERE u.id_usuario = ? AND lower(u.email) = ?
    LIMIT 1
  `;

  db.get(sql, [id_usuario, String(email).toLowerCase()], (err, user) => {
    if (err) {
      console.error("[AUTH] middleware erro:", err);
      return res.status(500).json({ erro: "Erro ao validar usuário." });
    }
    if (!user || user.ativo !== 1) {
      return res
        .status(401)
        .json({ erro: "Token inválido ou usuário inativo." });
    }

    req.user = {
      id_usuario: user.id_usuario,
      nome: user.nome,
      email: user.email,
      id_perfil: user.id_perfil,
      perfil: user.perfil,
    };

    next();
  });
}

module.exports = { authMiddleware };
