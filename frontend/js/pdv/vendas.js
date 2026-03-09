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
      preco: Number(
        item.preco_venda ?? item.preco ?? item.preco_unit ?? item.valor ?? 0,
      ),
      status: String(item.status ?? "").toUpperCase(),
      promocao: Boolean(item.promocao ?? item.em_promocao ?? false),
      novo: Boolean(item.novo ?? item.novidade ?? false),
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

  function getTotalCarrinho() {
    return state.carrinho.reduce((acc, item) => {
      return acc + item.quantidade * item.preco;
    }, 0);
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

        return `
          <tr>
            <td class="pdv-col-produto">
              <strong>${produto.nome}</strong>
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
            <td>${money(produto.preco)}</td>
            <td>
              <button
                type="button"
                class="btn-primary"
                onclick="window.pdvAdicionarProduto('${key}')"
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
        const totalItem = item.quantidade * item.preco;
        const key = String(getKey(item)).replace(/'/g, "\\'");

        return `
          <div class="pdv-resumo-item">
            <div class="pdv-item-main">
              <strong>${item.nome}</strong>
              <span>SKU: ${item.sku} • ${item.variacao || "—"}</span>
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

            <div>
              <button
                type="button"
                class="btn-secondary"
                onclick="window.pdvRemoverItem('${key}')"
              >
                Remover
              </button>
            </div>
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

    if (listaEl) {
      listaEl.innerHTML = state.carrinho
        .map(
          (item) => `
            <div>
              <strong>${item.nome}</strong> — ${item.variacao || "Padrão"} (${item.quantidade} un.)
            </div>
          `,
        )
        .join("");
    }

    if (totalEl) {
      totalEl.textContent = money(getTotalCarrinho());
    }

    abrirModal(document.getElementById("pdvModalFinalizar"));
  }

  async function confirmarFinalizarVenda() {
    const payload = {
      forma_pagamento: "PIX",
      itens: state.carrinho.map((item) => ({
        id_variacao: item.id_variacao,
        quantidade: item.quantidade,
        preco_unit: item.preco,
        desconto_percent: 0,
        motivo_desconto: "",
      })),
    };

    try {
      const data = await apiPost("/vendas", payload);

      const numeroVenda =
        data.numero_venda ??
        data.id_venda ??
        data.venda?.numero_venda ??
        "000124";

      fecharModal(document.getElementById("pdvModalFinalizar"));

      const numeroEl = document.getElementById("pdvNumeroVenda");
      if (numeroEl) {
        numeroEl.textContent = `Número da venda: #${numeroVenda}`;
      }

      state.carrinho = [];
      renderResumo();
      abrirModal(document.getElementById("pdvModalSucesso"));
      buscarProdutos();
    } catch (error) {
      alert(error.message || "Erro ao finalizar venda.");
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

    [
      document.getElementById("pdvModalCancelar"),
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

  window.inicializarTelaVendas = function () {
    bindEventos();
    renderResumo();
    buscarProdutos();
  };
})();
