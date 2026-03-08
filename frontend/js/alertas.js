(function () {
  function getStatusAlerta(item) {
    const qtd = Number(
      item.quantidade_atual ?? item.quantidade ?? item.estoque_atual ?? 0,
    );

    const min = Number(
      item.estoque_min ??
        item.estoque_minimo ??
        item.minimo ??
        item.quantidade_minima ??
        0,
    );

    const statusBackend = String(item.status ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    if (statusBackend === "ESGOTADO") {
      return {
        texto: "Esgotado",
        classe: "status-out",
        descricao: "Produto sem saldo disponível no estoque.",
      };
    }

    if (statusBackend === "CRITICO") {
      return {
        texto: "Crítico",
        classe: "status-critical",
        descricao: "Reposição imediata recomendada.",
      };
    }

    if (statusBackend === "ATENCAO") {
      return {
        texto: "Atenção",
        classe: "status-warning",
        descricao: "Estoque abaixo do ideal.",
      };
    }

    if (qtd === 0) {
      return {
        texto: "Esgotado",
        classe: "status-out",
        descricao: "Produto sem saldo disponível no estoque.",
      };
    }

    if (qtd < min) {
      return {
        texto: "Crítico",
        classe: "status-critical",
        descricao: "Reposição imediata recomendada.",
      };
    }

    if (qtd <= min + 2) {
      return {
        texto: "Atenção",
        classe: "status-warning",
        descricao: "Estoque abaixo do ideal.",
      };
    }

    return {
      texto: "Disponível",
      classe: "status-ok",
      descricao: "Estoque dentro do nível esperado.",
    };
  }

  function normalizarItemAlerta(item) {
    const quantidade =
      item.quantidade_atual ?? item.quantidade ?? item.estoque_atual ?? 0;

    const minimo =
      item.estoque_min ??
      item.estoque_minimo ??
      item.minimo ??
      item.quantidade_minima ??
      0;

    const produto = item.nome_produto ?? item.produto ?? item.nome ?? "—";
    const cor = item.cor ?? item.nome_cor ?? item.variacao_cor ?? "—";
    const tamanho =
      item.tamanho ?? item.nome_tamanho ?? item.variacao_tamanho ?? "—";

    const status = getStatusAlerta(item);

    return {
      produto,
      cor,
      tamanho,
      quantidade,
      minimo,
      statusTexto: status.texto,
      statusClasse: status.classe,
      descricao: status.descricao,
    };
  }

  function renderizarAlertas(itens) {
    const lista = document.getElementById("alertasLista");
    const status = document.getElementById("alertasStatus");

    if (!lista || !status) return;

    if (!itens.length) {
      lista.innerHTML = `<div class="empty-state">Nenhum alerta encontrado.</div>`;
      status.textContent = "Consulta concluída.";
      return;
    }

    lista.innerHTML = itens
      .map((item) => {
        return `
          <article class="alerta-card">
            <div class="alerta-card-top">
              <div>
                <h4 class="alerta-title">${item.produto}</h4>
                <p class="alerta-subtitle">${item.cor} • ${item.tamanho}</p>
              </div>

              <span class="status ${item.statusClasse}">
                ${item.statusTexto}
              </span>
            </div>

            <div class="alerta-body">
              <p class="alerta-text">${item.descricao}</p>
              <p class="alerta-meta">
                Quantidade atual: <strong>${item.quantidade}</strong>
              </p>
              <p class="alerta-meta">
                Estoque mínimo: <strong>${item.minimo}</strong>
              </p>
            </div>
          </article>
        `;
      })
      .join("");

    status.textContent = `${itens.length} alerta(s) encontrado(s).`;
  }

  window.inicializarTelaAlertas = async function () {
    const lista = document.getElementById("alertasLista");
    const status = document.getElementById("alertasStatus");

    if (!lista || !status) return;

    lista.innerHTML = `<div class="empty-state">Carregando alertas...</div>`;
    status.textContent = "Consultando estoque...";

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

      const listaBruta = Array.isArray(resultado)
        ? resultado
        : Array.isArray(resultado.itens)
          ? resultado.itens
          : Array.isArray(resultado.data)
            ? resultado.data
            : [];

      const itens = listaBruta.map(normalizarItemAlerta);

      const alertas = itens.filter((item) => {
        return (
          item.statusTexto === "Crítico" ||
          item.statusTexto === "Atenção" ||
          item.statusTexto === "Esgotado"
        );
      });

      renderizarAlertas(alertas);
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
      lista.innerHTML = `<div class="empty-state error-text">${error.message}</div>`;
      status.textContent = "Erro na consulta.";
    }
  };
})();
