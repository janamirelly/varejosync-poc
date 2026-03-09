(function () {
  function setStatus(texto, isError = false) {
    const status = document.getElementById("loginStatus");
    if (!status) return;

    status.textContent = texto;
    status.style.color = isError ? "#dc2626" : "#6b7280";
  }

  function salvarTokenFake(token) {
    localStorage.setItem("token", token);
  }

  window.inicializarTelaLogin = function () {
    const form = document.getElementById("loginForm");
    const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");

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

        setStatus("Login realizado com sucesso.");

        if (usuario === "vendas@varejosync.com" && senha === "123456") {
          salvarTokenFake("Mzp2ZW5kYXNAdmFyZWpvc3luYy5jb20=");

          localStorage.setItem("perfil", "VENDEDORA");
          localStorage.setItem("nomeUsuario", "Ana Paula");

          if (typeof loadPage === "function") {
            loadPage("dashboard-pdv");
          }
          return;
        }

        if (usuario === "estoque@varejosync.com" && senha === "123456") {
          salvarTokenFake("Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t");

          localStorage.setItem("perfil", "ESTOQUISTA");
          localStorage.setItem("nomeUsuario", "Marcos Lima");

          if (typeof loadPage === "function") {
            loadPage("dashboard");
          }
          return;
        }

        if (usuario === "gerente@varejosync.com" && senha === "123456") {
          salvarTokenFake("MTpnZXJlbnRlQHZhcmVqb3N5bmMuY29t");

          localStorage.setItem("perfil", "GERENTE");
          localStorage.setItem("nomeUsuario", "João Almeida");

          if (typeof loadPage === "function") {
            loadPage("dashboard-gerente");
          }
          return;
        }

        setStatus("Usuário ou senha inválidos.", true);
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
