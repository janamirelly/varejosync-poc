(function () {
  let movimentacoesCache = [];
  let historicoCarregando = false;

  const API_HISTORICO = "http://localhost:3000/movimentacoes";

  function getCampo(id) {
    return document.getElementById(id);
  }

  function getValor(id) {
    return getCampo(id)?.value?.trim() || "";
  }

  function getToken() {
    return (
      (localStorage.getItem("token") || "").trim() ||
      "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t"
    );
  }

  function setStatus(texto) {
    const status = getCampo("historicoStatus");
    if (status) status.textContent = texto;
  }

  function atualizarEstadoInicial() {
    const body = getCampo("historicoTabelaBody");
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">Carregando movimentações...</td>
      </tr>
    `;
    setStatus("Carregando dados...");
  }

  function normalizarData(valor) {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";

    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatarData(valor) {
    if (!valor) return "—";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleDateString("pt-BR");
  }

  function formatarTipo(tipo) {
    const valor = String(tipo || "").toUpperCase();
    if (valor === "ENTRADA") return "Entrada";
    if (valor === "SAIDA") return "Saída";
    if (valor === "AJUSTE") return "Ajuste";
    return tipo || "—";
  }

  function normalizarMovimentacao(item) {
    return {
      data: item.data_movimentacao || item.criado_em || "",
      tipo: String(item.tipo || "").toUpperCase(),
      produto: item.nome_produto || "—",
      sku: item.sku || "—",
      categoria: item.categoria || "Sem categoria",
      quantidade: Number(item.quantidade || 0),
      motivo: item.motivo || item.observacao || "—",
      usuario: item.nome_usuario || "—",
    };
  }

  function renderizarTabela(lista) {
    const body = getCampo("historicoTabelaBody");
    if (!body) return;

    if (!lista.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">Nenhuma movimentação encontrada.</td>
        </tr>
      `;
      setStatus("Consulta vazia.");
      return;
    }

    body.innerHTML = lista
      .map((item) => {
        return `
          <tr>
            <td>${formatarData(item.data)}</td>
            <td>${formatarTipo(item.tipo)}</td>
            <td>${item.produto}</td>
            <td>${item.sku}</td>
            <td>${item.categoria}</td>
            <td>${item.quantidade}</td>
            <td>${item.motivo}</td>
            <td>${item.usuario}</td>
          </tr>
        `;
      })
      .join("");

    setStatus(`${lista.length} movimentação(ões) encontrada(s).`);
  }

  function aplicarFiltros() {
    const dataInicial = getValor("histDataInicial");
    const dataFinal = getValor("histDataFinal");
    const tipo = getValor("histTipo").toUpperCase();
    const busca = getValor("histBuscaProduto").toLowerCase();

    const listaFiltrada = movimentacoesCache.filter((item) => {
      const dataItem = normalizarData(item.data);

      const atendeDataInicial = !dataInicial || dataItem >= dataInicial;
      const atendeDataFinal = !dataFinal || dataItem <= dataFinal;
      const atendeTipo = !tipo || item.tipo === tipo;

      const textoBusca =
        `${item.produto} ${item.sku} ${item.categoria}`.toLowerCase();
      const atendeBusca = !busca || textoBusca.includes(busca);

      return atendeDataInicial && atendeDataFinal && atendeTipo && atendeBusca;
    });

    renderizarTabela(listaFiltrada);
  }

  async function carregarHistorico() {
    if (historicoCarregando) return;

    historicoCarregando = true;
    atualizarEstadoInicial();

    try {
      const response = await fetch(API_HISTORICO, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const texto = await response.text();
      let resultado = [];

      try {
        resultado = texto ? JSON.parse(texto) : [];
      } catch {
        throw new Error("Resposta inválida da API.");
      }

      if (!response.ok) {
        throw new Error(
          resultado.erro ||
            resultado.error ||
            resultado.message ||
            `Erro HTTP ${response.status}`,
        );
      }

      const listaBruta = Array.isArray(resultado)
        ? resultado
        : Array.isArray(resultado.itens)
          ? resultado.itens
          : Array.isArray(resultado.data)
            ? resultado.data
            : [];

      movimentacoesCache = listaBruta.map(normalizarMovimentacao);
      aplicarFiltros();
    } catch (error) {
      const body = getCampo("historicoTabelaBody");
      if (body) {
        body.innerHTML = `
          <tr>
            <td colspan="8" class="empty-state error-text">${error.message}</td>
          </tr>
        `;
      }
      setStatus("Erro ao carregar histórico.");
      console.error("[HISTORICO] erro:", error);
    } finally {
      historicoCarregando = false;
    }
  }

  function limparFiltros() {
    [
      "histDataInicial",
      "histDataFinal",
      "histTipo",
      "histBuscaProduto",
    ].forEach((id) => {
      const campo = getCampo(id);
      if (campo) campo.value = "";
    });

    renderizarTabela(movimentacoesCache);
  }

  window.inicializarTelaHistorico = function () {
    const btnFiltrar = getCampo("btnFiltrarHistorico");
    const btnLimpar = getCampo("btnLimparHistorico");
    const campoBusca = getCampo("histBuscaProduto");
    const histDataInicial = getCampo("histDataInicial");
    const histDataFinal = getCampo("histDataFinal");
    const histTipo = getCampo("histTipo");

    if (btnFiltrar) {
      btnFiltrar.onclick = function () {
        aplicarFiltros();
      };
    }

    if (btnLimpar) {
      btnLimpar.onclick = function () {
        limparFiltros();
      };
    }

    if (campoBusca) {
      campoBusca.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          aplicarFiltros();
        }
      });
    }

    if (histDataInicial)
      histDataInicial.addEventListener("change", aplicarFiltros);
    if (histDataFinal) histDataFinal.addEventListener("change", aplicarFiltros);
    if (histTipo) histTipo.addEventListener("change", aplicarFiltros);

    carregarHistorico();
  };
})();
