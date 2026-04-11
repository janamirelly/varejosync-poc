(function () {
  let combinacoesGeradas = [];

  const API_PRODUTOS = "http://localhost:3000/produtos";

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

  function slugSku(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-");
  }

  function skuCor(cor) {
    return slugSku(cor);
  }

  function skuTamanho(tamanho) {
    return slugSku(tamanho);
  }

  function getCampo(id) {
    return document.getElementById(id);
  }

  function getValor(id) {
    return getCampo(id)?.value?.trim() || "";
  }

  function getNumero(id) {
    return Number(getCampo(id)?.value || 0);
  }

  function getSelecionados(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    return Array.from(
      container.querySelectorAll('input[type="checkbox"]:checked'),
    )
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function gerarSkuBaseAutomatico() {
    const skuDigitado = getValor("produtoSkuBase");
    if (!skuDigitado) return "";

    const baseNormalizada = slugSku(skuDigitado);

    // Se o usuário colar algo como CAM-BRANCO-M, mantém só a base CAM
    return baseNormalizada.split("-")[0];
  }

  function renderizarPreviewImagem() {
    const input = getCampo("produtoImagem");
    const lista = getCampo("produtoPreviewLista");

    if (!lista) return;

    if (!input || !input.files || !input.files.length) {
      lista.innerHTML = `<div class="upload-preview-empty">Nenhuma imagem adicionada.</div>`;
      return;
    }

    lista.innerHTML = "";

    Array.from(input.files).forEach((file) => {
      const url = URL.createObjectURL(file);

      const item = document.createElement("div");
      item.className = "upload-preview-thumb";
      item.innerHTML = `
      <img src="${url}" alt="${file.name}" />
      <span>${file.name}</span>
    `;

      lista.appendChild(item);
    });
  }

  function renderizarVariacoes(mensagem = "Nenhuma combinação gerada.") {
    const lista = getCampo("variacoesLista");
    const status = getCampo("variacoesStatus");

    if (!lista || !status) return;

    if (!combinacoesGeradas.length) {
      lista.innerHTML = `<div class="empty-state">${mensagem}</div>`;
      status.textContent = "Aguardando geração...";
      return;
    }

    lista.innerHTML = combinacoesGeradas
      .map((item) => {
        return `
          <div class="variacao-item">
            <div class="variacao-item-top">
              <strong>${item.tamanho} — ${item.cor}</strong>
              <span class="status status-ok">Ativa</span>
            </div>
            <div class="variacao-meta">SKU: ${item.sku}</div>
          </div>
        `;
      })
      .join("");

    status.textContent = `${combinacoesGeradas.length} combinação(ões) gerada(s).`;
  }

  function gerarCombinacoes() {
    const tamanhos = getSelecionados("grupoTamanhos");
    const cores = getSelecionados("grupoCores");
    const skuBase = gerarSkuBaseAutomatico();

    if (!tamanhos.length || !cores.length) {
      combinacoesGeradas = [];
      renderizarVariacoes("Selecione pelo menos um tamanho e uma cor.");
      atualizarResumoCadastro();
      return;
    }

    if (!skuBase) {
      combinacoesGeradas = [];
      renderizarVariacoes(
        "Informe nome do produto ou SKU base antes de gerar combinações.",
      );
      atualizarResumoCadastro();
      return;
    }

    const lista = [];

    tamanhos.forEach((tamanho) => {
      cores.forEach((cor) => {
        lista.push({
          tamanho,
          cor,
          sku: `${skuBase}-${skuCor(cor)}-${skuTamanho(tamanho)}`,
        });
      });
    });

    combinacoesGeradas = lista;
    renderizarVariacoes();
    atualizarResumoCadastro();
  }

  function atualizarResumoCadastro() {
    const nome = getValor("produtoNome") || "—";
    const categoria = getValor("produtoCategoria") || "—";
    const preco = getValor("precoVenda");
    const estoque = getValor("estoqueQuantidade");
    const skuBase = gerarSkuBaseAutomatico();

    setText("resumoProdutoCadastro", nome);
    setText("resumoCategoriaCadastro", categoria);
    setText("resumoPrecoCadastro", preco ? `R$ ${preco}` : "—");
    setText("resumoEstoqueCadastro", estoque || "—");
    setText("resumoVariacoesCadastro", combinacoesGeradas.length);
    setText("resumoSkuBaseCadastro", skuBase || "—");
  }

  function limparFormularioProduto() {
    [
      "produtoNome",
      "produtoSkuBase",
      "precoVenda",
      "precoPromocional",
      "custoProduto",
      "estoqueQuantidade",
      "estoqueMinimo",
      "estoqueLocalizacao",
    ].forEach((id) => {
      const el = getCampo(id);
      if (el) el.value = "";
    });

    const categoria = getCampo("produtoCategoria");
    const subcategoria = getCampo("produtoSubcategoria");
    const imagem = getCampo("produtoImagem");

    if (categoria) categoria.value = "";
    if (subcategoria) subcategoria.value = "";
    if (imagem) imagem.value = "";

    ["grupoTamanhos", "grupoCores"].forEach((grupoId) => {
      const grupo = getCampo(grupoId);
      if (!grupo) return;
      grupo.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
    });

    combinacoesGeradas = [];

    renderizarVariacoes();
    renderizarPreviewImagem();
    atualizarResumoCadastro();
  }

  function validarCadastro() {
    const nome = getValor("produtoNome");
    const skuBase = gerarSkuBaseAutomatico();
    const categoria = getValor("produtoCategoria");
    const precoVenda = getValor("precoVenda");
    const estoqueInicial = getValor("estoqueQuantidade");

    if (!nome || !skuBase || !categoria || !precoVenda || !estoqueInicial) {
      return {
        ok: false,
        mensagem:
          "Preencha nome, SKU base oficial, categoria, preço de venda e estoque inicial.",
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

  async function salvarProdutoNoBackend() {
    const token =
      (localStorage.getItem("token") || "").trim() ||
      "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

    const payload = {
      nome: getValor("produtoNome"),
      sku_base: gerarSkuBaseAutomatico(),
      categoria: getValor("produtoCategoria"),
      subcategoria: getValor("produtoSubcategoria"),
      preco_venda: getNumero("precoVenda"),
      preco_promocional: getNumero("precoPromocional"),
      custo_produto: getNumero("custoProduto"),
      estoque_inicial: getNumero("estoqueQuantidade"),
      estoque_minimo: getNumero("estoqueMinimo"),
      localizacao_estoque: getValor("estoqueLocalizacao"),
      variacoes: combinacoesGeradas.map((item) => ({
        tamanho: item.tamanho,
        cor: item.cor,
        sku: item.sku,
      })),
    };

    const response = await fetch(API_PRODUTOS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const texto = await response.text();
    let data = {};

    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      data = { raw: texto };
    }

    if (!response.ok) {
      throw new Error(
        data.erro ||
          data.error ||
          data.message ||
          data.raw ||
          `Erro HTTP ${response.status}`,
      );
    }

    return data;
  }

  window.inicializarTelaProdutos = function () {
    const btnGerar = getCampo("btnGerarCombinacoes");
    const btnSalvar = getCampo("btnSalvarProduto");
    const btnCancelar = getCampo("btnCancelarProduto");
    const btnVoltarInicio = getCampo("btnVoltarInicioProduto");
    const btnNovoProduto = getCampo("btnNovoProduto");
    const btnCancelarErro = getCampo("btnCancelarErroProduto");
    const btnTentarNovamente = getCampo("btnTentarNovamenteProduto");
    const inputImagem = getCampo("produtoImagem");

    const camposResumo = [
      "produtoNome",
      "produtoSkuBase",
      "produtoCategoria",
      "produtoSubcategoria",
      "precoVenda",
      "precoPromocional",
      "custoProduto",
      "estoqueQuantidade",
      "estoqueMinimo",
      "estoqueLocalizacao",
    ];

    camposResumo.forEach((id) => {
      const campo = getCampo(id);
      if (campo) {
        campo.addEventListener("input", atualizarResumoCadastro);
        campo.addEventListener("change", atualizarResumoCadastro);
      }
    });

    ["grupoTamanhos", "grupoCores"].forEach((grupoId) => {
      const grupo = getCampo(grupoId);
      if (!grupo) return;
      grupo.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener("change", atualizarResumoCadastro);
      });
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
      btnSalvar.onclick = async function () {
        const validacao = validarCadastro();

        if (!validacao.ok) {
          const erroTexto = getCampo("produtoModalErroTexto");
          if (erroTexto) erroTexto.textContent = validacao.mensagem;
          abrirModal("modalProdutoErro");
          return;
        }

        try {
          await salvarProdutoNoBackend();

          const nome = getValor("produtoNome") || "produto";
          const textoSucesso = getCampo("produtoModalSucessoTexto");
          if (textoSucesso) {
            textoSucesso.textContent = `O produto "${nome}" foi registrado no sistema e já está disponível para uso.`;
          }

          abrirModal("modalProdutoSucesso");
        } catch (error) {
          const erroTexto = getCampo("produtoModalErroTexto");
          if (erroTexto) erroTexto.textContent = error.message;
          abrirModal("modalProdutoErro");
        }
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
        if (typeof loadPage === "function") {
          loadPage("dashboard");
        }
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
