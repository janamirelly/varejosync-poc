(function () {
  function getStatusElement() {
    return document.getElementById("loginStatus");
  }

  function limparClassesCampos() {
    const fields = document.querySelectorAll(".login-form .field");
    fields.forEach((field) => {
      field.classList.remove("field-error", "field-success");
    });
  }

  function marcarCampoComoErro(input) {
    const field = input?.closest(".field");
    if (field) field.classList.add("field-error");
  }

  function marcarCampoComoSucesso(input) {
    const field = input?.closest(".field");
    if (field) field.classList.add("field-success");
  }

  function setStatus(texto, tipo = "info") {
    const status = getStatusElement();
    if (!status) return;

    status.textContent = texto;
    status.classList.remove("is-error", "is-success", "is-info");

    if (tipo === "error") {
      status.classList.add("is-error");
      return;
    }

    if (tipo === "success") {
      status.classList.add("is-success");
      return;
    }

    status.classList.add("is-info");
  }

  function limparStatus() {
    const status = getStatusElement();
    if (!status) return;

    status.textContent = "";
    status.classList.remove("is-error", "is-success", "is-info");
  }

  function salvarTokenFake(token) {
    localStorage.setItem("token", token);
  }

  function setLoadingBotao(botao, carregando) {
    if (!botao) return;

    if (carregando) {
      botao.classList.add("is-loading");
      botao.disabled = true;
      botao.dataset.originalText = botao.textContent;
      botao.textContent = "Entrando...";
      return;
    }

    botao.classList.remove("is-loading");
    botao.disabled = false;
    botao.textContent = botao.dataset.originalText || "Entrar";
  }

  window.inicializarTelaLogin = function () {
    const form = document.getElementById("loginForm");
    const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");
    const inputUsuario = document.getElementById("loginUsuario");
    const inputSenha = document.getElementById("loginSenha");
    const btnToggleSenha = document.getElementById("toggleSenha");
    const btnSubmit = form?.querySelector('button[type="submit"]');

    localStorage.removeItem("token");

    [inputUsuario, inputSenha].forEach((input) => {
      input?.addEventListener("input", () => {
        const field = input.closest(".field");
        field?.classList.remove("field-error", "field-success");
        limparStatus();
      });
    });

    if (btnToggleSenha && inputSenha) {
      btnToggleSenha.onclick = function () {
        const mostrando = inputSenha.type === "text";

        inputSenha.type = mostrando ? "password" : "text";
        btnToggleSenha.classList.toggle("is-visible", !mostrando);
        btnToggleSenha.setAttribute(
          "aria-label",
          mostrando ? "Mostrar senha" : "Ocultar senha",
        );
        btnToggleSenha.setAttribute(
          "title",
          mostrando ? "Mostrar senha" : "Ocultar senha",
        );
      };
    }

    if (form) {
      form.onsubmit = function (event) {
        event.preventDefault();

        limparStatus();
        limparClassesCampos();
        setLoadingBotao(btnSubmit, true);

        const usuario = inputUsuario?.value.trim() || "";
        const senha = inputSenha?.value.trim() || "";

        if (!usuario) {
          setLoadingBotao(btnSubmit, false);
          setStatus("Informe o usuário.", "error");
          marcarCampoComoErro(inputUsuario);
          inputUsuario?.focus();
          return;
        }

        if (!senha) {
          setLoadingBotao(btnSubmit, false);
          setStatus("Informe a senha.", "error");
          marcarCampoComoErro(inputSenha);
          inputSenha?.focus();
          return;
        }

        if (usuario === "vendas@varejosync.com" && senha === "123456") {
          salvarTokenFake("Mzp2ZW5kYXNAdmFyZWpvc3luYy5jb20=");
          localStorage.setItem("perfil", "VENDEDORA");
          localStorage.setItem("nomeUsuario", "Ana Paula");

          marcarCampoComoSucesso(inputUsuario);
          marcarCampoComoSucesso(inputSenha);
          setStatus("Login realizado com sucesso.", "success");
          setLoadingBotao(btnSubmit, false);

          if (typeof loadPage === "function") {
            loadPage("dashboard-pdv");
          }
          return;
        }

        if (usuario === "estoque@varejosync.com" && senha === "123456") {
          salvarTokenFake("Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t");
          localStorage.setItem("perfil", "ESTOQUISTA");
          localStorage.setItem("nomeUsuario", "Marcos Lima");

          marcarCampoComoSucesso(inputUsuario);
          marcarCampoComoSucesso(inputSenha);
          setStatus("Login realizado com sucesso.", "success");
          setLoadingBotao(btnSubmit, false);

          if (typeof loadPage === "function") {
            loadPage("dashboard");
          }
          return;
        }

        if (usuario === "gerente@varejosync.com" && senha === "123456") {
          salvarTokenFake("MTpnZXJlbnRlQHZhcmVqb3N5bmMuY29t");
          localStorage.setItem("perfil", "GERENTE");
          localStorage.setItem("nomeUsuario", "João Almeida");

          marcarCampoComoSucesso(inputUsuario);
          marcarCampoComoSucesso(inputSenha);
          setStatus("Login realizado com sucesso.", "success");
          setLoadingBotao(btnSubmit, false);

          if (typeof loadPage === "function") {
            loadPage("dashboard-gerente");
          }
          return;
        }

        setLoadingBotao(btnSubmit, false);
        marcarCampoComoErro(inputUsuario);
        marcarCampoComoErro(inputSenha);
        setStatus("Usuário ou senha inválidos.", "error");
        inputSenha?.focus();
      };
    }

    if (btnEsqueciSenha) {
      btnEsqueciSenha.onclick = function () {
        limparClassesCampos();
        setStatus(
          "Procure o administrador do sistema para redefinir sua senha.",
          "info",
        );
      };
    }
  };
})();
