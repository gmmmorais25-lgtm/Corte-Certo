const formLogin = document.getElementById("form-login");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const erroLogin = document.getElementById("erro-login");

// Se já tem sessão salva, pula direto pra tela certa em vez de mostrar login de novo.
(function redirecionarSeJaLogado() {
    const usuario = obterUsuario();
    if (usuario && obterToken()) {
        window.location.href = usuario.role === "cliente" ? "agendar.html" : "painel.html";
    }
})();

formLogin.addEventListener("submit", async function (event) {
    event.preventDefault();
    erroLogin.textContent = "";

    const botao = document.getElementById("entrar");
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        const resultado = await api("POST", "/auth/login", {
            email: email.value,
            senha: senha.value,
        });

        salvarSessao(resultado.token, resultado.usuario);
        window.location.href = resultado.usuario.role === "cliente" ? "agendar.html" : "painel.html";
    } catch (erro) {
        erroLogin.textContent = erro.message;
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
});
