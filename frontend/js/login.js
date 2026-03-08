(function () {
  function setStatus(texto, isError = false) {
    const status = document.getElementById("loginStatus");
    if (!status) return;

    status.textContent = texto;
    status.style.color = isError ? "#dc2626" : "#6b7280";
  }

  function salvarTokenFake() {
    // mantém compatibilidade com o que vocês já estão usando no front
    localStorage.setItem("token", "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t");
  }

  window.inicializarTelaLogin = function () {
    const form = document.getElementById("loginForm");
    const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");

    // ao entrar na tela login pelo botão sair, limpa sessão
    localStorage.removeItem("token");

    if (form) {
      form.onsubmit = function (event) {
        event.preventDefault();

        const usuario =
          document.getElementById("loginUsuario")?.value.trim() || "";
        const senha = document.getElementById("loginSenha")?.value.trim() || "";

        if (!usuario || !senha) {
          setStatus("Informe usuário e senha.", true);
          return;
        }

        // fluxo simples para a PI
        salvarTokenFake();
        setStatus("Login realizado com sucesso.");

        if (typeof loadPage === "function") {
          loadPage("dashboard");
        }
      };
    }

    if (btnEsqueciSenha) {
      btnEsqueciSenha.onclick = function () {
        setStatus(
          "Procure o administrador do sistema para redefinir sua senha.",
        );
      };
    }
  };
})();
