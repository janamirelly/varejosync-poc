const { db } = require("../db/database");

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function extrairPerfilUsuario(req) {
  return normalizarTexto(
    req.user?.perfil_nome ||
      req.user?.perfil ||
      req.user?.nome_perfil ||
      req.user?.role ||
      req.user?.tipo,
  );
}

function usuarioEhGerente(req) {
  const perfil = extrairPerfilUsuario(req);
  return (
    perfil === "GERENTE" ||
    perfil === "GERENTE DE OPERACOES" ||
    perfil === "GERENTE DE OPERAÇÕES"
  );
}

function extrairIdUsuario(req) {
  return (
    req.user?.id_usuario ||
    req.user?.id ||
    req.usuario?.id_usuario ||
    req.usuario?.id ||
    null
  );
}

function calcularPrecoPromocional(precoBase, percentualDesconto) {
  const preco = Number(precoBase || 0);
  const desconto = Number(percentualDesconto || 0);
  const resultado = preco - preco * (desconto / 100);
  return Number(resultado.toFixed(2));
}

function calcularStatusPromocao(dataInicio, dataFim) {
  const agora = new Date();
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  if (agora < inicio) return "AGENDADA";
  if (agora >= inicio && agora <= fim) return "ATIVA";
  return "ENCERRADA";
}

async function buscarVariacao(idVariacao) {
  const sql = `
    SELECT
      vp.id_variacao,
      vp.id_produto,
      vp.sku,
      vp.cor,
      vp.tamanho,
      vp.preco,
      p.nome AS produto
    FROM variacao_produto vp
    INNER JOIN produto p
      ON p.id_produto = vp.id_produto
    WHERE vp.id_variacao = ?
      AND vp.ativo = 1
      AND p.ativo = 1
  `;

  return getAsync(sql, [idVariacao]);
}

async function buscarPromocaoPorId(idPromocao) {
  const sql = `
    SELECT
      pr.id_promocao,
      pr.id_variacao,
      pr.nome_campanha,
      pr.percentual_desconto,
      pr.preco_base,
      pr.preco_promocional,
      pr.data_inicio,
      pr.data_fim,
      pr.parcelas_sem_juros,
      pr.valor_minimo_parcelamento,
      pr.status,
      pr.criado_por,
      pr.criado_em,
      pr.atualizado_em,
      pr.cancelado_por,
      pr.cancelado_em,
      pr.motivo_cancelamento,
      vp.sku,
      vp.cor,
      vp.tamanho,
      p.nome AS produto
    FROM promocao pr
    INNER JOIN variacao_produto vp
      ON vp.id_variacao = pr.id_variacao
    INNER JOIN produto p
      ON p.id_produto = vp.id_produto
    WHERE pr.id_promocao = ?
  `;

  return getAsync(sql, [idPromocao]);
}

async function existeSobreposicaoPromocao(
  idVariacao,
  dataInicio,
  dataFim,
  idIgnorar = null,
) {
  let sql = `
    SELECT id_promocao
    FROM promocao
    WHERE id_variacao = ?
      AND status IN ('AGENDADA', 'ATIVA')
      AND (
        datetime(?) <= datetime(data_fim)
        AND datetime(?) >= datetime(data_inicio)
      )
  `;

  const params = [idVariacao, dataInicio, dataFim];

  if (idIgnorar) {
    sql += ` AND id_promocao <> ?`;
    params.push(idIgnorar);
  }

  return getAsync(sql, params);
}

exports.criarPromocao = async (req, res) => {
  try {
    if (!usuarioEhGerente(req)) {
      return res.status(403).json({
        erro: "Apenas gerente pode cadastrar promoção.",
      });
    }

    const idUsuario = extrairIdUsuario(req);

    if (!idUsuario) {
      return res.status(401).json({
        erro: "Usuário autenticado inválido.",
      });
    }

    const {
      id_variacao,
      nome_campanha,
      percentual_desconto,
      data_inicio,
      data_fim,
    } = req.body;

    if (
      !id_variacao ||
      !nome_campanha ||
      !percentual_desconto ||
      !data_inicio ||
      !data_fim
    ) {
      return res.status(400).json({
        erro: "Campos obrigatórios: id_variacao, nome_campanha, percentual_desconto, data_inicio e data_fim.",
      });
    }

    const desconto = Number(percentual_desconto);

    if (Number.isNaN(desconto) || desconto <= 0 || desconto > 15) {
      return res.status(422).json({
        erro: "O desconto deve ser maior que 0 e no máximo 15%.",
      });
    }

    const inicio = new Date(data_inicio);
    const fim = new Date(data_fim);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return res.status(422).json({
        erro: "Data de início ou data final inválida.",
      });
    }

    if (inicio >= fim) {
      return res.status(422).json({
        erro: "A data/hora inicial deve ser menor que a data/hora final.",
      });
    }

    const variacao = await buscarVariacao(id_variacao);

    if (!variacao) {
      return res.status(404).json({
        erro: "Variação não encontrada ou inativa.",
      });
    }

    const sobreposicao = await existeSobreposicaoPromocao(
      id_variacao,
      data_inicio,
      data_fim,
    );

    if (sobreposicao) {
      return res.status(409).json({
        erro: "Já existe promoção ativa ou agendada com período sobreposto para esta variação.",
      });
    }

    const precoBase = Number(variacao.preco || 0);

    if (precoBase <= 0) {
      return res.status(422).json({
        erro: "A variação selecionada possui preço base inválido.",
      });
    }

    const precoPromocional = calcularPrecoPromocional(precoBase, desconto);
    const parcelasSemJuros = precoPromocional >= 100 ? 3 : 0;
    const status = calcularStatusPromocao(data_inicio, data_fim);

    const insertSql = `
      INSERT INTO promocao (
        id_variacao,
        nome_campanha,
        percentual_desconto,
        preco_base,
        preco_promocional,
        data_inicio,
        data_fim,
        parcelas_sem_juros,
        valor_minimo_parcelamento,
        status,
        criado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await runAsync(insertSql, [
      id_variacao,
      String(nome_campanha).trim(),
      desconto,
      precoBase,
      precoPromocional,
      data_inicio,
      data_fim,
      parcelasSemJuros,
      100,
      status,
      idUsuario,
    ]);

    const promocao = await buscarPromocaoPorId(result.lastID);

    return res.status(201).json({
      mensagem: "Promoção cadastrada com sucesso.",
      promocao,
      regra_pagamento:
        precoPromocional >= 100 ? "Até 3x sem juros" : "Pagamento à vista",
    });
  } catch (error) {
    console.error("[PROMOCOES] erro ao criar promoção:", error);
    return res.status(500).json({
      erro: "Não foi possível cadastrar a promoção.",
    });
  }
};

exports.listarPromocoes = async (req, res) => {
  try {
    if (!usuarioEhGerente(req)) {
      return res.status(403).json({
        erro: "Apenas gerente pode consultar promoções.",
      });
    }

    const { status, id_variacao } = req.query;

    let sql = `
      SELECT
        pr.id_promocao,
        pr.id_variacao,
        pr.nome_campanha,
        pr.percentual_desconto,
        pr.preco_base,
        pr.preco_promocional,
        pr.data_inicio,
        pr.data_fim,
        pr.parcelas_sem_juros,
        pr.valor_minimo_parcelamento,
        pr.status,
        pr.criado_em,
        vp.sku,
        vp.cor,
        vp.tamanho,
        p.nome AS produto
      FROM promocao pr
      INNER JOIN variacao_produto vp
        ON vp.id_variacao = pr.id_variacao
      INNER JOIN produto p
        ON p.id_produto = vp.id_produto
      WHERE 1 = 1
    `;

    const params = [];

    if (status) {
      sql += ` AND pr.status = ?`;
      params.push(normalizarTexto(status));
    }

    if (id_variacao) {
      sql += ` AND pr.id_variacao = ?`;
      params.push(Number(id_variacao));
    }

    sql += ` ORDER BY datetime(pr.data_inicio) DESC, pr.id_promocao DESC`;

    const promocoes = await allAsync(sql, params);

    return res.status(200).json({
      total: promocoes.length,
      promocoes,
    });
  } catch (error) {
    console.error("[PROMOCOES] erro ao listar promoções:", error);
    return res.status(500).json({
      erro: "Não foi possível listar as promoções.",
    });
  }
};

exports.detalharPromocao = async (req, res) => {
  try {
    if (!usuarioEhGerente(req)) {
      return res.status(403).json({
        erro: "Apenas gerente pode consultar promoções.",
      });
    }

    const { id } = req.params;
    const promocao = await buscarPromocaoPorId(id);

    if (!promocao) {
      return res.status(404).json({
        erro: "Promoção não encontrada.",
      });
    }

    return res.status(200).json(promocao);
  } catch (error) {
    console.error("[PROMOCOES] erro ao detalhar promoção:", error);
    return res.status(500).json({
      erro: "Não foi possível detalhar a promoção.",
    });
  }
};

exports.cancelarPromocao = async (req, res) => {
  try {
    if (!usuarioEhGerente(req)) {
      return res.status(403).json({
        erro: "Apenas gerente pode cancelar promoção.",
      });
    }

    const idUsuario = extrairIdUsuario(req);

    if (!idUsuario) {
      return res.status(401).json({
        erro: "Usuário autenticado inválido.",
      });
    }

    const { id } = req.params;
    const { motivo_cancelamento } = req.body;

    if (!motivo_cancelamento || String(motivo_cancelamento).trim().length < 3) {
      return res.status(422).json({
        erro: "Informe um motivo de cancelamento com pelo menos 3 caracteres.",
      });
    }

    const promocao = await buscarPromocaoPorId(id);

    if (!promocao) {
      return res.status(404).json({
        erro: "Promoção não encontrada.",
      });
    }

    if (promocao.status === "CANCELADA") {
      return res.status(409).json({
        erro: "A promoção já está cancelada.",
      });
    }

    if (promocao.status === "ENCERRADA") {
      return res.status(409).json({
        erro: "Não é possível cancelar uma promoção já encerrada.",
      });
    }

    await runAsync(
      `
      UPDATE promocao
      SET
        status = 'CANCELADA',
        cancelado_por = ?,
        cancelado_em = datetime('now','localtime'),
        motivo_cancelamento = ?,
        atualizado_em = datetime('now','localtime')
      WHERE id_promocao = ?
      `,
      [idUsuario, String(motivo_cancelamento).trim(), id],
    );

    return res.status(200).json({
      mensagem: "Promoção cancelada com sucesso.",
    });
  } catch (error) {
    console.error("[PROMOCOES] erro ao cancelar promoção:", error);
    return res.status(500).json({
      erro: "Não foi possível cancelar a promoção.",
    });
  }
};
