async function loadPage(page) {
  const main = document.getElementById("appMain");
  if (!main) return;

  try {
    console.log(`[APP] carregando página: ${page}`);

    const response = await fetch(`./pages/${page}.html?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar ${page}.html`);
    }

    const html = await response.text();
      main.innerHTML = html;
       marcarMenuAtivo(page);

    const inicializadores = {
      dashboard: window.inicializarTelaDashboard,
      estoque: window.inicializarTelaEstoque,
      produtos: window.inicializarTelaProdutos,
      vendas: window.inicializarTelaVendas,
      alertas: window.inicializarTelaAlertas,
      movimentacoes: window.inicializarTelaMovimentacoes,
    };

    const init = inicializadores[page];

    // importante: espera o HTML realmente entrar no DOM
    requestAnimationFrame(() => {
      if (typeof init === "function") {
        init();
      } else {
        console.warn(`[APP] inicializador não encontrado para: ${page}`);
      }
    });
  } catch (error) {
    console.error("[APP] erro ao carregar página:", error);
    main.innerHTML = `<p style="color:red; padding:20px;">Erro ao abrir ${page}: ${error.message}</p>`;
  }
}
function marcarMenuAtivo(page) {
  const botoes = document.querySelectorAll(".menu button");

  botoes.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
}

function configurarMenu() {
  const botoes = document.querySelectorAll(".menu button");

  botoes.forEach((btn) => {
    btn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const page = btn.dataset.page;
      if (!page) return;

      loadPage(page);
    };
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[APP] iniciada");
  configurarMenu();
  loadPage("dashboard");
});
