const { db } = require("../db/database");

// gera número fiscal incremental (simples para PI)
function proximoNumero(callback) {
  db.get(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS prox FROM documento_fiscal`,
    [],
    (err, row) => {
      if (err) return callback(err);
      callback(null, row.prox);
    },
  );
}

// POST /fiscal/emitir/:id_venda
function emitirDocumento(req, res) {
  const id_venda = Number(req.params.id_venda);
  if (!Number.isFinite(id_venda) || id_venda <= 0) {
    return res.status(400).json({ erro: "id_venda inválido." });
  }

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    db.get(
      `SELECT id_venda, status, total FROM venda WHERE id_venda = ?`,
      [id_venda],
      (err, venda) => {
        if (err) {
          db.run("ROLLBACK");
          console.error(err);
          return res.status(500).json({ erro: "Erro ao buscar venda." });
        }
        if (!venda) {
          db.run("ROLLBACK");
          return res.status(404).json({ erro: "Venda não encontrada." });
        }
        if (venda.status !== "CONCLUIDA") {
          db.run("ROLLBACK");
          return res.status(400).json({
            erro: "Documento fiscal só pode ser emitido para venda CONCLUIDA.",
            status: venda.status,
          });
        }

        // já existe documento?
        db.get(
          `SELECT id_documento, status FROM documento_fiscal WHERE id_venda = ?`,
          [id_venda],
          (err2, doc) => {
            if (err2) {
              db.run("ROLLBACK");
              console.error(err2);
              return res
                .status(500)
                .json({ erro: "Erro ao verificar documento." });
            }
            if (doc) {
              db.run("ROLLBACK");
              return res.status(409).json({
                erro: "Venda já possui documento fiscal.",
                documento: doc,
              });
            }

            proximoNumero((err3, numero) => {
              if (err3) {
                db.run("ROLLBACK");
                console.error(err3);
                return res
                  .status(500)
                  .json({ erro: "Erro ao gerar número fiscal." });
              }

              // chave simulada (PI): DF-<id_venda>-<numero>
              const chave = `DF-${id_venda}-${numero}`;

              db.run(
                `INSERT INTO documento_fiscal (id_venda, numero, serie, status, chave_acesso, valor_total)
                 VALUES (?, ?, '1', 'EMITIDA', ?, ?)`,
                [id_venda, numero, chave, venda.total],
                function (err4) {
                  if (err4) {
                    db.run("ROLLBACK");
                    console.error(err4);
                    return res
                      .status(500)
                      .json({ erro: "Erro ao emitir documento fiscal." });
                  }

                  db.run("COMMIT", (errC) => {
                    if (errC) {
                      db.run("ROLLBACK");
                      console.error(errC);
                      return res
                        .status(500)
                        .json({ erro: "Falha ao finalizar emissão." });
                    }

                    return res.status(201).json({
                      ok: true,
                      id_documento: this.lastID,
                      id_venda,
                      numero,
                      serie: "1",
                      status: "EMITIDA",
                      chave_acesso: chave,
                      valor_total: venda.total,
                    });
                  });
                },
              );
            });
          },
        );
      },
    );
  });
}

// PUT /fiscal/cancelar/:id_venda
function cancelarDocumento(req, res) {
  const id_venda = Number(req.params.id_venda);
  const { motivo } = req.body || {};
  const motivoTxt = String(motivo || "").trim();

  if (!Number.isFinite(id_venda) || id_venda <= 0) {
    return res.status(400).json({ erro: "id_venda inválido." });
  }
  if (!motivoTxt) {
    return res
      .status(400)
      .json({ erro: "motivo é obrigatório para cancelamento fiscal." });
  }

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    db.get(
      `SELECT id_documento, status FROM documento_fiscal WHERE id_venda = ?`,
      [id_venda],
      (err, doc) => {
        if (err) {
          db.run("ROLLBACK");
          console.error(err);
          return res
            .status(500)
            .json({ erro: "Erro ao buscar documento fiscal." });
        }
        if (!doc) {
          db.run("ROLLBACK");
          return res
            .status(404)
            .json({ erro: "Documento fiscal não encontrado para esta venda." });
        }
        if (doc.status !== "EMITIDA") {
          db.run("ROLLBACK");
          return res.status(400).json({
            erro: "Documento já está cancelado (ou status inválido).",
            status: doc.status,
          });
        }

        db.run(
          `UPDATE documento_fiscal
           SET status = 'CANCELADA',
               cancelado_em = datetime('now'),
               motivo_cancelamento = ?
           WHERE id_venda = ? AND status = 'EMITIDA'`,
          [motivoTxt, id_venda],
          function (err2) {
            if (err2) {
              db.run("ROLLBACK");
              console.error(err2);
              return res
                .status(500)
                .json({ erro: "Erro ao cancelar documento fiscal." });
            }
            if (this.changes !== 1) {
              db.run("ROLLBACK");
              return res
                .status(400)
                .json({ erro: "Documento não foi cancelado (concorrência)." });
            }

            db.run("COMMIT", (errC) => {
              if (errC) {
                db.run("ROLLBACK");
                console.error(errC);
                return res
                  .status(500)
                  .json({ erro: "Falha ao finalizar cancelamento fiscal." });
              }

              return res.json({
                ok: true,
                id_venda,
                status: "CANCELADA",
                motivo: motivoTxt,
              });
            });
          },
        );
      },
    );
  });
}

module.exports = {
  emitirDocumento,
  cancelarDocumento,
};
