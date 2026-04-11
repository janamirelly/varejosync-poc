//  window.inicializarTelaDashboardGerente = function () {
//    console.log("[GERENTE] dashboard carregada");
//  };

(function () {
  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarNumero(valor) {
    return Number(valor || 0).toLocaleString("pt-BR");
  }

  function formatarDataHora(valor) {
    if (!valor) return "Sem atualização";
    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      return String(valor);
    }

    return data.toLocaleString("pt-BR");
  }

  function setText(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = valor;
  }

  function renderizarLista(id, itens, renderItem, emptyText) {
    const el = document.getElementById(id);
    if (!el) return;

    if (!Array.isArray(itens) || itens.length === 0) {
      el.innerHTML = `<li class="empty-state">${emptyText}</li>`;
      return;
    }

    el.innerHTML = itens.map(renderItem).join("");
  }

  function renderizarKpis(cards) {
    setText("kpiEstoqueTotal", formatarNumero(cards.estoque_total));
    setText("kpiItensCriticos", formatarNumero(cards.itens_criticos));
    setText("kpiPedidos7Dias", formatarNumero(cards.pedidos_dia));
    setText("kpiFaturamento7Dias", formatarMoeda(cards.faturamento_dia));
    setText("ticketMedioGerente", formatarMoeda(cards.ticket_medio_dia));
    setText(
      "gerenteAtualizacao",
      `Última sincronização: ${formatarDataHora(cards.ultima_sincronizacao)}`,
    );
  }

  function renderizarMaisVendidos24h(lista) {
    renderizarLista(
      "listaMaisVendidos24h",
      lista,
      (item) => `
  <li class="list-row">
    <div class="list-main">
      <strong>${item.produto || "Produto"}</strong>
      <span>ID ${item.id_produto || "—"} • ${formatarNumero(item.unidades)} un.</span>
    </div>
    <small>${formatarMoeda(item.receita || 0)}</small>
  </li>
`,
      "Nenhum dado encontrado nas últimas 24h.",
    );
  }

  function renderizarFormasPagamento(lista) {
    renderizarLista(
      "listaFormasPagamento",
      lista,
      (item) => `
        <li class="list-row">
          <div class="list-main">
            <strong>${item.forma_pagamento || "Não informado"}</strong>
            <span>${formatarNumero(item.quantidade || 0)} vendas</span>
          </div>
          <small>${formatarMoeda(item.total || 0)}</small>
        </li>
      `,
      "Nenhuma forma de pagamento encontrada.",
    );
  }

  function renderizarCriticos(lista) {
    renderizarLista(
      "listaCriticos",
      lista.slice(0, 5),
      (item) => `
        <li class="list-row">
          <div class="list-main">
            <strong>${item.produto || "Produto"}</strong>
            <span>${formatarNumero(item.itens_criticos || 0)} item(ns) críticos</span>
          </div>
        </li>
      `,
      "Nenhum item crítico no momento.",
    );
  }

  function renderizarErro(mensagem) {
    const container = document.querySelector(".page-dashboard-gerente");
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <p style="color:#dc2626; font-weight:bold; margin-bottom:8px;">
          Erro ao carregar dashboard gerencial.
        </p>
        <p style="color:#6b7280;">${mensagem}</p>
      </div>
    `;
  }

  async function carregarDashboardGerente() {
    try {
      const data = await apiGet("/dashboard");

      const cards = data?.cards || {};
      const breakdowns = data?.breakdowns || {};

      renderizarKpis(cards);
      renderizarMaisVendidos24h(breakdowns.produtos_mais_vendidos_24h || []);
      renderizarFormasPagamento(breakdowns.formas_pagamento_dia || []);
      renderizarCriticos(breakdowns.criticos_por_produto || []);
    } catch (error) {
      console.error("[DASHBOARD GERENTE] erro:", error);
      renderizarErro(error.message || "Falha ao buscar dados.");
    }
  }

  window.inicializarTelaDashboardGerente = function () {
    carregarDashboardGerente();
  };
})();
