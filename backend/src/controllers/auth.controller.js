const { db } = require("../db/database");

// Login POC: recebe { email } (ou { id_usuario, email })
// Retorna token base64("id:email") compatível com authMiddleware
function login(req, res) {
  console.log("[AUTH LOGIN] body =", req.body);

  try {
    const { email, id_usuario } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ erro: "email é obrigatório." });
    }

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm.includes("@")) {
      return res.status(400).json({ erro: "email inválido." });
    }

    // Se vier id_usuario, valida também. Se não vier, busca só por email.
    const id = id_usuario !== undefined ? Number(id_usuario) : null;
    if (id_usuario !== undefined && (!Number.isFinite(id) || id <= 0)) {
      return res.status(400).json({ erro: "id_usuario inválido." });
    }

    const sql = `
      SELECT u.id_usuario, u.nome, u.email, u.ativo, p.nome AS perfil
      FROM usuario u
      JOIN perfil p ON p.id_perfil = u.id_perfil
      WHERE lower(u.email) = ?
        ${id ? "AND u.id_usuario = ?" : ""}
      LIMIT 1
    `;

    const params = id ? [emailNorm, id] : [emailNorm];

    db.get(sql, params, (err, user) => {
      if (err) {
        console.error("[AUTH] login erro:", err);
        return res.status(500).json({ erro: "Erro ao consultar usuário." });
      }

      if (!user) {
        return res.status(401).json({ erro: "Usuário não encontrado." });
      }

      if (user.ativo !== 1) {
        return res.status(401).json({ erro: "Usuário inativo." });
      }

      // Token POC compatível com authMiddleware: base64("id:email")
      const payload = `${user.id_usuario}:${user.email.toLowerCase()}`;
      const token = Buffer.from(payload, "utf8").toString("base64");

      return res.json({
        token,
        usuario: {
          id_usuario: user.id_usuario,
          nome: user.nome,
          email: user.email,
          perfil: user.perfil,
        },
      });
    });
  } catch (e) {
    console.error("[AUTH] login exception:", e);
    return res.status(500).json({ erro: "Falha inesperada no login." });
  }
}

module.exports = { login };
