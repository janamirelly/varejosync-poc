// backend/src/controllers/vendas.controller.js
const { db, SYSTEM_USER_ID } = require("../db/database");

// REGISTRAR VENDA (com desconto PDV)
// =========================
function registrarVenda(req, res) {
  const id_usuario = req.user?.id_usuario ?? SYSTEM_USER_ID();
  const { forma_pagamento, itens } = req.body;

  if (!forma_pagamento) {
    return res.status(400).json({ erro: "forma_pagamento é obrigatório." });
  }

  const fp = String(forma_pagamento).toUpperCase();
  const formasValidas = ["DINHEIRO", "CREDITO", "DEBITO", "PIX", "OUTRO"];
  if (!formasValidas.includes(fp)) {
    return res.status(400).json({ erro: "forma_pagamento inválida." });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res
      .status(400)
      .json({ erro: "itens deve ser um array com ao menos 1 item." });
  }

  // Normaliza itens recebidos (inclui desconto no PDV)
  const itensNorm = itens
    .map((i) => ({
      id_variacao: Number(i.id_variacao),
      quantidade: Number(i.quantidade),
      preco_unit: i.preco_unit === undefined ? null : Number(i.preco_unit),

      // desconto no momento da venda (percentual)
      desconto_percent:
        i.desconto_percent === undefined || i.desconto_percent === null
          ? 0
          : Number(i.desconto_percent),

      motivo_desconto:
        i.motivo_desconto === undefined || i.motivo_desconto === null
          ? null
          : String(i.motivo_desconto).trim(),
    }))
    .filter(
      (i) =>
        Number.isFinite(i.id_variacao) &&
        Number.isFinite(i.quantidade) &&
        (i.preco_unit === null || Number.isFinite(i.preco_unit)) &&
        Number.isFinite(i.desconto_percent),
    );

  if (itensNorm.length === 0) {
    return res.status(400).json({ erro: "itens inválidos." });
  }

  // Validações
  for (const it of itensNorm) {
    if (it.preco_unit === null) {
      return res.status(400).json({
        erro: "preco_unit é obrigatório em cada item (proteção contra divergência).",
      });
    }
    if (it.preco_unit < 0) {
      return res.status(400).json({ erro: "preco_unit inválido." });
    }
    if (it.id_variacao <= 0 || it.quantidade <= 0) {
      return res
        .status(400)
        .json({ erro: "id_variacao e quantidade devem ser > 0." });
    }

    // desconto_percent 0..100
    if (it.desconto_percent < 0 || it.desconto_percent > 100) {
      return res
        .status(400)
        .json({ erro: "desconto_percent deve estar entre 0 e 100." });
    }

    // motivo obrigatório se houver desconto
    if (it.desconto_percent > 0) {
      if (!it.motivo_desconto || it.motivo_desconto.length < 3) {
        return res.status(400).json({
          erro: "motivo_desconto é obrigatório (>= 3 caracteres) quando há desconto.",
        });
      }
    }

    // Regra PI: Vendedora até 10% | Gerente pode acima
    const perfil = req.user?.perfil;
    const ehGerente = perfil === "Gerente de Operações";
    if (!ehGerente && it.desconto_percent > 10) {
      return res.status(403).json({
        erro: "Desconto acima de 10% exige Gerente de Operações.",
        desconto_percent: it.desconto_percent,
      });
    }
  }

  const ids = [...new Set(itensNorm.map((i) => i.id_variacao))];
  const placeholders = ids.map(() => "?").join(",");

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    const sqlEnsEstoque = `
      INSERT OR IGNORE INTO estoque (id_variacao, quantidade, estoque_min)
      VALUES (?, 0, 10)
    `;

    let i = 0;
    const garantirTodas = () => {
      if (i >= ids.length) return buscarVariacoes();

      db.run(sqlEnsEstoque, [ids[i]], (e) => {
        if (e) {
          db.run("ROLLBACK");
          console.error(e);
          return res
            .status(500)
            .json({ erro: "Erro ao garantir estoque (venda)." });
        }
        i += 1;
        garantirTodas();
      });
    };

    const sqlVariacoes = `
      SELECT
        v.id_variacao,
        v.preco,
        v.ativo,
        COALESCE(e.quantidade, 0) AS estoque_atual
      FROM variacao_produto v
      LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
      WHERE v.id_variacao IN (${placeholders})
    `;

    const buscarVariacoes = () => {
      db.all(sqlVariacoes, ids, (err, rows) => {
        if (err) {
          db.run("ROLLBACK");
          console.error(err);
          return res
            .status(500)
            .json({ erro: "Erro ao buscar variações/estoque." });
        }

        const map = new Map(rows.map((r) => [r.id_variacao, r]));

        // Valida existência/ativo/preço/estoque
        for (const it of itensNorm) {
          if (!map.has(it.id_variacao)) {
            db.run("ROLLBACK");
            return res
              .status(400)
              .json({ erro: `Variação ${it.id_variacao} não existe.` });
          }

          const row = map.get(it.id_variacao);

          if (row.ativo !== 1) {
            db.run("ROLLBACK");
            return res
              .status(400)
              .json({ erro: `Variação ${it.id_variacao} está inativa.` });
          }

          // Divergência de preço (anti-fraude / consistência PDV)
          const precoDb = Number(row.preco);
          const precoTela = Number(it.preco_unit);

          if (Math.abs(precoDb - precoTela) > 0.01) {
            db.run("ROLLBACK");
            return res.status(409).json({
              erro: "Preço divergente do cadastro. Atualize a tela e tente novamente.",
              id_variacao: it.id_variacao,
              preco_cadastro: precoDb,
              preco_informado: precoTela,
            });
          }

          // valida estoque
          if (row.estoque_atual < it.quantidade) {
            db.run("ROLLBACK");
            return res.status(400).json({
              erro: `Estoque insuficiente para variação ${it.id_variacao}.`,
              estoque_atual: row.estoque_atual,
              solicitado: it.quantidade,
            });
          }
        }

        // Monta itens completos aplicando desconto no subtotal (e preco_unit final)
        const itensCompletos = itensNorm.map((it) => {
          const row = map.get(it.id_variacao);

          const quantidade = Number(it.quantidade);
          const preco_unit_original = Number(row.preco);

          const bruto = Number((preco_unit_original * quantidade).toFixed(2));
          const desconto_percent = Number(it.desconto_percent || 0);
          const desconto_valor = Number(
            ((bruto * desconto_percent) / 100).toFixed(2),
          );

          // segurança: não pode zerar ou inverter subtotal
          if (desconto_valor >= bruto) {
            // aqui ainda estamos dentro da transação, então rollback
            db.run("ROLLBACK");
            throw new Error("Desconto inválido: >= subtotal bruto do item.");
          }

          const subtotal = Number((bruto - desconto_valor).toFixed(2));
          const preco_unit = Number((subtotal / quantidade).toFixed(2)); // final unitário

          return {
            id_variacao: it.id_variacao,
            quantidade,
            preco_unit, // FINAL
            preco_unit_original, // ORIGINAL
            desconto_valor,
            desconto_percent,
            motivo_desconto: it.motivo_desconto || null,
            subtotal, // FINAL
          };
        });

        const total_bruto = Number(
          itensCompletos
            .reduce(
              (acc, it) => acc + it.preco_unit_original * it.quantidade,
              0,
            )
            .toFixed(2),
        );

        const desconto_total = Number(
          itensCompletos
            .reduce((acc, it) => acc + (it.desconto_valor || 0), 0)
            .toFixed(2),
        );

        const total = Number(
          itensCompletos.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2),
        );

        const sqlVenda = `
          INSERT INTO venda (id_usuario, status, forma_pagamento, total, total_bruto, desconto_total)
          VALUES (?, 'CONCLUIDA', ?, ?, ?, ?)
        `;

        db.run(
          sqlVenda,
          [id_usuario, fp, total, total_bruto, desconto_total],
          function (err2) {
            if (err2) {
              db.run("ROLLBACK");
              console.error(err2);
              return res.status(500).json({ erro: "Erro ao registrar venda." });
            }

            const id_venda = this.lastID;

            let idx = 0;
            const proximo = () => {
              if (idx >= itensCompletos.length) {
                return db.run("COMMIT", (errCommit) => {
                  if (errCommit) {
                    db.run("ROLLBACK");
                    console.error(errCommit);
                    return res
                      .status(500)
                      .json({ erro: "Falha ao finalizar transação." });
                  }

                  return res.status(201).json({
                    id_venda,
                    forma_pagamento: fp,
                    total,
                    total_bruto,
                    desconto_total,
                    itens: itensCompletos,
                  });
                });
              }

              const it = itensCompletos[idx];

              const sqlItem = `
                INSERT INTO item_venda (
                  id_venda,
                  id_variacao,
                  quantidade,
                  preco_unit_original,
                  desconto_percent,
                  desconto_valor,
                  motivo_desconto,
                  preco_unit,
                  subtotal
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              db.run(
                sqlItem,
                [
                  id_venda,
                  it.id_variacao,
                  it.quantidade,
                  it.preco_unit_original,
                  it.desconto_percent,
                  it.desconto_valor,
                  it.motivo_desconto,
                  it.preco_unit,
                  it.subtotal,
                ],
                function (errItem) {
                  if (errItem) {
                    db.run("ROLLBACK");
                    console.error(errItem);
                    return res
                      .status(500)
                      .json({ erro: "Erro ao inserir item da venda." });
                  }

                  const sqlMov = `
                  INSERT INTO movimentacao_estoque (id_variacao, tipo, quantidade, observacao, id_usuario)
                  VALUES (?, 'SAIDA', ?, ?, ?)
                `;

                  db.run(
                    sqlMov,
                    [
                      it.id_variacao,
                      it.quantidade,
                      `Venda #${id_venda}`,
                      id_usuario,
                    ],
                    function (errMov) {
                      if (errMov) {
                        db.run("ROLLBACK");
                        console.error(errMov);
                        return res.status(500).json({
                          erro: "Erro ao registrar movimentação de estoque.",
                        });
                      }

                      const sqlUpd = `
                      UPDATE estoque
                      SET quantidade = quantidade - ?, atualizado_em = datetime('now')
                      WHERE id_variacao = ? AND quantidade >= ?
                    `;

                      db.run(
                        sqlUpd,
                        [it.quantidade, it.id_variacao, it.quantidade],
                        function (errUpd) {
                          if (errUpd) {
                            db.run("ROLLBACK");
                            console.error(errUpd);
                            return res
                              .status(500)
                              .json({ erro: "Erro ao dar baixa no estoque." });
                          }

                          if (this.changes !== 1) {
                            db.run("ROLLBACK");
                            return res.status(400).json({
                              erro: "Estoque insuficiente (concorrência) ou variação sem estoque.",
                              id_variacao: it.id_variacao,
                            });
                          }

                          idx += 1;
                          proximo();
                        },
                      );
                    },
                  );
                },
              );
            };

            proximo();
          },
        );
      });
    };

    try {
      garantirTodas();
    } catch (e) {
      // fallback de erro no map (desconto inválido etc.)
      console.error("[VENDAS] registrarVenda erro:", e.message);
      // se ainda estiver em transação, tenta rollback
      try {
        db.run("ROLLBACK");
      } catch (_) {}
      return res.status(400).json({ erro: e.message });
    }
  });
}
// =========================
// CANCELAR VENDA
// =========================

function cancelarVenda(req, res) {
  //  agora a rota usa /vendas/:id_venda/cancelar
  const id_venda = Number(req.params.id_venda);

  const { motivo } = req.body || {};
  const motivoTxt = String(motivo || "").trim();

  if (!Number.isFinite(id_venda) || id_venda <= 0) {
    return res.status(400).json({ erro: "id_venda inválido." });
  }

  if (!motivoTxt) {
    return res
      .status(400)
      .json({ erro: "motivo é obrigatório para cancelar." });
  }

  const id_usuario = req.user?.id_usuario ?? SYSTEM_USER_ID();

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    db.get(
      `SELECT id_venda, status, criado_em
       FROM venda
       WHERE id_venda = ? LIMIT 1`,
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
            erro: "Venda não pode ser cancelada (status atual).",
            status: venda.status,
          });
        }

        //  REGRA: só pode cancelar no mesmo dia
        const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const diaVenda = String(venda.criado_em).slice(0, 10);

        if (diaVenda !== hoje) {
          db.run("ROLLBACK");
          return res.status(403).json({
            erro: "Cancelamento permitido apenas no mesmo dia da venda.",
            data_venda: diaVenda,
            data_atual: hoje,
          });
        }

        // ATENÇÃO:
        // O bloqueio fiscal (doc EMITIDA) foi removido daqui.
        // Ele deve ser aplicado na rota via middleware blockIfFiscalEmitida("id_venda").

        // Fluxo normal do cancelamento (entra aqui se passou nas regras acima)
        db.all(
          `SELECT id_variacao, quantidade
           FROM item_venda
           WHERE id_venda = ?`,
          [id_venda],
          (err2, itens) => {
            if (err2) {
              db.run("ROLLBACK");
              console.error(err2);
              return res.status(500).json({ erro: "Erro ao buscar itens." });
            }

            if (!itens || itens.length === 0) {
              db.run("ROLLBACK");
              return res
                .status(400)
                .json({ erro: "Venda sem itens (inconsistente)." });
            }

            db.run(
              `UPDATE venda
               SET status = 'CANCELADA',
                   motivo_cancelamento = ?
               WHERE id_venda = ? AND status = 'CONCLUIDA'`,
              [motivoTxt, id_venda],
              function (err3) {
                if (err3) {
                  db.run("ROLLBACK");
                  console.error(err3);
                  return res
                    .status(500)
                    .json({ erro: "Erro ao cancelar venda." });
                }

                if (this.changes !== 1) {
                  db.run("ROLLBACK");
                  return res
                    .status(400)
                    .json({ erro: "Venda já foi cancelada ou alterada." });
                }

                let idx = 0;

                const proximo = () => {
                  if (idx >= itens.length) {
                    return db.run("COMMIT", (errCommit) => {
                      if (errCommit) {
                        db.run("ROLLBACK");
                        console.error(errCommit);
                        return res.status(500).json({
                          erro: "Falha ao finalizar cancelamento.",
                        });
                      }

                      return res.json({
                        ok: true,
                        id_venda,
                        status: "CANCELADA",
                        motivo: motivoTxt,
                        estorno_itens: itens.length,
                      });
                    });
                  }

                  const it = itens[idx];

                  db.run(
                    `INSERT INTO movimentacao_estoque
                     (id_variacao, tipo, quantidade, observacao, id_usuario)
                     VALUES (?, 'ENTRADA', ?, ?, ?)`,
                    [
                      it.id_variacao,
                      it.quantidade,
                      `Estorno Venda #${id_venda} | Motivo: ${motivoTxt}`,
                      id_usuario,
                    ],
                    (errMov) => {
                      if (errMov) {
                        db.run("ROLLBACK");
                        console.error(errMov);
                        return res.status(500).json({
                          erro: "Erro ao registrar estorno (movimentação).",
                        });
                      }

                      db.run(
                        `UPDATE estoque
                         SET quantidade = quantidade + ?, atualizado_em = datetime('now')
                         WHERE id_variacao = ?`,
                        [it.quantidade, it.id_variacao],
                        function (errUpd) {
                          if (errUpd) {
                            db.run("ROLLBACK");
                            console.error(errUpd);
                            return res
                              .status(500)
                              .json({ erro: "Erro ao estornar estoque." });
                          }

                          if (this.changes !== 1) {
                            db.run("ROLLBACK");
                            return res.status(400).json({
                              erro: "Variação sem linha em estoque (inconsistente).",
                              id_variacao: it.id_variacao,
                            });
                          }

                          idx += 1;
                          proximo();
                        },
                      );
                    },
                  );
                };

                proximo();
              },
            );
          },
        );
      },
    );
  });
}

// =========================
// DEVOLVER VENDA
// =========================
function devolverVenda(req, res) {
  const id_venda = Number(req.params.id);
  const { motivo } = req.body || {};
  const motivoTxt = String(motivo || "").trim();

  const PRAZO_DEVOLUCAO_DIAS = 7;

  if (!Number.isFinite(id_venda) || id_venda <= 0) {
    return res.status(400).json({ erro: "id_venda inválido." });
  }
  if (!motivoTxt) {
    return res
      .status(400)
      .json({ erro: "motivo é obrigatório para devolução." });
  }

  const id_usuario = req.user?.id_usuario ?? SYSTEM_USER_ID();

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    db.get(
      `SELECT id_venda, status, criado_em FROM venda WHERE id_venda = ? LIMIT 1`,
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
          return res.status(409).json({
            erro: "Venda não pode ser devolvida (status atual).",
            status: venda.status,
          });
        }

        // Prazo (assumindo criado_em como UTC "YYYY-MM-DD HH:MM:SS")
        const createdMs = Date.parse(
          String(venda.criado_em).replace(" ", "T") + "Z",
        );
        if (!Number.isFinite(createdMs)) {
          db.run("ROLLBACK");
          return res
            .status(500)
            .json({ erro: "Data da venda inválida no banco." });
        }

        const diffDias = (Date.now() - createdMs) / 86400000;
        if (diffDias > PRAZO_DEVOLUCAO_DIAS) {
          db.run("ROLLBACK");
          return res.status(403).json({
            erro: `Devolução permitida apenas até ${PRAZO_DEVOLUCAO_DIAS} dias após a venda.`,
            criado_em: venda.criado_em,
            dias_passados: Number(diffDias.toFixed(2)),
          });
        }

        // BLOQUEIO: se existe documento fiscal EMITIDA -> cancelar fiscal antes
        db.get(
          `SELECT id_documento, status FROM documento_fiscal WHERE id_venda = ?`,
          [id_venda],
          (eDoc, doc) => {
            if (eDoc) {
              db.run("ROLLBACK");
              console.error(eDoc);
              return res
                .status(500)
                .json({ erro: "Erro ao verificar documento fiscal." });
            }

            if (doc && doc.status === "EMITIDA") {
              db.run("ROLLBACK");
              return res.status(403).json({
                erro: "Venda possui documento fiscal EMITIDO. Cancele o fiscal antes de devolver.",
                documento: doc,
              });
            }

            // Buscar itens
            db.all(
              `SELECT id_variacao, quantidade
               FROM item_venda
               WHERE id_venda = ?`,
              [id_venda],
              (err2, itens) => {
                if (err2) {
                  db.run("ROLLBACK");
                  console.error(err2);
                  return res
                    .status(500)
                    .json({ erro: "Erro ao buscar itens." });
                }
                if (!itens || itens.length === 0) {
                  db.run("ROLLBACK");
                  return res
                    .status(400)
                    .json({ erro: "Venda sem itens (inconsistente)." });
                }

                // Atualiza venda para DEVOLVIDA
                db.run(
                  `UPDATE venda
                   SET status='DEVOLVIDA',
                       motivo_devolucao=?,
                       devolvido_em=datetime('now')
                   WHERE id_venda=? AND status='CONCLUIDA'`,
                  [motivoTxt, id_venda],
                  function (err3) {
                    if (err3) {
                      db.run("ROLLBACK");
                      console.error(err3);
                      return res
                        .status(500)
                        .json({ erro: "Erro ao registrar devolução." });
                    }
                    if (this.changes !== 1) {
                      db.run("ROLLBACK");
                      return res.status(400).json({
                        erro: "Venda já foi alterada por outro processo.",
                      });
                    }

                    // Estornar estoque item a item
                    let idx = 0;
                    const proximo = () => {
                      if (idx >= itens.length) {
                        return db.run("COMMIT", (errCommit) => {
                          if (errCommit) {
                            db.run("ROLLBACK");
                            console.error(errCommit);
                            return res
                              .status(500)
                              .json({ erro: "Falha ao finalizar devolução." });
                          }

                          return res.json({
                            ok: true,
                            id_venda,
                            status: "DEVOLVIDA",
                            motivo: motivoTxt,
                            estorno_itens: itens.length,
                          });
                        });
                      }

                      const it = itens[idx];

                      db.run(
                        `INSERT INTO movimentacao_estoque
                         (id_variacao, tipo, quantidade, observacao, id_usuario)
                         VALUES (?, 'ENTRADA', ?, ?, ?)`,
                        [
                          it.id_variacao,
                          it.quantidade,
                          `Devolução Venda #${id_venda} | Motivo: ${motivoTxt}`,
                          id_usuario,
                        ],
                        (errMov) => {
                          if (errMov) {
                            db.run("ROLLBACK");
                            console.error(errMov);
                            return res.status(500).json({
                              erro: "Erro ao registrar movimentação de devolução.",
                            });
                          }

                          db.run(
                            `UPDATE estoque
                             SET quantidade = quantidade + ?, atualizado_em = datetime('now')
                             WHERE id_variacao = ?`,
                            [it.quantidade, it.id_variacao],
                            function (errUpd) {
                              if (errUpd) {
                                db.run("ROLLBACK");
                                console.error(errUpd);
                                return res.status(500).json({
                                  erro: "Erro ao estornar estoque (devolução).",
                                });
                              }

                              idx += 1;
                              proximo();
                            },
                          );
                        },
                      );
                    };

                    proximo();
                  },
                );
              },
            );
          },
        );
      },
    );
  });
}

// helpers
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// PATCH /vendas/:id_venda/itens/:id_item/desconto
async function aplicarDescontoItem(req, res) {
  try {
    const idVenda = Number(req.params.id_venda);
    const idItem = Number(req.params.id_item);

    if (!Number.isFinite(idVenda) || idVenda <= 0)
      return res.status(400).json({ erro: "id_venda inválido." });
    if (!Number.isFinite(idItem) || idItem <= 0)
      return res.status(400).json({ erro: "id_item inválido." });

    const { tipo, valor, motivo } = req.body || {};
    const t = String(tipo || "").toLowerCase();
    const v = Number(valor);

    if (!["percent", "valor"].includes(t)) {
      return res
        .status(400)
        .json({ erro: "tipo deve ser 'percent' ou 'valor'." });
    }
    if (!Number.isFinite(v) || v <= 0) {
      return res.status(400).json({ erro: "valor inválido (deve ser > 0)." });
    }
    if (!motivo || String(motivo).trim().length < 3) {
      return res
        .status(400)
        .json({ erro: "motivo é obrigatório (>= 3 caracteres)." });
    }

    // 1) valida venda e status
    const venda = await getAsync(
      `SELECT id_venda, status FROM venda WHERE id_venda = ?`,
      [idVenda],
    );
    if (!venda) return res.status(404).json({ erro: "Venda não encontrada." });

    if (venda.status !== "CONCLUIDA") {
      return res
        .status(403)
        .json({ erro: "Só é permitido desconto em venda CONCLUIDA." });
    }

    // 2) carrega item
    const item = await getAsync(
      `
      SELECT id_item, id_venda, quantidade, preco_unit, subtotal,
             COALESCE(preco_unit_original, preco_unit) AS preco_unit_original
      FROM item_venda
      WHERE id_item = ? AND id_venda = ?
      `,
      [idItem, idVenda],
    );
    if (!item)
      return res
        .status(404)
        .json({ erro: "Item não encontrado para essa venda." });

    const qtd = Number(item.quantidade);
    const unitOriginal = Number(item.preco_unit_original);
    const bruto = round2(unitOriginal * qtd);

    // 3) calcula desconto
    let descontoValor = 0;
    let descontoPercent = 0;

    if (t === "percent") {
      descontoPercent = v;
      descontoValor = round2((bruto * descontoPercent) / 100);
    } else {
      descontoValor = round2(v);
      descontoPercent = round2((descontoValor / bruto) * 100);
    }

    // limites de segurança
    if (descontoValor >= bruto) {
      return res
        .status(400)
        .json({ erro: "Desconto não pode ser >= ao subtotal bruto do item." });
    }

    // 4) regra de autorização (PI)
    // Vendedora: até 10% | Gerente: qualquer valor
    const perfil = req.user?.perfil; // do auth middleware
    const ehGerente = perfil === "Gerente de Operações";

    if (!ehGerente && descontoPercent > 10) {
      return res.status(403).json({
        erro: "Desconto acima de 10% exige autorização do Gerente de Operações.",
        desconto_percent: descontoPercent,
      });
    }

    // 5) grava item: mantém preco_unit e subtotal como FINAL (compatível com seu sistema)
    const subtotalFinal = round2(bruto - descontoValor);
    const unitFinal = round2(subtotalFinal / qtd);

    await runAsync(
      `
      UPDATE item_venda
      SET
        preco_unit_original = COALESCE(preco_unit_original, preco_unit),
        desconto_valor = ?,
        desconto_percent = ?,
        motivo_desconto = ?,
        preco_unit = ?,
        subtotal = ?
      WHERE id_item = ? AND id_venda = ?
      `,
      [
        descontoValor,
        descontoPercent,
        String(motivo).trim(),
        unitFinal,
        subtotalFinal,
        idItem,
        idVenda,
      ],
    );

    // 6) recalcula venda (total = líquido; total_bruto e desconto_total = PI-friendly)
    const itens = await allAsync(
      `
      SELECT
        quantidade,
        COALESCE(preco_unit_original, preco_unit) AS preco_unit_original,
        subtotal,
        desconto_valor
      FROM item_venda
      WHERE id_venda = ?
      `,
      [idVenda],
    );

    const totalBruto = round2(
      itens.reduce(
        (acc, it) =>
          acc + Number(it.quantidade) * Number(it.preco_unit_original),
        0,
      ),
    );
    const totalLiquido = round2(
      itens.reduce((acc, it) => acc + Number(it.subtotal), 0),
    );
    const descontoTotal = round2(
      itens.reduce((acc, it) => acc + Number(it.desconto_valor || 0), 0),
    );

    await runAsync(
      `
      UPDATE venda
      SET total_bruto = ?, desconto_total = ?, total = ?
      WHERE id_venda = ?
      `,
      [totalBruto, descontoTotal, totalLiquido, idVenda],
    );

    return res.json({
      ok: true,
      id_venda: idVenda,
      id_item: idItem,
      subtotal_bruto: bruto,
      desconto_valor: descontoValor,
      desconto_percent: descontoPercent,
      subtotal_final: subtotalFinal,
      total_venda_bruto: totalBruto,
      total_venda_desconto: descontoTotal,
      total_venda_final: totalLiquido,
    });
  } catch (err) {
    console.error("[VENDAS] aplicarDescontoItem erro:", err);
    return res.status(500).json({ erro: "Erro ao aplicar desconto." });
  }
}

module.exports = {
  registrarVenda,
  cancelarVenda,
  devolverVenda,
  aplicarDescontoItem,
};
