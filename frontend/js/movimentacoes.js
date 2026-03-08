let produtoSelecionado = null;

(function () {
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function mostrarProdutoInfo(mostrar) {
    const box = document.getElementById("movProdutoInfo");
    if (!box) return;
    box.classList.toggle("hidden", !mostrar);
  }

  function normalizarProduto(item) {
    return {
      idVariacao: item.id_variacao ?? item.id ?? null,
      nome: item.nome_produto ?? item.produto ?? "—",
      sku: item.sku ?? "—",
      categoria: item.categoria ?? "Sem categoria",
      cor: item.cor ?? "—",
      tamanho: item.tamanho ?? "—",
      estoqueAtual: Number(item.quantidade_atual ?? item.quantidade ?? 0),
      estoqueMinimo: Number(
        item.estoque_min ?? item.estoque_minimo ?? item.minimo ?? 0,
      ),
    };
  }

  function preencherProduto(produto) {
    if (!produto) return;

    produtoSelecionado = produto;

    setText("movProdutoNome", produto.nome);
    setText("movProdutoSku", produto.sku);
    setText("movProdutoCategoria", produto.categoria);
    setText("movProdutoCor", produto.cor);
    setText("movProdutoTamanho", produto.tamanho);
    setText("movProdutoEstoque", produto.estoqueAtual);
    setText("movProdutoMinimo", `${produto.estoqueMinimo} unidades`);

    mostrarProdutoInfo(true);
    atualizarResumo();
  }

  function limparProduto() {
    produtoSelecionado = null;

    setText("movProdutoNome", "—");
    setText("movProdutoSku", "—");
    setText("movProdutoCategoria", "—");
    setText("movProdutoCor", "—");
    setText("movProdutoTamanho", "—");
    setText("movProdutoEstoque", "—");
    setText("movProdutoMinimo", "—");

    mostrarProdutoInfo(false);
    atualizarResumo();
  }

  function calcularNovoEstoque(tipo, quantidade, estoqueAtual) {
    const qtd = Number(quantidade) || 0;
    const atual = Number(estoqueAtual) || 0;

    if (tipo === "ENTRADA") return atual + qtd;
    if (tipo === "SAIDA") return Math.max(0, atual - qtd);
    if (tipo === "AJUSTE") return qtd;

    return atual;
  }

  function formatarTipo(tipo) {
    if (tipo === "ENTRADA") return "Entrada";
    if (tipo === "SAIDA") return "Saída";
    if (tipo === "AJUSTE") return "Ajuste";
    return "—";
  }

  function atualizarResumo() {
    const tipo = document.getElementById("movTipo")?.value || "";
    const quantidade = Number(
      document.getElementById("movQuantidade")?.value || 0,
    );
    const motivo = document.getElementById("movMotivo")?.value || "—";

    if (!produtoSelecionado) {
      setText("resumoProduto", "—");
      setText("resumoTipo", "—");
      setText("resumoQuantidade", "0");
      setText("resumoMotivo", "—");
      setText("resumoNovoEstoque", "—");
      return;
    }

    setText(
      "resumoProduto",
      `${produtoSelecionado.nome} — ${produtoSelecionado.cor} — ${produtoSelecionado.tamanho}`,
    );
    setText("resumoTipo", formatarTipo(tipo));
    setText("resumoQuantidade", quantidade);
    setText("resumoMotivo", motivo);

    const novo = calcularNovoEstoque(
      tipo,
      quantidade,
      produtoSelecionado.estoqueAtual,
    );

    setText("resumoNovoEstoque", novo);
  }

  function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("hidden");
  }

  function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
  }

  function limparFormulario() {
    const busca = document.getElementById("movBuscaProduto");
    const tipo = document.getElementById("movTipo");
    const quantidade = document.getElementById("movQuantidade");
    const motivo = document.getElementById("movMotivo");

    if (busca) busca.value = "";
    if (tipo) tipo.value = "";
    if (quantidade) quantidade.value = "0";
    if (motivo) motivo.value = "";

    limparProduto();
  }

  async function buscarProduto() {
    const campoBusca = document.getElementById("movBuscaProduto");
    if (!campoBusca) return;

    const termo = campoBusca.value.trim().toLowerCase();

    if (!termo) {
      alert("Digite nome, SKU ou variação para buscar.");
      return;
    }

    try {
      const token =
        (localStorage.getItem("token") || "").trim() ||
        "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

      const response = await fetch("http://localhost:3000/estoque", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const lista = Array.isArray(resultado)
        ? resultado
        : Array.isArray(resultado.itens)
          ? resultado.itens
          : [];

      const encontrado = lista.find((item) => {
        const nome = String(
          item.nome_produto ?? item.produto ?? "",
        ).toLowerCase();
        const sku = String(item.sku ?? "").toLowerCase();
        const cor = String(item.cor ?? "").toLowerCase();
        const tamanho = String(item.tamanho ?? "").toLowerCase();
        const variacao = `${cor} ${tamanho}`.trim();

        return (
          nome.includes(termo) ||
          sku.includes(termo) ||
          cor.includes(termo) ||
          tamanho.includes(termo) ||
          variacao.includes(termo)
        );
      });

      if (!encontrado) {
        alert("Nenhum produto encontrado para a busca informada.");
        limparProduto();
        return;
      }

      preencherProduto(normalizarProduto(encontrado));
    } catch (error) {
      console.error("[MOVIMENTACOES] erro ao buscar produto:", error);
      alert(`Erro ao buscar produto: ${error.message}`);
      limparProduto();
    }
  }

  window.inicializarTelaMovimentacoes = function () {
    const campoBusca = document.getElementById("movBuscaProduto");
    const btnBuscar = document.getElementById("btnBuscarMov");
    const movTipo = document.getElementById("movTipo");
    const movQuantidade = document.getElementById("movQuantidade");
    const movMotivo = document.getElementById("movMotivo");
    const btnConfirmar = document.getElementById("btnConfirmarMov");
    const btnCancelar = document.getElementById("btnCancelarMov");
    const btnVoltarSucesso = document.getElementById("btnVoltarMovSucesso");
    const btnVoltarCancelada = document.getElementById("btnVoltarMovCancelada");

    limparProduto();

    if (campoBusca) {
      campoBusca.onkeydown = function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          buscarProduto();
        }
      };
    }

    if (btnBuscar) {
      btnBuscar.onclick = function () {
        buscarProduto();
      };
    }

    if (movTipo) movTipo.onchange = atualizarResumo;
    if (movQuantidade) movQuantidade.oninput = atualizarResumo;
    if (movMotivo) movMotivo.onchange = atualizarResumo;

    if (btnConfirmar) {
      btnConfirmar.onclick = function () {
        const tipo = document.getElementById("movTipo")?.value || "";
        const quantidade = Number(
          document.getElementById("movQuantidade")?.value || 0,
        );
        const motivo = document.getElementById("movMotivo")?.value || "";

        if (!produtoSelecionado) {
          alert("Busque e selecione um produto antes de confirmar.");
          return;
        }

        if (!tipo || !motivo || quantidade <= 0) {
          alert(
            "Preencha tipo, quantidade e motivo para confirmar a movimentação.",
          );
          return;
        }

        abrirModal("modalMovSucesso");
      };
    }

    if (btnCancelar) {
      btnCancelar.onclick = function () {
        abrirModal("modalMovCancelada");
      };
    }

    if (btnVoltarSucesso) {
      btnVoltarSucesso.onclick = function () {
        fecharModal("modalMovSucesso");
        limparFormulario();
      };
    }

    if (btnVoltarCancelada) {
      btnVoltarCancelada.onclick = function () {
        fecharModal("modalMovCancelada");
        limparFormulario();
      };
    }
  };
})();
