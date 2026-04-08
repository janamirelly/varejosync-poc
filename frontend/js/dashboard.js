(function () {
  let dashboardCarregando = false;

  function getStatusDashboard(quantidade, minimo) {
    const qtd = Number(quantidade) || 0;
    const min = Number(minimo) || 0;

    if (qtd === 0) return "esgotado";
    if (qtd < min) return "critico";
    if (qtd === min || qtd <= min + 2) return "atencao";
    return "ok";
  }

  function normalizarDashboardItem(item) {
    return {
      produto: item.nome_produto ?? item.produto ?? item.nome ?? "—",
      cor: item.cor ?? item.nome_cor ?? item.variacao_cor ?? "—",
      tamanho:
        item.tamanho ?? item.nome_tamanho ?? item.variacao_tamanho ?? "—",
      quantidade:
        item.quantidade_atual ?? item.quantidade ?? item.estoque_atual ?? 0,
      minimo:
        item.estoque_min ??
        item.estoque_minimo ??
        item.minimo ??
        item.quantidade_minima ??
        0,
      status: String(item.status ?? "").toUpperCase(),
    };
  }

  function atualizarDashboardTexto(idValor, idDesc, valor, descricao) {
    const elValor = document.getElementById(idValor);
    const elDesc = document.getElementById(idDesc);

    if (elValor) elValor.textContent = valor;
    if (elDesc) elDesc.textContent = descricao;
  }

  function normalizarTextoDashboard(valor) {
    const texto = String(valor || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!texto || texto === "—") return "";

    return texto.toUpperCase();
  }

  async function carregarDadosDashboard() {
    const token =
      (localStorage.getItem("token") || "").trim() ||
      "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

    /* ===== ESTOQUE ===== */
    const resposta = await fetch("http://localhost:3000/estoque", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const texto = await resposta.text();
    let resultado = [];

    try {
      resultado = texto ? JSON.parse(texto) : [];
    } catch {
      throw new Error("Resposta inválida da API de estoque.");
    }

    if (!resposta.ok) {
      throw new Error(`Erro HTTP ${resposta.status} ao buscar estoque`);
    }

    const listaBruta = Array.isArray(resultado)
      ? resultado
      : Array.isArray(resultado.itens)
        ? resultado.itens
        : [];

    const itens = listaBruta.map(normalizarDashboardItem);

    /* ===== MOVIMENTAÇÕES ===== */
    const respostaMov = await fetch("http://localhost:3000/movimentacoes", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const textoMov = await respostaMov.text();
    let resultadoMov = [];

    try {
      resultadoMov = textoMov ? JSON.parse(textoMov) : [];
    } catch {
      throw new Error("Resposta inválida da API de movimentações.");
    }

    if (!respostaMov.ok) {
      throw new Error(
        `Erro HTTP ${respostaMov.status} ao buscar movimentações`,
      );
    }

    const movimentacoes = Array.isArray(resultadoMov)
      ? resultadoMov
      : Array.isArray(resultadoMov.itens)
        ? resultadoMov.itens
        : [];

    /* ===== KPI ESTOQUE ===== */
    const produtos = [
      ...new Set(
        itens.map((i) => normalizarTextoDashboard(i.produto)).filter(Boolean),
      ),
    ];

    const estoqueTotal = itens.reduce(
      (acc, item) => acc + (Number(item.quantidade) || 0),
      0,
    );

    const alertas = itens.filter((item) => {
      const statusCalculado = getStatusDashboard(item.quantidade, item.minimo);
      const status = (item.status || statusCalculado).toUpperCase();

      return ["ATENCAO", "CRITICO", "ESGOTADO"].includes(status);
    });

    const esgotados = itens.filter((item) => Number(item.quantidade) === 0);

    /* ===== KPI MOVIMENTAÇÕES ===== */
    const agora = new Date();
    const yyyy = agora.getFullYear();
    const mm = String(agora.getMonth() + 1).padStart(2, "0");
    const dd = String(agora.getDate()).padStart(2, "0");
    const hoje = `${yyyy}-${mm}-${dd}`;

    const movimentacoesHoje = movimentacoes.filter((mov) => {
      const dataMov = String(
        mov.data_movimentacao || mov.criado_em || mov.data || "",
      ).slice(0, 10);

      return dataMov === hoje;
    });

    const ultimasEntradas = movimentacoes.filter((mov) => {
      const tipo = String(
        mov.tipo || mov.tipo_movimentacao || "",
      ).toUpperCase();

      const dataMov = String(
        mov.data_movimentacao || mov.criado_em || mov.data || "",
      ).slice(0, 10);

      return tipo === "ENTRADA" && dataMov === hoje;
    });

    /* ===== ATUALIZA KPIs ===== */
    atualizarDashboardTexto(
      "kpiProdutos",
      "kpiProdutosDesc",
      produtos.length,
      "Produtos distintos com registro no estoque.",
    );

    atualizarDashboardTexto(
      "kpiMovimentacoesHoje",
      "kpiMovimentacoesHojeDesc",
      movimentacoesHoje.length,
      movimentacoesHoje.length > 0
        ? "Movimentações registradas no dia."
        : "Nenhuma movimentação registrada hoje.",
    );

    atualizarDashboardTexto(
      "kpiUltimasEntradas",
      "kpiUltimasEntradasDesc",
      ultimasEntradas.length,
      ultimasEntradas.length > 0
        ? "Entradas de estoque registradas hoje."
        : "Nenhuma entrada registrada hoje.",
    );

    atualizarDashboardTexto(
      "kpiAlertas",
      "kpiAlertasDesc",
      alertas.length,
      alertas.length > 0
        ? "Itens com baixo estoque, críticos ou esgotados."
        : "Nenhum alerta de estoque no momento.",
    );

    atualizarDashboardTexto(
      "kpiEsgotados",
      "kpiEsgotadosDesc",
      esgotados.length,
      esgotados.length > 0
        ? "Produtos sem disponibilidade no estoque."
        : "Nenhum item esgotado no momento.",
    );

    atualizarDashboardTexto(
      "kpiEstoqueTotal",
      "kpiEstoqueTotalDesc",
      estoqueTotal,
      "Quantidade total disponível no estoque.",
    );
  }

  window.inicializarTelaDashboard = async function () {
    if (dashboardCarregando) {
      console.log("[DASHBOARD] já existe carregamento em andamento.");
      return;
    }

    dashboardCarregando = true;

    atualizarDashboardTexto(
      "kpiProdutos",
      "kpiProdutosDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiMovimentacoesHoje",
      "kpiMovimentacoesHojeDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiUltimasEntradas",
      "kpiUltimasEntradasDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiAlertas",
      "kpiAlertasDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiEsgotados",
      "kpiEsgotadosDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiEstoqueTotal",
      "kpiEstoqueTotalDesc",
      "—",
      "Carregando dados...",
    );

    try {
      await carregarDadosDashboard();
      console.log("[DASHBOARD] carregado com sucesso.");
      sessionStorage.removeItem("recarregarDashboardEstoque");
    } catch (error) {
      console.error("[DASHBOARD] erro:", error);

      atualizarDashboardTexto(
        "kpiProdutos",
        "kpiProdutosDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiMovimentacoesHoje",
        "kpiMovimentacoesHojeDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiUltimasEntradas",
        "kpiUltimasEntradasDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiAlertas",
        "kpiAlertasDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiEsgotados",
        "kpiEsgotadosDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiEstoqueTotal",
        "kpiEstoqueTotalDesc",
        "—",
        "Erro ao carregar dados.",
      );
    } finally {
      dashboardCarregando = false;
    }
  };

  window.recarregarDashboardEstoque = async function () {
    try {
      await carregarDadosDashboard();
    } catch (error) {
      console.error("[DASHBOARD] erro ao recarregar:", error);
    }
  };
})();
