(function () {
  let variacoesPromocao = [];

  let promocoesCache = [];
  let filtroStatusAtual = "ATIVA";

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarDataHora(valor) {
    if (!valor) return "—";
    const data = new Date(String(valor).replace(" ", "T"));
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleString("pt-BR");
  }

  function formatarDataInputParaApi(valor) {
    if (!valor) return "";
    return `${valor}:00`.replace("T", " ");
  }

  function calcularPrecoPromocional(precoBase, desconto) {
    const base = Number(precoBase || 0);
    const perc = Number(desconto || 0);
    const final = base - base * (perc / 100);
    return Number(final.toFixed(2));
  }

  function obterStatusPromocao(item) {
    return String(item.status || "—").toUpperCase();
  }

  function montarStatusHtml(status) {
    const s = String(status || "").toUpperCase();

    if (s === "ATIVA") {
      return `<span class="status status-ok">Ativa</span>`;
    }

    if (s === "AGENDADA") {
      return `<span class="status status-warning">Agendada</span>`;
    }

    if (s === "ENCERRADA") {
      return `<span class="status status-neutral">Encerrada</span>`;
    }

    if (s === "CANCELADA") {
      return `<span class="status status-out">Cancelada</span>`;
    }

    return `<span class="status">${status || "—"}</span>`;
  }

  function montarTextoVariacao(item) {
    const nome = item.nome_produto || item.produto || "Produto";
    const sku = item.sku || "—";
    const cor = item.cor || "—";
    const tamanho = item.tamanho || "—";
    const preco = Number(item.preco_original ?? item.preco_venda ?? 0);

    return `${nome} • ${cor} / ${tamanho} • ${sku} • ${formatarMoeda(preco)}`;
  }

  function atualizarPreviewPromocao() {
    const selectEl = document.getElementById("promoVariacao");
    const descontoEl = document.getElementById("promoDesconto");
    const precoBaseEl = document.getElementById("promoPrecoBase");
    const precoPrevistoEl = document.getElementById("promoPrecoPrevisto");

    if (!selectEl || !descontoEl || !precoBaseEl || !precoPrevistoEl) return;

    const idVariacao = Number(selectEl.value || 0);
    const variacao = variacoesPromocao.find(
      (item) => Number(item.id_variacao) === idVariacao,
    );

    const precoBase = Number(
      variacao?.preco_original ?? variacao?.preco_venda ?? 0,
    );
    const desconto = Number(descontoEl.value || 0);

    precoBaseEl.value = formatarMoeda(precoBase);
    precoPrevistoEl.textContent = formatarMoeda(
      calcularPrecoPromocional(precoBase, desconto),
    );
  }

  async function carregarVariacoesPromocao() {
    const selectEl = document.getElementById("promoVariacao");
    if (!selectEl) return;

    try {
      const data = await apiGet("/produtos/pdv");
      variacoesPromocao = Array.isArray(data) ? data : [];

      selectEl.innerHTML = `
        <option value="">Selecione uma variação</option>
        ${variacoesPromocao
          .map(
            (item) => `
              <option value="${item.id_variacao}">
                ${montarTextoVariacao(item)}
              </option>
            `,
          )
          .join("")}
      `;
    } catch (error) {
      console.error("[PROMOCOES] erro ao carregar variações:", error);
    }
  }

  function renderizarPromocoes(lista) {
    const tbody = document.getElementById("promoTabela");
    const statusEl = document.getElementById("promoStatusLista");

    if (!tbody || !statusEl) return;

    const promocoes = Array.isArray(lista) ? lista : [];

    const listaFiltrada =
      filtroStatusAtual === "TODAS"
        ? promocoes
        : promocoes.filter(
            (item) => obterStatusPromocao(item) === filtroStatusAtual,
          );

    statusEl.textContent = `${listaFiltrada.length} registro(s)`;

    if (!listaFiltrada.length) {
      tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          Nenhuma promoção encontrada para o filtro selecionado.
        </td>
      </tr>
    `;
      return;
    }

    tbody.innerHTML = listaFiltrada
      .map(
        (item) => `
        <tr>
          <td>
            <strong>${item.produto || "Produto"}</strong><br />
            <span>${item.cor || "—"} / ${item.tamanho || "—"}</span><br />
            <span class="text-muted">${item.sku || "—"}</span>
          </td>
          <td>${item.nome_campanha || "—"}</td>
          <td>${Number(item.percentual_desconto || 0)}%</td>
          <td>${formatarMoeda(item.preco_promocional || 0)}</td>
          <td>
            <strong>Início:</strong> ${formatarDataHora(item.data_inicio)}<br />
            <strong>Fim:</strong> ${formatarDataHora(item.data_fim)}
          </td>
          <td>${montarStatusHtml(obterStatusPromocao(item))}</td>
        </tr>
      `,
      )
      .join("");
  }

  async function carregarPromocoes() {
    try {
      const data = await apiGet("/promocoes");
      promocoesCache = Array.isArray(data?.promocoes) ? data.promocoes : [];
      renderizarPromocoes(promocoesCache);
    } catch (error) {
      console.error("[PROMOCOES] erro ao carregar promoções:", error);
    }
  }

  async function salvarPromocao() {
    const variacaoEl = document.getElementById("promoVariacao");
    const campanhaEl = document.getElementById("promoCampanha");
    const descontoEl = document.getElementById("promoDesconto");
    const inicioEl = document.getElementById("promoDataInicio");
    const fimEl = document.getElementById("promoDataFim");
    const feedbackEl = document.getElementById("promoFeedback");

    if (
      !variacaoEl ||
      !campanhaEl ||
      !descontoEl ||
      !inicioEl ||
      !fimEl ||
      !feedbackEl
    ) {
      return;
    }

    feedbackEl.textContent = "";

    const payload = {
      id_variacao: Number(variacaoEl.value || 0),
      nome_campanha: String(campanhaEl.value || "").trim(),
      percentual_desconto: Number(descontoEl.value || 0),
      data_inicio: formatarDataInputParaApi(inicioEl.value),
      data_fim: formatarDataInputParaApi(fimEl.value),
    };

    try {
      await apiPost("/promocoes", payload);

      feedbackEl.textContent = "Promoção cadastrada com sucesso.";

      variacaoEl.value = "";
      campanhaEl.value = "";
      descontoEl.value = "";
      inicioEl.value = "";
      fimEl.value = "";

      atualizarPreviewPromocao();
      await carregarPromocoes();
    } catch (error) {
      console.error("[PROMOCOES] erro ao salvar promoção:", error);
      feedbackEl.textContent =
        error?.message || "Não foi possível cadastrar a promoção.";
    }
  }

  function bindFiltrosPromocao() {
    const botoes = document.querySelectorAll(".promo-filtro-btn");
    if (!botoes.length) return;

    botoes.forEach((botao) => {
      botao.addEventListener("click", function () {
        filtroStatusAtual = this.dataset.status || "TODAS";

        botoes.forEach((btn) => btn.classList.remove("active"));
        this.classList.add("active");

        renderizarPromocoes(promocoesCache);
      });
    });
  }

  function bindEventosPromocao() {
    const variacaoEl = document.getElementById("promoVariacao");
    const descontoEl = document.getElementById("promoDesconto");
    const btnSalvar = document.getElementById("btnSalvarPromocao");

    if (variacaoEl) {
      variacaoEl.addEventListener("change", atualizarPreviewPromocao);
    }

    if (descontoEl) {
      descontoEl.addEventListener("input", atualizarPreviewPromocao);
    }

    if (btnSalvar) {
      btnSalvar.addEventListener("click", salvarPromocao);
    }
  }

  window.inicializarTelaPromocoesGerente = async function () {
    await carregarVariacoesPromocao();
    await carregarPromocoes();
    bindEventosPromocao();
    bindFiltrosPromocao();
    atualizarPreviewPromocao();
  };
})();
