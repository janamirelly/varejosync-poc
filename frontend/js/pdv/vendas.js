(function () {
  console.log("[PDV] vendas.js carregado - versão nova");
  const state = {
    busca: "",
    chip: "todos",
    produtos: [],
    carrinho: [],
  };

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  const JUROS_CREDITO = {
    1: 0,
    2: 0,
    3: 0,
    4: 0.0733,
    5: 0.0866,
    6: 0.0996,
  };

  function debounce(fn, delay = 350) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function normalizarProduto(item) {
    const nomeProduto = String(
      item.nome_produto ?? item.produto ?? "Produto sem nome",
    );
    const cor = String(item.cor ?? "");
    const tamanho = String(item.tamanho ?? "");
    const sku = String(item.sku ?? "—");

    const variacao = [cor, tamanho].filter(Boolean).join(" / ") || "Padrão";
    const estoque = Number(item.quantidade_atual ?? item.quantidade ?? 0);

    const precoOriginal = Number(
      item.preco_original ?? item.preco ?? item.preco_venda ?? 0,
    );
    const precoVenda = Number(
      item.preco_venda ?? item.preco ?? item.preco_unit ?? item.valor ?? 0,
    );

    return {
      id_produto: item.id_produto ?? item.id ?? null,
      id_variacao: item.id_variacao ?? item.id ?? null,
      nome: nomeProduto,
      sku,
      variacao,
      cor,
      tamanho,
      estoque,
      estoque_min: Number(item.estoque_min ?? item.minimo ?? 0),

      preco: precoVenda,
      preco_original: precoOriginal,
      preco_promocional: Number(item.preco_promocional ?? precoVenda),
      percentual_desconto: Number(item.percentual_desconto ?? 0),
      mensagem_pagamento: String(item.mensagem_pagamento ?? ""),
      nome_campanha: String(item.nome_campanha ?? ""),
      parcelas_sem_juros: Number(item.parcelas_sem_juros ?? 0),

      status: String(item.status ?? "").toUpperCase(),
      promocao: Number(item.em_promocao ?? item.promocao ?? 0) === 1,
      novo: Number(item.novidade ?? item.novo ?? 0) === 1,

      quantidade: Number(item.quantidade ?? 1),
      desconto_percent: Number(item.desconto_percent ?? 0),
      motivo_desconto: String(item.motivo_desconto ?? ""),
    };
  }

  function aplicarFiltroChip(lista) {
    /* segurança absoluta */
    if (!state.chip || state.chip === "todos") {
      return lista;
    }

    if (state.chip === "promocao") {
      return lista.filter((item) => item.promocao === true);
    }

    if (state.chip === "novidades") {
      return lista.filter((item) => item.novo === true);
    }

    if (state.chip === "vistos") {
      const vistos = JSON.parse(
        localStorage.getItem("pdvUltimosVistos") || "[]",
      );

      if (!vistos.length) return [];

      return lista.filter((item) => vistos.includes(String(item.id_variacao)));
    }

    return lista;
  }

  function getKey(item) {
    return String(item.id_variacao ?? item.id_produto ?? item.sku);
  }

  function getSubtotalItem(item) {
    const quantidade = Number(item.quantidade || 0);
    const precoBaseVenda = getPrecoUnitarioVenda(item);

    const bruto = Number((quantidade * precoBaseVenda).toFixed(2));
    const desconto = Number(item.desconto_percent || 0);
    const valorDesconto = Number(((bruto * desconto) / 100).toFixed(2));

    return Number((bruto - valorDesconto).toFixed(2));
  }

  function getPrecoUnitarioVenda(item) {
    const quantidade = Number(item.quantidade || 1);
    const precoOriginal = Number(item.preco_original ?? item.preco ?? 0);
    const precoAtual = Number(item.preco ?? 0);
    const promocao = item.promocao === true;

    if (!promocao) {
      return precoAtual;
    }

    // Regra: produto em promoção com preço original acima de 90
    // aplica promoção apenas em 1 unidade
    if (precoOriginal > 90 && quantidade > 1) {
      const totalBaseVenda = precoAtual + precoOriginal * (quantidade - 1);
      return Number((totalBaseVenda / quantidade).toFixed(2));
    }

    return precoAtual;
  }

  function montarLinhaModalFinalizacao(item) {
    const quantidade = Number(item.quantidade || 1);
    const precoOriginal = Number(item.preco_original ?? item.preco ?? 0);
    const precoPromocional = Number(item.preco ?? 0);
    const promocao = item.promocao === true;

    const linhas = [];

    // Regra especial:
    // produto promocional com preço original acima de 90
    // aplica promoção apenas em 1 unidade
    if (promocao && precoOriginal > 90 && quantidade > 1) {
      linhas.push(`
      <div class="pdv-modal-item-row">
        <div class="pdv-modal-item-main">
          <strong>${item.nome}</strong>
          <span>${item.variacao} (1 un.)</span>
          <small class="pdv-item-meta">Unidade promocional</small>
        </div>
        <div class="pdv-modal-item-values">
          <span>Unit.: ${money(precoPromocional)}</span>
          <strong>Total: ${money(precoPromocional)}</strong>
        </div>
      </div>
    `);

      const qtdNormal = quantidade - 1;
      const totalNormal = Number((precoOriginal * qtdNormal).toFixed(2));

      linhas.push(`
      <div class="pdv-modal-item-row">
        <div class="pdv-modal-item-main">
          <strong>${item.nome}</strong>
          <span>${item.variacao} (${qtdNormal} un.)</span>
          <small class="pdv-item-meta pdv-item-meta--neutral">Unidade(s) sem promoção</small>
        </div>
        <div class="pdv-modal-item-values">
          <span>Unit.: ${money(precoOriginal)}</span>
          <strong>Total: ${money(totalNormal)}</strong>
        </div>
      </div>
    `);

      return linhas.join("");
    }

    const precoUnitarioVenda = getPrecoUnitarioVenda(item);
    const subtotal = getSubtotalItem(item);

    linhas.push(`
    <div class="pdv-modal-item-row">
      <div class="pdv-modal-item-main">
        <strong>${item.nome}</strong>
        <span>${item.variacao} (${quantidade} un.)</span>
        ${
          promocao
            ? `<small class="pdv-item-meta">Preço promocional aplicado</small>`
            : ``
        }
      </div>
      <div class="pdv-modal-item-values">
        <span>Unit.: ${money(precoUnitarioVenda)}</span>
        <strong>Total: ${money(subtotal)}</strong>
      </div>
    </div>
  `);

    return linhas.join("");
  }

  function getTotalCarrinho() {
    return state.carrinho.reduce((acc, item) => {
      return acc + getSubtotalItem(item);
    }, 0);
  }
  function calcularPagamentoCredito(total, formaPagamento, parcelas) {
    const forma = String(formaPagamento || "PIX").toUpperCase();
    const qtdParcelas = Number(parcelas || 1);
    const totalBase = Number(total || 0);

    const existePromocional = state.carrinho.some(
      (item) => item.promocao === true,
    );

    if (forma !== "CREDITO") {
      return {
        jurosPercentual: 0,
        valorJuros: 0,
        totalFinal: Number(totalBase.toFixed(2)),
        valorParcela: Number(totalBase.toFixed(2)),
        textoCondicao: "À vista",
      };
    }

    let jurosPercentual = 0;

    if (existePromocional) {
      jurosPercentual = qtdParcelas <= 3 ? 0 : JUROS_CREDITO[qtdParcelas] || 0;
    } else {
      jurosPercentual = JUROS_CREDITO[qtdParcelas] || 0;
    }

    const valorJuros = Number((totalBase * jurosPercentual).toFixed(2));
    const totalFinal = Number((totalBase + valorJuros).toFixed(2));
    const valorParcela = Number((totalFinal / qtdParcelas).toFixed(2));

    return {
      jurosPercentual,
      valorJuros,
      totalFinal,
      valorParcela,
      textoCondicao:
        qtdParcelas <= 3
          ? `${qtdParcelas}x sem juros`
          : `${qtdParcelas}x com juros`,
    };
  }

  function getQuantidadeItens() {
    return state.carrinho.reduce((acc, item) => acc + item.quantidade, 0);
  }

  function abrirModal(modal) {
    if (modal) modal.classList.remove("hidden");
  }

  function fecharModal(modal) {
    if (modal) modal.classList.add("hidden");
  }
  function atualizarParcelasPagamento() {
    const formaEl = document.getElementById("pdvFormaPagamento");
    const parcelasWrap = document.getElementById("pdvParcelasWrap");
    const parcelasEl = document.getElementById("pdvParcelas");
    const totalEl = document.getElementById("pdvModalTotal");
    const resumoPgtoEl = document.getElementById("pdvResumoPagamento");

    if (!formaEl || !parcelasWrap || !parcelasEl) return;

    const forma = String(formaEl.value || "").toUpperCase();
    const totalBase = getTotalCarrinho();
    const existePromocional = state.carrinho.some(
      (item) => item.promocao === true,
    );

    const valorAtualSelecionado = Number(parcelasEl.value || 1);

    let opcoesPermitidas = [1];

    if (forma !== "CREDITO") {
      parcelasWrap.classList.add("hidden");
      opcoesPermitidas = [1];
    } else {
      parcelasWrap.classList.remove("hidden");

      if (existePromocional) {
        opcoesPermitidas = totalBase >= 100 ? [1, 2, 3] : [1];
      } else {
        opcoesPermitidas = [1, 2, 3, 4, 5, 6];
      }
    }

    const valorSelecionado = opcoesPermitidas.includes(valorAtualSelecionado)
      ? valorAtualSelecionado
      : 1;

    parcelasEl.innerHTML = opcoesPermitidas
      .map((n) => `<option value="${n}">${n}x</option>`)
      .join("");

    parcelasEl.value = String(valorSelecionado);

    const parcelas = Number(parcelasEl.value || 1);
    const pagamento = calcularPagamentoCredito(totalBase, forma, parcelas);

    if (totalEl) {
      totalEl.textContent = money(pagamento.totalFinal);
    }

    if (resumoPgtoEl) {
      if (forma !== "CREDITO") {
        resumoPgtoEl.textContent = "Pagamento à vista";
      } else if (existePromocional && totalBase < 100) {
        resumoPgtoEl.textContent =
          "Venda com item promocional abaixo de R$ 100,00: pagamento à vista no crédito";
      } else {
        resumoPgtoEl.textContent = `${pagamento.textoCondicao} • ${parcelas} parcela(s) de ${money(pagamento.valorParcela)}`;
      }
    }
  }

  function renderProdutos() {
    const tbody = document.getElementById("pdvTabelaProdutos");
    const statusResultados = document.getElementById("pdvStatusResultados");

    if (!tbody || !statusResultados) return;

    statusResultados.textContent = `${state.produtos.length} registro(s)`;

    if (!state.produtos.length) {
      tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Nenhum produto encontrado.</td>
      </tr>
    `;
      return;
    }

    tbody.innerHTML = state.produtos
      .map((produto) => {
        const semEstoque = Number(produto.estoque) <= 0;
        const semVariacao = !produto.id_variacao;
        const bloqueado = semEstoque || semVariacao;
        const key = String(getKey(produto)).replace(/'/g, "\\'");

        const precoHtml = produto.promocao
          ? `
          <div class="pdv-preco-wrap">
            <span class="pdv-preco-original">${money(produto.preco_original)}</span>
            <strong class="pdv-preco-promocional">${money(produto.preco)}</strong>
            <small class="pdv-preco-meta">
              ${produto.percentual_desconto}% off${produto.mensagem_pagamento ? ` • ${produto.mensagem_pagamento}` : ""}
            </small>
          </div>
        `
          : `
          <div class="pdv-preco-wrap">
            <strong class="pdv-preco-normal">${money(produto.preco)}</strong>
          </div>
        `;

        const nomeHtml = `
        <div class="pdv-produto-info">
          <strong>${produto.nome}</strong>
          ${
            produto.promocao
              ? `<span class="pdv-badge-promocao">Promoção</span>`
              : ""
          }
        </div>
      `;

        return `
        <tr>
          <td class="pdv-col-produto">
            ${nomeHtml}
          </td>
          <td>${produto.sku || "—"}</td>
          <td>${produto.variacao || "—"}</td>
          <td>
            ${
              semVariacao
                ? `<span class="status status-warning">Sem variação</span>`
                : semEstoque
                  ? `<span class="status status-out">Sem estoque</span>`
                  : `<span class="status status-ok">${produto.estoque} un.</span>`
            }
          </td>
          <td>${precoHtml}</td>
          <td>
            <button
              type="button"
              class="btn-primary"
              onclick="pdvAdicionarProduto('${key}')"
              ${bloqueado ? "disabled" : ""}
            >
              Adicionar
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderResumo() {
    const lista = document.getElementById("pdvResumoLista");
    const totalEl = document.getElementById("pdvTotalVenda");
    const statusCarrinho = document.getElementById("pdvStatusCarrinho");

    if (!lista || !totalEl || !statusCarrinho) return;

    totalEl.textContent = money(getTotalCarrinho());
    statusCarrinho.textContent = `${getQuantidadeItens()} item(ns) adicionados`;

    if (!state.carrinho.length) {
      lista.innerHTML = `
        <div class="pdv-empty">
          Nenhum item adicionado à venda.
        </div>
      `;
      return;
    }

    lista.innerHTML = state.carrinho
      .map((item) => {
        const totalItem = getSubtotalItem(item);
        const desconto = Number(item.desconto_percent || 0);
        const key = String(getKey(item)).replace(/'/g, "\\'");

        return `
  <div class="pdv-resumo-item">
    <div class="pdv-item-main">
      <strong>${item.nome}</strong>
      <span>SKU: ${item.sku} • ${item.variacao || "—"}</span>
      ${
        desconto > 0
          ? `<span class="pdv-item-desconto">Desconto: ${desconto}% • Motivo: ${item.motivo_desconto || "—"}</span>`
          : ""
      }

      <div class="pdv-item-actions-inline">
        <button
          type="button"
          class="btn-secondary btn-small"
          onclick="window.pdvAbrirDesconto('${key}')"
        >
          Desconto
        </button>

        <button
          type="button"
          class="btn-secondary btn-small"
          onclick="window.pdvRemoverItem('${key}')"
        >
          Remover
        </button>
      </div>
    </div>

    <div class="pdv-qtd-wrap">
      <button
        type="button"
        class="pdv-qtd-btn"
        onclick="window.pdvAlterarQuantidade('${key}', 'menos')"
      >-</button>

      <span class="pdv-qtd-value">${item.quantidade}</span>

      <button
        type="button"
        class="pdv-qtd-btn"
        onclick="window.pdvAlterarQuantidade('${key}', 'mais')"
      >+</button>
    </div>

    <div class="pdv-item-price">${money(item.preco)}</div>

    <div class="pdv-item-total">${money(totalItem)}</div>
  </div>
`;
      })
      .join("");
  }

  async function buscarProdutos() {
    const statusBusca = document.getElementById("pdvStatusBusca");
    const feedback = document.getElementById("pdvFeedback");

    if (statusBusca) {
      statusBusca.textContent = state.busca
        ? `Resultado da busca por "${state.busca}"`
        : "Consultando produtos...";
    }

    if (feedback) {
      feedback.textContent = "";
    }

    try {
      const data = await apiGet("/produtos/pdv");

      const itens = Array.isArray(data)
        ? data
        : Array.isArray(data.itens)
          ? data.itens
          : [];

      const termo = (state.busca || "").trim().toLowerCase();

      let lista = itens
        .map(normalizarProduto)
        .filter((item) => item.id_variacao);

      lista = lista.filter((item) => {
        const idVariacao = String(item.id_variacao ?? "").toLowerCase();
        const nomeProduto = String(item.nome ?? "").toLowerCase();
        const sku = String(item.sku ?? "").toLowerCase();
        const cor = String(item.cor ?? "").toLowerCase();
        const tamanho = String(item.tamanho ?? "").toLowerCase();
        const variacao = String(item.variacao ?? "").toLowerCase();

        const variacaoSimples = `${cor} ${tamanho}`.trim();
        const variacaoCompleta = `${nomeProduto} ${cor} ${tamanho}`.trim();

        const textoBusca =
          `${idVariacao} ${nomeProduto} ${sku} ${cor} ${tamanho} ${variacao} ${variacaoSimples} ${variacaoCompleta}`.trim();

        return (
          !termo ||
          idVariacao === termo ||
          sku === termo ||
          nomeProduto.includes(termo) ||
          sku.includes(termo) ||
          cor.includes(termo) ||
          tamanho.includes(termo) ||
          variacao.includes(termo) ||
          variacaoSimples.includes(termo) ||
          variacaoCompleta.includes(termo) ||
          textoBusca.includes(termo)
        );
      });

      lista = aplicarFiltroChip(lista);

      state.produtos = lista;
      renderProdutos();

      if (feedback && lista.length) {
        feedback.textContent = "";
      }

      if (statusBusca) {
        statusBusca.textContent = termo
          ? `Resultado da busca por "${state.busca}"`
          : "Produtos carregados";
      }

      if (feedback && !lista.length) {
        feedback.textContent =
          "Nenhum produto encontrado para os filtros informados.";
      }
    } catch (error) {
      state.produtos = [];
      renderProdutos();

      if (statusBusca) {
        statusBusca.textContent = "Falha na busca";
      }

      if (feedback) {
        feedback.textContent = error.message || "Erro ao consultar produtos.";
      }
    }
  }

  function adicionarProduto(key) {
    const produto = state.produtos.find((item) => getKey(item) === String(key));
    if (!produto) {
      console.warn("[PDV] produto não encontrado para add:", key);
      return;
    }

    if (!produto.id_variacao) {
      alert("Produto sem id_variacao. Verifique a rota usada no PDV.");
      return;
    }

    if (Number(produto.estoque) <= 0) {
      alert("Produto sem estoque disponível.");
      return;
    }

    const existente = state.carrinho.find(
      (item) => getKey(item) === String(key),
    );

    if (existente) {
      if (existente.quantidade >= produto.estoque) {
        alert("Quantidade máxima em estoque atingida.");
        return;
      }
      existente.quantidade += 1;
    } else {
      state.carrinho.push({
        ...produto,
        quantidade: 1,
        desconto_percent: 0,
        motivo_desconto: "",
      });
    }

    salvarUltimoVisto(produto.id_variacao);

    /* garante que a lista permaneça em "todos" */
    state.chip = "todos";

    /* remove destaque de outros chips */
    document.querySelectorAll(".pdv-chip").forEach((btn) => {
      btn.classList.remove("active");
    });

    /* ativa o chip todos */
    const chipTodos = document.querySelector('.pdv-chip[data-chip="todos"]');
    if (chipTodos) chipTodos.classList.add("active");

    renderResumo();

    console.log("[PDV] item adicionado:", produto);
    console.log("[PDV] carrinho atual:", state.carrinho);
  }

  function salvarUltimoVisto(idVariacao) {
    const chave = String(idVariacao);
    const vistos = JSON.parse(localStorage.getItem("pdvUltimosVistos") || "[]");
    const atualizados = [chave, ...vistos.filter((id) => id !== chave)].slice(
      0,
      10,
    );
    localStorage.setItem("pdvUltimosVistos", JSON.stringify(atualizados));
  }

  function alterarQuantidade(key, tipo) {
    const item = state.carrinho.find((prod) => getKey(prod) === String(key));
    if (!item) return;

    if (tipo === "mais") {
      if (item.quantidade >= item.estoque) {
        alert("Quantidade maior que o estoque disponível.");
        return;
      }
      item.quantidade += 1;
    }

    if (tipo === "menos") {
      item.quantidade -= 1;
      if (item.quantidade <= 0) {
        state.carrinho = state.carrinho.filter(
          (prod) => getKey(prod) !== String(key),
        );
      }
    }

    renderResumo();
  }

  function removerItem(key) {
    state.carrinho = state.carrinho.filter(
      (item) => getKey(item) !== String(key),
    );
    renderResumo();
  }
  function abrirModalDesconto(key) {
    const item = state.carrinho.find((prod) => getKey(prod) === String(key));
    if (!item) return;

    const keyEl = document.getElementById("pdvDescontoKey");
    const percentualEl = document.getElementById("pdvDescontoPercent");
    const motivoEl = document.getElementById("pdvDescontoMotivo");

    if (keyEl) keyEl.value = String(key);
    if (percentualEl) percentualEl.value = String(item.desconto_percent || 0);
    if (motivoEl) motivoEl.value = item.motivo_desconto || "";

    abrirModal(document.getElementById("pdvModalDesconto"));
  }

  function confirmarDesconto() {
    const key = document.getElementById("pdvDescontoKey")?.value;
    const percentual = Number(
      document.getElementById("pdvDescontoPercent")?.value || 0,
    );
    const motivo = String(
      document.getElementById("pdvDescontoMotivo")?.value || "",
    ).trim();

    const item = state.carrinho.find((prod) => getKey(prod) === String(key));
    if (!item) return;

    if (percentual < 0 || percentual > 100) {
      alert("Informe um desconto válido entre 0 e 100.");
      return;
    }

    if (percentual > 0 && motivo.length < 3) {
      alert("Informe o motivo do desconto com pelo menos 3 caracteres.");
      return;
    }

    item.desconto_percent = percentual;
    item.motivo_desconto = percentual > 0 ? motivo : "";

    fecharModal(document.getElementById("pdvModalDesconto"));
    renderResumo();
  }

  function abrirCancelarVenda() {
    if (!state.carrinho.length) {
      alert("Não há itens para cancelar.");
      return;
    }

    abrirModal(document.getElementById("pdvModalCancelar"));
  }

  function confirmarCancelarVenda() {
    state.carrinho = [];
    renderResumo();
    fecharModal(document.getElementById("pdvModalCancelar"));
  }

  function abrirFinalizarVenda() {
    if (!state.carrinho.length) {
      alert("Adicione itens antes de finalizar a venda.");
      return;
    }

    const listaEl = document.getElementById("pdvModalListaItens");
    const totalEl = document.getElementById("pdvModalTotal");
    const resumoPgtoEl = document.getElementById("pdvResumoPagamento");
    const formaEl = document.getElementById("pdvFormaPagamento");
    const parcelasEl = document.getElementById("pdvParcelas");

    if (listaEl) {
      listaEl.innerHTML = state.carrinho.length
        ? state.carrinho
            .map((item) => montarLinhaModalFinalizacao(item))
            .join("")
        : `<div class="pdv-empty">Nenhum item adicionado à venda.</div>`;
    }

    if (totalEl) {
      totalEl.textContent = money(getTotalCarrinho());
    }

    if (resumoPgtoEl) {
      resumoPgtoEl.textContent = "Pagamento à vista";
    }

    if (formaEl) {
      formaEl.value = "PIX";
    }

    if (parcelasEl) {
      parcelasEl.innerHTML = `<option value="1">1x</option>`;
      parcelasEl.value = "1";
    }

    atualizarParcelasPagamento();

    abrirModal(document.getElementById("pdvModalFinalizar"));
  }

  async function confirmarFinalizarVenda() {
    const formaEl = document.getElementById("pdvFormaPagamento");
    const parcelasEl = document.getElementById("pdvParcelas");

    const formaPagamento = String(formaEl?.value || "PIX").toUpperCase();
    const parcelas =
      formaPagamento === "CREDITO" ? Number(parcelasEl?.value || 1) : 1;

    const payload = {
      forma_pagamento: formaPagamento,
      parcelas,
      itens: state.carrinho.map((item) => ({
        id_variacao: item.id_variacao,
        quantidade: item.quantidade,
        preco_unit: getPrecoUnitarioVenda(item),
        desconto_percent: Number(item.desconto_percent || 0),
        motivo_desconto: item.motivo_desconto || "",
      })),
    };

    try {
      const data = await apiPost("/vendas", payload);

      const numeroVenda =
        data.numero_venda ??
        data.id_venda ??
        data.venda?.numero_venda ??
        data.venda?.id_venda ??
        "000000";

      const numeroEl = document.getElementById("pdvNumeroVenda");
      if (numeroEl) {
        numeroEl.textContent = `Número da venda: #${numeroVenda}`;
      }

      fecharModal(document.getElementById("pdvModalFinalizar"));
      abrirModal(document.getElementById("pdvModalSucesso"));

      state.carrinho = [];
      renderResumo();
    } catch (error) {
      console.error("[PDV] erro ao finalizar venda:", error);
      alert(error?.message || "Não foi possível finalizar a venda.");
    }
  }

  function bindEventos() {
    const inputBusca = document.getElementById("pdvInputBusca");

    const debouncedBuscar = debounce(() => {
      state.busca = (inputBusca?.value || "").trim();
      buscarProdutos();
    }, 350);

    if (inputBusca) {
      inputBusca.addEventListener("input", debouncedBuscar);
    }

    document.querySelectorAll(".pdv-chip").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        document.querySelectorAll(".pdv-chip").forEach((btn) => {
          btn.classList.remove("active");
        });

        chip.classList.add("active");
        state.chip = chip.dataset.chip || "todos";
        buscarProdutos();
      });
    });

    document
      .getElementById("btnAbrirCancelarVenda")
      ?.addEventListener("click", abrirCancelarVenda);

    document
      .getElementById("btnFecharModalCancelar")
      ?.addEventListener("click", () =>
        fecharModal(document.getElementById("pdvModalCancelar")),
      );

    document
      .getElementById("btnFecharModalDesconto")
      ?.addEventListener("click", () =>
        fecharModal(document.getElementById("pdvModalDesconto")),
      );

    document
      .getElementById("btnConfirmarDesconto")
      ?.addEventListener("click", confirmarDesconto);

    document
      .getElementById("btnConfirmarCancelarVenda")
      ?.addEventListener("click", confirmarCancelarVenda);

    document
      .getElementById("btnAbrirFinalizarVenda")
      ?.addEventListener("click", abrirFinalizarVenda);

    document
      .getElementById("btnFecharModalFinalizar")
      ?.addEventListener("click", () =>
        fecharModal(document.getElementById("pdvModalFinalizar")),
      );

    document
      .getElementById("btnConfirmarFinalizarVenda")
      ?.addEventListener("click", confirmarFinalizarVenda);

    document
      .getElementById("btnVoltarPDV")
      ?.addEventListener("click", () =>
        fecharModal(document.getElementById("pdvModalSucesso")),
      );

    document
      .getElementById("pdvFormaPagamento")
      ?.addEventListener("change", atualizarParcelasPagamento);
    document
      .getElementById("pdvParcelas")
      ?.addEventListener("change", atualizarParcelasPagamento);

    [
      document.getElementById("pdvModalCancelar"),
      document.getElementById("pdvModalDesconto"),
      document.getElementById("pdvModalFinalizar"),
      document.getElementById("pdvModalSucesso"),
    ].forEach((modal) => {
      modal?.addEventListener("click", (event) => {
        if (event.target === modal) {
          fecharModal(modal);
        }
      });
    });
  }

  window.pdvAdicionarProduto = adicionarProduto;
  window.pdvAlterarQuantidade = alterarQuantidade;
  window.pdvRemoverItem = removerItem;
  window.pdvAbrirDesconto = abrirModalDesconto;

  window.inicializarTelaVendas = function () {
    bindEventos();
    renderResumo();
    buscarProdutos();
  };
})();
