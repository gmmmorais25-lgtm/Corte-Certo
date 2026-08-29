const formCadastro = document.getElementById("form-cadastro");
const nome = document.getElementById("nome");
const email = document.getElementById("email");
const telefone = document.getElementById("telefone");
const senha = document.getElementById("senha");
const confirmarSenha = document.getElementById("confirmar-senha");
const erroSenha = document.getElementById("erro-senha");

// Máscara simples: só dígitos, no máximo 11 (DDD + 9 dígitos).
telefone.addEventListener("input", function () {
    let valor = telefone.value.replace(/\D/g, "").slice(0, 11);
    if (valor.length > 6) {
        valor = `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`;
    } else if (valor.length > 2) {
        valor = `(${valor.slice(0, 2)}) ${valor.slice(2)}`;
    }
    telefone.value = valor;
});

formCadastro.addEventListener("submit", async function (event) {
    event.preventDefault();
    erroSenha.textContent = "";

    // O back-end também valida (>= 6 caracteres) - checar aqui só evita uma
    // ida e volta ao servidor por um erro óbvio.
    if (senha.value.length < 6) {
        erroSenha.textContent = "A senha deve possuir pelo menos 6 caracteres";
        return;
    }
    if (senha.value !== confirmarSenha.value) {
        erroSenha.textContent = "As senhas não coincidem";
        return;
    }

    const botao = document.getElementById("cadastrar");
    botao.disabled = true;
    botao.textContent = "Cadastrando...";

    try {
        await api("POST", "/auth/registrar", {
            nome: nome.value,
            email: email.value,
            senha: senha.value,
            telefone: telefone.value.replace(/\D/g, ""),
        });

        // Cadastro público sempre cria role "cliente" - login imediato pra
        // não obrigar a pessoa a digitar tudo de novo na tela seguinte.
        const resultado = await api("POST", "/auth/login", { email: email.value, senha: senha.value });
        salvarSessao(resultado.token, resultado.usuario);
        window.location.href = "agendar.html";
    } catch (erro) {
        erroSenha.textContent = erro.message;
        botao.disabled = false;
        botao.textContent = "Cadastrar";
    }
});
