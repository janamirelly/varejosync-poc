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
      minimo: item.estoque_minimo ?? item.minimo ?? item.quantidade_minima ?? 0,
    };
  }

  function atualizarDashboardTexto(idValor, idDesc, valor, descricao) {
    const elValor = document.getElementById(idValor);
    const elDesc = document.getElementById(idDesc);

    if (elValor) elValor.textContent = valor;
    if (elDesc) elDesc.textContent = descricao;
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
      "kpiCores",
      "kpiCoresDesc",
      "—",
      "Carregando dados...",
    );
    atualizarDashboardTexto(
      "kpiTamanhos",
      "kpiTamanhosDesc",
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
      "kpiEstoqueTotal",
      "kpiEstoqueTotalDesc",
      "—",
      "Carregando dados...",
    );

    try {
      const token =
        (localStorage.getItem("token") || "").trim() ||
        "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

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
        throw new Error("Resposta inválida da API.");
      }

      if (!resposta.ok) {
        throw new Error(`Erro HTTP ${resposta.status}`);
      }

      const listaBruta = Array.isArray(resultado)
        ? resultado
        : Array.isArray(resultado.itens)
          ? resultado.itens
          : [];

      const itens = listaBruta.map(normalizarDashboardItem);

      const produtos = [
        ...new Set(itens.map((i) => i.produto).filter(Boolean)),
      ];
      const cores = [...new Set(itens.map((i) => i.cor).filter(Boolean))];
      const tamanhos = [
        ...new Set(itens.map((i) => i.tamanho).filter(Boolean)),
      ];

      const estoqueTotal = itens.reduce(
        (acc, item) => acc + (Number(item.quantidade) || 0),
        0,
      );

      const alertas = itens.filter((item) => {
        const status = getStatusDashboard(item.quantidade, item.minimo);
        return (
          status === "critico" || status === "atencao" || status === "esgotado"
        );
      });

      atualizarDashboardTexto(
        "kpiProdutos",
        "kpiProdutosDesc",
        produtos.length,
        "Produtos ativos no sistema.",
      );
      atualizarDashboardTexto(
        "kpiCores",
        "kpiCoresDesc",
        cores.length,
        `Cores cadastradas: ${cores.join(", ") || "—"}.`,
      );
      atualizarDashboardTexto(
        "kpiTamanhos",
        "kpiTamanhosDesc",
        tamanhos.length,
        `Tamanhos cadastrados: ${tamanhos.join(", ") || "—"}.`,
      );
      atualizarDashboardTexto(
        "kpiAlertas",
        "kpiAlertasDesc",
        alertas.length,
        "Itens com nível de atenção no estoque.",
      );
      atualizarDashboardTexto(
        "kpiEstoqueTotal",
        "kpiEstoqueTotalDesc",
        estoqueTotal,
        "Quantidade total disponível no estoque.",
      );

      console.log("[DASHBOARD] carregado com sucesso.");
    } catch (error) {
      console.error("[DASHBOARD] erro:", error);

      atualizarDashboardTexto(
        "kpiProdutos",
        "kpiProdutosDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiCores",
        "kpiCoresDesc",
        "—",
        "Erro ao carregar dados.",
      );
      atualizarDashboardTexto(
        "kpiTamanhos",
        "kpiTamanhosDesc",
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
        "kpiEstoqueTotal",
        "kpiEstoqueTotalDesc",
        "—",
        "Erro ao carregar dados.",
      );
    } finally {
      dashboardCarregando = false;
    }
  };
})();
