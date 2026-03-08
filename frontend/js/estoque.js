(function () {
  let estoqueCarregando = false;

  function popularFiltros(itens) {
    const selectCor = document.getElementById("filtroCor");
    const selectTam = document.getElementById("filtroTamanho");

    if (!selectCor || !selectTam) return;

    const cores = [...new Set(itens.map((i) => i.cor).filter(Boolean))];
    const tamanhos = [...new Set(itens.map((i) => i.tamanho).filter(Boolean))];

    selectCor.innerHTML = '<option value="">Todas as cores</option>';
    selectTam.innerHTML = '<option value="">Todos os tamanhos</option>';

    cores.forEach((cor) => {
      const opt = document.createElement("option");
      opt.value = cor;
      opt.textContent = cor;
      selectCor.appendChild(opt);
    });

    tamanhos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selectTam.appendChild(opt);
    });
  }

  function atualizarEstadoInicial() {
    const body = document.getElementById("tabelaEstoqueBody");
    const status = document.getElementById("estoqueStatus");

    if (body) {
      body.innerHTML =
        '<tr><td colspan="8" class="empty-state">Nenhum dado carregado.</td></tr>';
    }

    if (status) {
      status.textContent = "Aguardando consulta...";
    }
  }

  async function consultarEstoque() {
    if (estoqueCarregando) {
      console.log("[ESTOQUE] consulta ignorada: já existe uma em andamento.");
      return;
    }

    const body = document.getElementById("tabelaEstoqueBody");
    const status = document.getElementById("estoqueStatus");
    const campoBusca = document.getElementById("filtroBuscaEstoque");
    const filtroCor = document.getElementById("filtroCor");
    const filtroTamanho = document.getElementById("filtroTamanho");

    const termo = campoBusca ? campoBusca.value.trim().toLowerCase() : "";
    const corSelecionada = filtroCor
      ? filtroCor.value.trim().toLowerCase()
      : "";
    const tamanhoSelecionado = filtroTamanho
      ? filtroTamanho.value.trim().toLowerCase()
      : "";

    console.log("[ESTOQUE] consultarEstoque INÍCIO. termo =", termo);

    if (!body || !status) {
      console.warn("[ESTOQUE] body/status não encontrados.");
      return;
    }

    estoqueCarregando = true;

    body.innerHTML =
      '<tr><td colspan="8" class="empty-state">Carregando...</td></tr>';
    status.textContent = "Consultando dados...";

    try {
      const token =
        (localStorage.getItem("token") || "").trim() ||
        "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

      const query = termo ? `?q=${encodeURIComponent(termo)}` : "";
      const url = `http://localhost:3000/estoque${query}`;

      console.log("[ESTOQUE] FETCH URL:", url);
      console.log("[ESTOQUE] FETCH TOKEN:", token);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[ESTOQUE] STATUS HTTP:", response.status);

      const texto = await response.text();
      console.log("[ESTOQUE] TEXTO BRUTO:", texto);

      let resultado = [];

      try {
        resultado = texto ? JSON.parse(texto) : [];
      } catch (e) {
        console.error("[ESTOQUE] erro ao converter JSON:", e);
        throw new Error("Resposta inválida da API.");
      }

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const itens = Array.isArray(resultado)
        ? resultado
        : Array.isArray(resultado.itens)
          ? resultado.itens
          : [];

      popularFiltros(itens);

      const itensFiltrados = itens.filter((item) => {
        const nomeProduto = String(
          item.nome_produto ?? item.produto ?? "",
        ).toLowerCase();
        const sku = String(item.sku ?? "").toLowerCase();
        const cor = String(item.cor ?? "").toLowerCase();
        const tamanho = String(item.tamanho ?? "").toLowerCase();

        const atendeBusca =
          !termo ||
          nomeProduto.includes(termo) ||
          sku.includes(termo) ||
          cor.includes(termo) ||
          tamanho.includes(termo);

        const atendeCor = !corSelecionada || cor === corSelecionada;
        const atendeTamanho =
          !tamanhoSelecionado || tamanho === tamanhoSelecionado;

        return atendeBusca && atendeCor && atendeTamanho;
      });

      console.log("[ESTOQUE] TOTAL DE ITENS:", itens.length);

      if (itensFiltrados.length === 0) {
        body.innerHTML =
          '<tr><td colspan="8" class="empty-state">Nenhum item encontrado.</td></tr>';
        status.textContent = "Consulta vazia.";
        return;
      }

      const html = itensFiltrados
        .map((item) => {
          const qtd = Number(item.quantidade_atual ?? item.quantidade ?? 0);
          const min = Number(item.estoque_min ?? item.minimo ?? 0);

          const statusBackend = String(item.status ?? "").toUpperCase();

          let classeStatus = "status-ok";
          let textoStatus = "Disponível";

          if (statusBackend === "ESGOTADO") {
            classeStatus = "status-out";
            textoStatus = "Esgotado";
          } else if (statusBackend === "CRITICO") {
            classeStatus = "status-critical";
            textoStatus = "Crítico";
          } else if (statusBackend === "ATENCAO") {
            classeStatus = "status-warning";
            textoStatus = "Atenção";
          } else if (statusBackend === "DISPONIVEL") {
            classeStatus = "status-ok";
            textoStatus = "Disponível";
          } else {
            if (qtd === 0) {
              classeStatus = "status-out";
              textoStatus = "Esgotado";
            } else if (qtd < min) {
              classeStatus = "status-critical";
              textoStatus = "Crítico";
            } else if (qtd <= min + 2) {
              classeStatus = "status-warning";
              textoStatus = "Atenção";
            }
          }

          return `
            <tr>
              <td>${item.id_variacao ?? item.id ?? "—"}</td>
              <td>${item.nome_produto ?? item.produto ?? "—"}</td>
              <td>${item.cor ?? "—"}</td>
              <td>${item.tamanho ?? "—"}</td>
              <td>${item.sku ?? "—"}</td>
              <td>${qtd}</td>
              <td>${min}</td>
              <td><span class="status ${classeStatus}">${textoStatus}</span></td>
            </tr>
          `;
        })
        .join("");

      body.innerHTML = html;
      status.textContent = `${itensFiltrados.length} itens carregados com sucesso.`;

      console.log("[ESTOQUE] renderização concluída.");
    } catch (erro) {
      console.error("[ESTOQUE] erro final:", erro);

      body.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state" style="color:red;">
            Erro: ${erro.message}
          </td>
        </tr>
      `;

      status.textContent = "Erro ao consultar estoque.";
    } finally {
      estoqueCarregando = false;
      console.log("[ESTOQUE] consultarEstoque FIM.");
    }
  }

  window.inicializarTelaEstoque = function () {
    console.log("[ESTOQUE] inicializarTelaEstoque chamada");

    const btnBuscar = document.getElementById("btnBuscarEstoque");
    const btnLimpar = document.getElementById("btnLimparBuscaEstoque");
    const campoBusca = document.getElementById("filtroBuscaEstoque");

    if (!btnBuscar || !btnLimpar) {
      console.warn("[ESTOQUE] botões não encontrados.");
      return;
    }

    atualizarEstadoInicial();

    btnBuscar.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();

      console.log("[ESTOQUE] clique em Consultar");
      consultarEstoque();
    };

    btnLimpar.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();

      console.log("[ESTOQUE] clique em Limpar");

      if (campoBusca) campoBusca.value = "";
      atualizarEstadoInicial();
    };

    console.log("[ESTOQUE] eventos ligados");
  };
})();
