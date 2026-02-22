const { db } = require("../db/database");
function isValidDateYYYYMMDD(s) {
  if (!s || typeof s !== "string") return false;
  // valida formato
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;

  // valida data real (evita 2026-02-99)
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;

  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` === s;
}

function normalizePeriodo(req, res, { required = false } = {}) {
  const { inicio, fim } = req.query;

  if (required) {
    if (!inicio || !fim) {
      res
        .status(400)
        .json({ erro: "inicio e fim são obrigatórios (YYYY-MM-DD)." });
      return null;
    }
  }

  if (inicio && !isValidDateYYYYMMDD(inicio)) {
    res.status(400).json({ erro: "inicio inválido. Use YYYY-MM-DD." });
    return null;
  }

  if (fim && !isValidDateYYYYMMDD(fim)) {
    res.status(400).json({ erro: "fim inválido. Use YYYY-MM-DD." });
    return null;
  }

  if (inicio && fim && inicio > fim) {
    res.status(400).json({ erro: "intervalo inválido: inicio > fim." });
    return null;
  }

  return { inicio: inicio || null, fim: fim || null };
}

function vendasPorPeriodo(req, res) {
  const periodo = normalizePeriodo(req, res, { required: false });
  if (!periodo) return;
  const { inicio, fim } = periodo;

  let sql = `
    SELECT dia, status, qtd_vendas, total
    FROM vw_relatorio_vendas_periodo
    WHERE 1=1
  `;
  const params = [];

  if (inicio) {
    sql += ` AND dia >= ?`;
    params.push(inicio);
  }
  if (fim) {
    sql += ` AND dia <= ?`;
    params.push(fim);
  }

  sql += ` ORDER BY dia DESC, status`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro ao gerar relatório." });
    return res.json(rows);
  });
}

function topProdutos(req, res) {
  const periodo = normalizePeriodo(req, res, { required: false });
  if (!periodo) return;
  const { inicio, fim } = periodo;

  const { limite } = req.query.limite;

  const lim = Math.min(Number(limite) || 10, 50);

  let sql = `
    SELECT produto, SUM(unidades) AS unidades, SUM(receita) AS receita
    FROM vw_relatorio_top_produtos_dia
    WHERE 1=1
  `;
  const params = [];

  if (inicio) {
    sql += ` AND dia >= ?`;
    params.push(inicio);
  }
  if (fim) {
    sql += ` AND dia <= ?`;
    params.push(fim);
  }

  sql += `
    GROUP BY produto
    ORDER BY unidades DESC
    LIMIT ?
  `;
  params.push(lim);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro ao gerar relatório." });
    return res.json(rows);
  });
}

function fechamentoCaixa(req, res) {
  const periodo = normalizePeriodo(req, res, { required: false });
  if (!periodo) return;
  const { inicio, fim } = periodo;

  let sql = `
    SELECT
      dia,
      qtd_concluidas, total_concluidas, ticket_medio,
      qtd_canceladas, total_canceladas,
      total_dinheiro, total_credito, total_debito, total_pix, total_outro
    FROM vw_relatorio_fechamento_caixa_dia
    WHERE 1=1
  `;
  const params = [];

  if (inicio) {
    sql += ` AND dia >= ?`;
    params.push(inicio);
  }

  if (fim) {
    sql += ` AND dia <= ?`;
    params.push(fim);
  }

  sql += ` ORDER BY dia DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("[REL] fechamento-caixa erro:", err.message);
      return res
        .status(500)
        .json({ erro: "Erro ao gerar fechamento de caixa." });
    }
    return res.json(rows);
  });
}

function fiscalPorPeriodo(req, res) {
  const periodo = normalizePeriodo(req, res, { required: true });
  if (!periodo) return;

  const { inicio, fim } = periodo;

  const sql = `
    SELECT dia, status, qtd_documentos, total
    FROM vw_relatorio_fiscal_periodo
    WHERE dia >= ? AND dia <= ?
    ORDER BY dia DESC, status
  `;

  db.all(sql, [inicio, fim], (err, rows) => {
    if (err) {
      console.error("[REL] fiscal erro:", err.message);
      return res.status(500).json({ erro: "Erro ao gerar relatório fiscal." });
    }
    return res.json(rows); // <<< SEMPRE array
  });
}

function movPorUsuario(req, res) {
  const periodo = normalizePeriodo(req, res, { required: false });
  if (!periodo) return;
  const { inicio, fim } = periodo;

  let sql = `
    SELECT dia, tipo, origem, id_usuario, usuario_nome, perfil, qtd_mov, total_quantidade
    FROM vw_relatorio_mov_usuario_dia
    WHERE 1=1
  `;
  const params = [];

  if (inicio) {
    sql += ` AND dia >= ?`;
    params.push(inicio);
  }
  if (fim) {
    sql += ` AND dia <= ?`;
    params.push(fim);
  }

  sql += ` ORDER BY dia DESC, tipo, usuario_nome`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro ao gerar relatório." });
    return res.json(rows);
  });
}

function rastreabilidadeVenda(req, res) {
  const periodo = normalizePeriodo(req, res, { required: false });
  if (!periodo) return;
  const { inicio, fim } = periodo;

  const { id_venda } = req.query;

  let sql = `
    SELECT *
    FROM vw_relatorio_rastreabilidade_venda
    WHERE 1=1
  `;
  const params = [];

  if (inicio) {
    sql += ` AND date(venda_criado_em) >= ?`;
    params.push(inicio);
  }
  if (fim) {
    sql += ` AND date(venda_criado_em) <= ?`;
    params.push(fim);
  }
  if (id_venda) {
    const id = Number(id_venda);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ erro: "id_venda inválido." });
    }
    sql += ` AND id_venda = ?`;
    params.push(id);
  }

  sql += ` ORDER BY id_venda DESC, id_item ASC, mov_criado_em DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("[REL] rastreabilidade erro:", err.message);
      return res.status(500).json({ erro: "Erro ao gerar rastreabilidade." });
    }

    // === AGRUPAR: venda -> itens -> movimentacoes ===
    const vendasMap = new Map();

    for (const r of rows) {
      // 1) Venda
      if (!vendasMap.has(r.id_venda)) {
        vendasMap.set(r.id_venda, {
          id_venda: r.id_venda,
          criado_em: r.venda_criado_em,
          status: r.venda_status,
          forma_pagamento: r.forma_pagamento,
          total: r.total_final ?? r.total,
          total_bruto: r.total_bruto ?? null,
          desconto_total: r.desconto_total ?? null,

          registrado_por: {
            id_usuario: r.venda_id_usuario,
            nome: r.venda_usuario_nome,
            perfil: r.venda_usuario_perfil,
          },
          itens: [],
        });
      }

      const venda = vendasMap.get(r.id_venda);

      // 2) Item (chave por id_item)
      let item = venda.itens.find((i) => i.id_item === r.id_item);
      if (!item) {
        item = {
          id_item: r.id_item,
          id_variacao: r.id_variacao,
          produto: {
            id_produto: r.id_produto,
            nome: r.produto,
            sku: r.sku,
            cor: r.cor,
            tamanho: r.tamanho,
          },
          quantidade: r.item_quantidade,
          preco_unit_original: r.preco_unit_original ?? null,
          desconto_percent: r.desconto_percent ?? 0,
          desconto_valor: r.desconto_valor ?? 0,
          motivo_desconto: r.motivo_desconto ?? null,
          preco_unit: r.preco_unit_final ?? r.preco_unit, // preço final
          subtotal: r.subtotal_final ?? r.subtotal, // subtotal final
          movimentacoes: [],
          resumo_mov: {
            teve_saida: false,
            teve_estorno: false,
          },
        };
        venda.itens.push(item);
      }

      // 3) Movimentação (pode ser null se não bateu observacao)
      if (r.id_movimentacao) {
        const mov = {
          id_movimentacao: r.id_movimentacao,
          criado_em: r.mov_criado_em,
          tipo: r.mov_tipo,
          quantidade: r.mov_quantidade,
          observacao: r.mov_observacao,
          registrado_por: {
            id_usuario: r.mov_id_usuario,
            nome: r.mov_usuario_nome,
            perfil: r.mov_usuario_perfil,
          },
        };

        // evita duplicar se a view retornar linhas repetidas
        if (
          !item.movimentacoes.some(
            (m) => m.id_movimentacao === mov.id_movimentacao,
          )
        ) {
          item.movimentacoes.push(mov);
        }

        const obs = String(mov.observacao || "");

        // SAÍDA da venda (igualdade é OK porque você grava "Venda #X")
        if (mov.tipo === "SAIDA" && obs === `Venda #${r.id_venda}`) {
          item.resumo_mov.teve_saida = true;
        }

        // ENTRADA pode ser Estorno ou Devolução (vem com " | Motivo: ...")
        if (mov.tipo === "ENTRADA") {
          const prefixEstorno = `Estorno Venda #${r.id_venda}`;
          const prefixDevolucao = `Devolução Venda #${r.id_venda}`;

          if (
            obs.startsWith(prefixEstorno) ||
            obs.startsWith(prefixDevolucao)
          ) {
            item.resumo_mov.teve_estorno = true; // aqui "estorno" = entrada de retorno
          }
        }
      }
    }

    const resultado = Array.from(vendasMap.values());

    // === resumo executivo (PI-friendly) ===
    for (const v of resultado) {
      let totalItens = 0;
      let totalUnidades = 0;
      let movCount = 0;
      let teveEstorno = false;

      for (const it of v.itens) {
        totalItens += 1;
        totalUnidades += Number(it.quantidade || 0);
        movCount += it.movimentacoes.length;

        if (it.resumo_mov?.teve_estorno) teveEstorno = true;
      }

      v.resumo = {
        total_itens: totalItens,
        total_unidades: totalUnidades,
        movimentacoes_total: movCount,
        teve_estorno: teveEstorno,
      };
    }

    // opcional: quando filtra por id_venda, retornar objeto único
    if (id_venda) return res.json(resultado[0] || null);

    return res.json(resultado);
  });
}
module.exports = {
  normalizePeriodo,
  vendasPorPeriodo,
  topProdutos,
  movPorUsuario,
  rastreabilidadeVenda,
  fechamentoCaixa,
  fiscalPorPeriodo,
};
