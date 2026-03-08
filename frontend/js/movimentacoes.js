let produtoSelecionado = null;

(function () {
  const produtosMock = [
    {
      nome: "Camiseta Básica",
      sku: "CAM-001-PB",
      categoria: "Moda Feminina",
      cor: "Preto",
      tamanho: "M",
      estoqueAtual: 1,
      estoqueMinimo: 10,
    },
    {
      nome: "Calça Jeans",
      sku: "CAJ-AZUL-M",
      categoria: "Moda Feminina",
      cor: "Azul",
      tamanho: "M",
      estoqueAtual: 11,
      estoqueMinimo: 4,
    },
    {
      nome: "Camiseta Básica",
      sku: "CAM-BRANCO-P",
      categoria: "Moda Feminina",
      cor: "Branco",
      tamanho: "P",
      estoqueAtual: 9,
      estoqueMinimo: 4,
    },
  ];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function mostrarProdutoInfo(mostrar) {
    const box = document.getElementById("movProdutoInfo");
    if (!box) return;
    box.classList.toggle("hidden", !mostrar);
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

  function buscarProduto() {
    const campoBusca = document.getElementById("movBuscaProduto");
    if (!campoBusca) return;

    const termo = campoBusca.value.trim().toLowerCase();
    if (!termo) {
      alert("Digite um produto, SKU ou variação para buscar.");
      return;
    }

    const encontrado = produtosMock.find((item) => {
      return (
        item.nome.toLowerCase().includes(termo) ||
        item.sku.toLowerCase().includes(termo) ||
        item.cor.toLowerCase().includes(termo) ||
        item.tamanho.toLowerCase().includes(termo)
      );
    });

    if (!encontrado) {
      alert("Produto não encontrado na simulação.");
      limparProduto();
      return;
    }

    preencherProduto(encontrado);
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
