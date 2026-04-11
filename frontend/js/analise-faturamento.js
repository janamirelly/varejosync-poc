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

  function atualizarCamposReferencia() {
    const periodo = document.getElementById("filtroPeriodo")?.value || "mensal";

    const wrapData = document.getElementById("wrapReferenciaData");
    const wrapMes = document.getElementById("wrapReferenciaMes");
    const wrapAno = document.getElementById("wrapReferenciaAno");

    if (!wrapData || !wrapMes || !wrapAno) return;

    wrapData.classList.add("hidden");
    wrapMes.classList.add("hidden");
    wrapAno.classList.add("hidden");

    if (periodo === "diario" || periodo === "semanal") {
      wrapData.classList.remove("hidden");
    } else if (periodo === "mensal") {
      wrapMes.classList.remove("hidden");
    } else if (periodo === "anual") {
      wrapAno.classList.remove("hidden");
    }
  }

  function obterReferenciaAtual() {
    const periodo = document.getElementById("filtroPeriodo")?.value || "mensal";

    if (periodo === "diario" || periodo === "semanal") {
      return document.getElementById("filtroReferenciaData")?.value || "";
    }

    if (periodo === "mensal") {
      return document.getElementById("filtroReferenciaMes")?.value || "";
    }

    if (periodo === "anual") {
      return document.getElementById("filtroReferenciaAno")?.value || "";
    }

    return "";
  }

  async function carregarAnaliseFaturamento() {
    const periodo = document.getElementById("filtroPeriodo")?.value || "mensal";
    const referencia = obterReferenciaAtual();

    const params = new URLSearchParams({
      periodo,
      referencia,
    });

    const data = await apiGet(`/dashboard/faturamento?${params.toString()}`);

    setText(
      "kpiAnaliseFaturamento",
      formatarMoeda(data?.atual?.faturamento || 0),
    );
    setText("kpiAnalisePedidos", formatarNumero(data?.atual?.pedidos || 0));
    setText("kpiAnaliseTicket", formatarMoeda(data?.atual?.ticket_medio || 0));
    setText(
      "kpiAnaliseVariacao",
      `${Number(data?.variacao_percentual || 0).toLocaleString("pt-BR")}%`,
    );
    setText("kpiAnaliseRotuloAtual", data?.atual?.rotulo || "Período atual");
    setText(
      "kpiAnaliseRotuloAnterior",
      data?.anterior?.rotulo || "Período anterior",
    );

    renderizarLista(
      "listaTopProdutosAnalise",
      data?.top_produtos || [],
      (item) => `
        <li class="list-row">
          <div class="list-main">
            <strong>${item.produto || "Produto"}</strong>
            <span>${formatarNumero(item.unidades || 0)} un.</span>
          </div>
          <small>${formatarMoeda(item.receita || 0)}</small>
        </li>
      `,
      "Nenhum produto encontrado no período.",
    );

    renderizarLista(
      "listaTopVariacoesAnalise",
      data?.top_variacoes || [],
      (item) => `
        <li class="list-row">
          <div class="list-main">
            <strong>${item.produto || "Produto"}</strong>
            <span>${item.cor || "—"} / ${item.tamanho || "—"} • ${item.sku || "—"}</span>
          </div>
          <small>${formatarNumero(item.unidades || 0)} un.</small>
        </li>
      `,
      "Nenhuma variação encontrada no período.",
    );
  }

  function definirReferenciasPadrao() {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");

    const campoData = document.getElementById("filtroReferenciaData");
    const campoMes = document.getElementById("filtroReferenciaMes");
    const campoAno = document.getElementById("filtroReferenciaAno");

    if (campoData && !campoData.value) campoData.value = `${yyyy}-${mm}-${dd}`;
    if (campoMes && !campoMes.value) campoMes.value = `${yyyy}-${mm}`;
    if (campoAno && !campoAno.value) campoAno.value = String(yyyy);
  }

  function bindEventosAnalise() {
    const periodoEl = document.getElementById("filtroPeriodo");
    const btnAtualizar = document.getElementById("btnAtualizarAnalise");

    if (periodoEl) {
      periodoEl.addEventListener("change", () => {
        atualizarCamposReferencia();
      });
    }

    if (btnAtualizar) {
      btnAtualizar.addEventListener("click", carregarAnaliseFaturamento);
    }
  }

  window.inicializarTelaAnaliseFaturamento = async function () {
    definirReferenciasPadrao();
    atualizarCamposReferencia();
    bindEventosAnalise();
    await carregarAnaliseFaturamento();
  };
})();
