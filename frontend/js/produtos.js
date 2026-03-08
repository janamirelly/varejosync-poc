(function () {
  let combinacoesGeradas = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("hidden");
  }

  function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
  }

  function limparFormularioProduto() {
    const ids = [
      "produtoNome",
      "produtoSkuBase",
      "precoVenda",
      "precoPromocional",
      "custoProduto",
      "estoqueQuantidade",
      "estoqueMinimo",
      "estoqueLocalizacao",
      "variacoesTamanhos",
      "variacoesCores",
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const categoria = document.getElementById("produtoCategoria");
    const subcategoria = document.getElementById("produtoSubcategoria");
    const imagem = document.getElementById("produtoImagem");

    if (categoria) categoria.value = "";
    if (subcategoria) subcategoria.value = "";
    if (imagem) imagem.value = "";

    combinacoesGeradas = [];

    renderizarVariacoes();
    renderizarPreviewImagem();
    atualizarResumoCadastro();
  }

  function normalizarLista(texto) {
    return String(texto || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function gerarCombinacoes() {
    const tamanhos = normalizarLista(
      document.getElementById("variacoesTamanhos")?.value,
    );
    const cores = normalizarLista(
      document.getElementById("variacoesCores")?.value,
    );

    if (!tamanhos.length || !cores.length) {
      combinacoesGeradas = [];
      renderizarVariacoes(
        "Informe tamanhos e cores para gerar as combinações.",
      );
      atualizarResumoCadastro();
      return;
    }

    const lista = [];

    tamanhos.forEach((tamanho) => {
      cores.forEach((cor) => {
        lista.push(`${tamanho} — ${cor}`);
      });
    });

    combinacoesGeradas = lista;
    renderizarVariacoes();
    atualizarResumoCadastro();
  }

  function renderizarVariacoes(mensagemVazia = "Nenhuma combinação gerada.") {
    const lista = document.getElementById("variacoesLista");
    const status = document.getElementById("variacoesStatus");

    if (!lista || !status) return;

    if (!combinacoesGeradas.length) {
      lista.innerHTML = `<div class="empty-state">${mensagemVazia}</div>`;
      status.textContent = "Aguardando geração...";
      return;
    }

    lista.innerHTML = combinacoesGeradas
      .map((item) => `<div class="variacao-item">${item}</div>`)
      .join("");

    status.textContent = `${combinacoesGeradas.length} combinação(ões) gerada(s).`;
  }

  function renderizarPreviewImagem() {
    const input = document.getElementById("produtoImagem");
    const lista = document.getElementById("produtoPreviewLista");

    if (!lista) return;

    if (!input || !input.files || !input.files.length) {
      lista.innerHTML = `<div class="upload-preview-empty">Nenhuma imagem adicionada.</div>`;
      return;
    }

    lista.innerHTML = "";

    Array.from(input.files).forEach((file) => {
      const item = document.createElement("div");
      item.className = "upload-preview-item";
      item.textContent = file.name;
      lista.appendChild(item);
    });
  }

  function atualizarResumoCadastro() {
    const nome = document.getElementById("produtoNome")?.value.trim() || "—";
    const categoria = document.getElementById("produtoCategoria")?.value || "—";
    const preco = document.getElementById("precoVenda")?.value || "—";
    const estoque = document.getElementById("estoqueQuantidade")?.value || "—";

    setText("resumoProdutoCadastro", nome);
    setText("resumoCategoriaCadastro", categoria);
    setText("resumoPrecoCadastro", preco !== "—" ? `R$ ${preco}` : "—");
    setText("resumoEstoqueCadastro", estoque);
    setText("resumoVariacoesCadastro", combinacoesGeradas.length);
  }

  function validarCadastro() {
    const nome = document.getElementById("produtoNome")?.value.trim();
    const skuBase = document.getElementById("produtoSkuBase")?.value.trim();
    const categoria = document.getElementById("produtoCategoria")?.value;
    const preco = document.getElementById("precoVenda")?.value;
    const estoque = document.getElementById("estoqueQuantidade")?.value;

    if (!nome || !skuBase || !categoria || !preco || !estoque) {
      return {
        ok: false,
        mensagem:
          "Preencha nome, SKU base, categoria, preço de venda e estoque inicial.",
      };
    }

    if (!combinacoesGeradas.length) {
      return {
        ok: false,
        mensagem: "Gere pelo menos uma combinação de variação antes de salvar.",
      };
    }

    return { ok: true, mensagem: "" };
  }

  window.inicializarTelaProdutos = function () {
    const btnGerar = document.getElementById("btnGerarCombinacoes");
    const btnSalvar = document.getElementById("btnSalvarProduto");
    const btnCancelar = document.getElementById("btnCancelarProduto");
    const btnVoltarInicio = document.getElementById("btnVoltarInicioProduto");
    const btnNovoProduto = document.getElementById("btnNovoProduto");
    const btnCancelarErro = document.getElementById("btnCancelarErroProduto");
    const btnTentarNovamente = document.getElementById(
      "btnTentarNovamenteProduto",
    );
    const inputImagem = document.getElementById("produtoImagem");

    const camposResumo = [
      "produtoNome",
      "produtoCategoria",
      "precoVenda",
      "estoqueQuantidade",
      "variacoesTamanhos",
      "variacoesCores",
    ];

    camposResumo.forEach((id) => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.addEventListener("input", atualizarResumoCadastro);
        campo.addEventListener("change", atualizarResumoCadastro);
      }
    });

    if (inputImagem) {
      inputImagem.addEventListener("change", renderizarPreviewImagem);
    }

    if (btnGerar) {
      btnGerar.onclick = function () {
        gerarCombinacoes();
      };
    }

    if (btnSalvar) {
      btnSalvar.onclick = function () {
        const validacao = validarCadastro();

        if (!validacao.ok) {
          const erroTexto = document.getElementById("produtoModalErroTexto");
          if (erroTexto) erroTexto.textContent = validacao.mensagem;
          abrirModal("modalProdutoErro");
          return;
        }

        const nome =
          document.getElementById("produtoNome")?.value.trim() || "produto";
        const textoSucesso = document.getElementById(
          "produtoModalSucessoTexto",
        );
        if (textoSucesso) {
          textoSucesso.textContent = `O produto "${nome}" foi registrado no sistema e já está disponível para uso.`;
        }

        abrirModal("modalProdutoSucesso");
      };
    }

    if (btnCancelar) {
      btnCancelar.onclick = function () {
        limparFormularioProduto();
      };
    }

    if (btnVoltarInicio) {
      btnVoltarInicio.onclick = function () {
        fecharModal("modalProdutoSucesso");
        loadPage("dashboard");
      };
    }

    if (btnNovoProduto) {
      btnNovoProduto.onclick = function () {
        fecharModal("modalProdutoSucesso");
        limparFormularioProduto();
      };
    }

    if (btnCancelarErro) {
      btnCancelarErro.onclick = function () {
        fecharModal("modalProdutoErro");
      };
    }

    if (btnTentarNovamente) {
      btnTentarNovamente.onclick = function () {
        fecharModal("modalProdutoErro");
      };
    }

    renderizarVariacoes();
    renderizarPreviewImagem();
    atualizarResumoCadastro();
  };
})();
