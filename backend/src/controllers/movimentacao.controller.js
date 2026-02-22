const { db, SYSTEM_USER_ID } = require("../db/database");

// helper: garante que existe linha em estoque
function garantirLinhaEstoque(id_variacao) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min)
       VALUES (?, 0, 10)`,
      [id_variacao],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

function registrarMovimentacao(req, res) {
  const id_usuario = req.user?.id_usuario ?? SYSTEM_USER_ID();

  const { id_variacao, tipo, quantidade, observacao } = req.body;

  const idVar = Number(id_variacao);
  const qtd = Number(quantidade);
  const tp = String(tipo || "").toUpperCase();

  const tiposValidos = ["ENTRADA", "SAIDA", "AJUSTE"];
  if (!Number.isFinite(idVar) || idVar <= 0) {
    return res.status(400).json({ erro: "id_variacao inválido." });
  }
  if (!tiposValidos.includes(tp)) {
    return res
      .status(400)
      .json({ erro: "tipo inválido (ENTRADA|SAIDA|AJUSTE)." });
  }
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return res.status(400).json({ erro: "quantidade deve ser > 0." });
  }

  const obs = observacao ? String(observacao).trim() : "";
  if (obs.length === 0) {
    return res
      .status(400)
      .json({ erro: "observacao/motivo é obrigatório para rastreabilidade." });
  }

  db.serialize(async () => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    try {
      // 1) garante estoque
      await garantirLinhaEstoque(idVar);

      // 2) valida variação existe e está ativa
      const sqlVar = `
        SELECT v.id_variacao, v.ativo, COALESCE(e.quantidade,0) AS estoque_atual
        FROM variacao_produto v
        LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
        WHERE v.id_variacao = ?
        LIMIT 1
      `;

      db.get(sqlVar, [idVar], (err, row) => {
        if (err) {
          db.run("ROLLBACK");
          console.error(err);
          return res.status(500).json({ erro: "Erro ao validar variação." });
        }
        if (!row) {
          db.run("ROLLBACK");
          return res
            .status(400)
            .json({ erro: `Variação ${idVar} não existe.` });
        }
        if (row.ativo !== 1) {
          db.run("ROLLBACK");
          return res
            .status(400)
            .json({ erro: `Variação ${idVar} está inativa.` });
        }

        // 3) regra de estoque por tipo
        // ENTRADA: soma
        // SAIDA: subtrai (não pode ficar negativo)
        // AJUSTE: aqui vamos tratar como "ajuste de quantidade" no sentido de somar/subtrair?
        // Para PI simples: AJUSTE se comporta como SAIDA/ENTRADA? Vamos definir:
        // - AJUSTE: altera para MAIS (se qtd positiva) mas motivo obrigatório.
        // Para permitir ajuste para menos sem número negativo, usamos SAIDA com motivo.
        // (Se quiser ajuste +/- depois, a gente amplia.)

        const isSaida = tp === "SAIDA";
        const delta = isSaida ? -qtd : +qtd;

        // 4) se SAIDA, garante que há estoque suficiente
        if (isSaida && row.estoque_atual < qtd) {
          db.run("ROLLBACK");
          return res.status(400).json({
            erro: "Estoque insuficiente.",
            estoque_atual: row.estoque_atual,
            solicitado: qtd,
          });
        }

        // 5) registra movimentação
        const sqlMov = `
          INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.run(sqlMov, [idVar, tp, qtd, obs, id_usuario], function (errMov) {
          if (errMov) {
            db.run("ROLLBACK");
            console.error(errMov);
            return res
              .status(500)
              .json({ erro: "Erro ao registrar movimentação." });
          }

          const id_movimentacao = this.lastID;

          // 6) atualiza estoque (protege SAIDA contra corrida)
          let sqlUpd = `
            UPDATE estoque
            SET quantidade = quantidade + ?, atualizado_em = datetime('now')
            WHERE id_variacao = ?
          `;
          let params = [delta, idVar];

          if (isSaida) {
            sqlUpd = `
              UPDATE estoque
              SET quantidade = quantidade - ?, atualizado_em = datetime('now')
              WHERE id_variacao = ? AND quantidade >= ?
            `;
            params = [qtd, idVar, qtd];
          }

          db.run(sqlUpd, params, function (errUpd) {
            if (errUpd) {
              db.run("ROLLBACK");
              console.error(errUpd);
              return res
                .status(500)
                .json({ erro: "Erro ao atualizar estoque." });
            }

            if (isSaida && this.changes !== 1) {
              db.run("ROLLBACK");
              return res
                .status(400)
                .json({ erro: "Estoque insuficiente (concorrência)." });
            }

            db.run("COMMIT", (errCommit) => {
              if (errCommit) {
                db.run("ROLLBACK");
                console.error(errCommit);
                return res
                  .status(500)
                  .json({ erro: "Erro ao finalizar transação." });
              }

              return res.status(201).json({
                id_movimentacao,
                id_variacao: idVar,
                tipo: tp,
                quantidade: qtd,
                observacao: obs,
                id_usuario,
              });
            });
          });
        });
      });
    } catch (e) {
      db.run("ROLLBACK");
      console.error(e);
      return res.status(500).json({ erro: "Erro inesperado na movimentação." });
    }
  });
}

// histórico PI-friendly (usa a VIEW com nome/email)
function listarMovimentacoes(req, res) {
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const sql = `
    SELECT *
    FROM vw_movimentacao_detalhada
    ORDER BY datetime(criado_em) DESC
    LIMIT ?
  `;

  db.all(sql, [limit], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao listar movimentações." });
    }
    return res.json(rows);
  });
}

module.exports = {
  registrarMovimentacao,
  listarMovimentacoes,
};
