function obterPerfilAtual() {
  return localStorage.getItem("perfil") || "";
}

function obterNomeUsuarioAtual() {
  return localStorage.getItem("nomeUsuario") || "Usuário";
}

function obterAvatarPorPerfil(perfil) {
  const avatars = {
    GERENTE: "./assets/users/joao-almeida.png",
    VENDEDORA: "./assets/users/ana-paula.png",
    ESTOQUISTA: "./assets/users/marcos-lima.png",
  };

  return avatars[perfil] || "./assets/users/default-user.png";
}

function atualizarTopbarUsuario() {
  const nomeEl = document.getElementById("topbarUserName");
  const avatarEl = document.getElementById("topbarUserAvatar");

  const perfil = obterPerfilAtual();
  const nome = obterNomeUsuarioAtual();

  if (nomeEl) {
    nomeEl.textContent = nome;
  }

  if (avatarEl) {
    avatarEl.src = obterAvatarPorPerfil(perfil);
    avatarEl.alt = `Foto de ${nome}`;
  }
}

function limparSessao() {
  localStorage.removeItem("token");
  localStorage.removeItem("perfil");
  localStorage.removeItem("nomeUsuario");
}

function obterMenuPorPerfil(perfil) {
  const menus = {
    ESTOQUISTA: [
      { label: "Dashboard", page: "dashboard" },
      { label: "Consultar Estoque", page: "estoque" },
      { label: "Cadastrar Produto", page: "produtos" },
      { label: "Movimentações", page: "movimentacoes" },
      { label: "Histórico", page: "historico" },
      { label: "Alertas", page: "alertas" },
      { label: "Sair", page: "login" },
    ],
    VENDEDORA: [
      { label: "Dashboard", page: "dashboard-pdv" },
      { label: "PDV - Vendas", page: "pdv/vendas" },
      { label: "Consultar Estoque", page: "estoque" },
      { label: "Sair", page: "login" },
    ],
    GERENTE: [
      { label: "Dashboard", page: "dashboard-gerente" },
      { label: "Consultar Estoque", page: "estoque" },
      { label: "Vendas", page: "pdv/vendas" },
      { label: "Promoções", page: "gerente/promocoes" },
      { label: "Análise de Faturamento", page: "gerente/analise-faturamento" },
      { label: "Sair", page: "login" },
    ],
  };

  return menus[perfil] || [];
}

function renderizarMenu() {
  const menu = document.getElementById("sideMenu");
  if (!menu) return;

  const perfil = obterPerfilAtual();
  const itens = obterMenuPorPerfil(perfil);

  menu.innerHTML = itens
    .map(
      (item) => `
        <button type="button" data-page="${item.page}">
          ${item.label}
        </button>
      `,
    )
    .join("");

  configurarMenu();
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

      if (page === "login") {
        limparSessao();
      }

      loadPage(page);
    };
  });
}

async function loadPage(page) {
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar-global");
  const main = document.getElementById("appMain");

  if (!main) return;

  const perfil = obterPerfilAtual();

  if (page !== "login" && !perfil) {
    page = "login";
  }

  if (page === "login") {
    sidebar.style.display = "none";
    topbar.style.display = "none";
  } else {
    sidebar.style.display = "";
    topbar.style.display = "";
    atualizarTopbarUsuario();
    renderizarMenu();
  }

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
      "dashboard-pdv": window.inicializarTelaDashboardPdv,
      "dashboard-gerente": window.inicializarTelaDashboardGerente,
      "gerente/promocoes": window.inicializarTelaPromocoesGerente,
      "gerente/analise-faturamento": window.inicializarTelaAnaliseFaturamento,
      estoque: window.inicializarTelaEstoque,
      produtos: window.inicializarTelaProdutos,
      movimentacoes: window.inicializarTelaMovimentacoes,
      historico: window.inicializarTelaHistorico,
      alertas: window.inicializarTelaAlertas,
      "pdv/vendas": window.inicializarTelaVendas,
      login: window.inicializarTelaLogin,
    };

    const init = inicializadores[page];

    requestAnimationFrame(() => {
      if (typeof init === "function") {
        init();
      } else {
        console.warn(`[APP] inicializador não encontrado para: ${page}`);
      }
    });
  } catch (error) {
    console.error("[APP] erro ao carregar página:", error);
    main.innerHTML = `
      <p style="color:red; padding:20px;">
        Erro ao abrir ${page}: ${error.message}
      </p>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[APP] iniciada");
  loadPage("login");
});
