const { db } = require("../db/database");

function blockIfFiscalEmitida(paramName = "id_venda") {
  return (req, res, next) => {
    const id_venda = Number(req.params[paramName]);

    if (!Number.isFinite(id_venda) || id_venda <= 0) {
      return res.status(400).json({ erro: "id_venda inválido." });
    }

    db.get(
      `SELECT status, numero, chave_acesso
       FROM documento_fiscal
       WHERE id_venda = ?`,
      [id_venda],
      (err, doc) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ erro: "Erro ao validar bloqueio fiscal." });
        }

        if (!doc) return next();

        if (doc.status === "EMITIDA") {
          return res.status(403).json({
            erro: "BLOQUEIO_FISCAL",
            mensagem:
              "Operação não permitida: venda possui documento fiscal EMITIDO. Cancele o documento fiscal antes.",
            id_venda,
            documento_fiscal: {
              status: doc.status,
              numero: doc.numero,
              chave_acesso: doc.chave_acesso,
            },
          });
        }

        return next();
      },
    );
  };
}

module.exports = { blockIfFiscalEmitida };
