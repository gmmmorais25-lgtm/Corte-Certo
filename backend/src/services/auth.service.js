const jwt = require("jsonwebtoken");
const usuariosService = require("./usuarios.service");

async function login(email, senha) {
    const usuario = await usuariosService.buscarPorEmail(email);
    if (!usuario) {
        const erro = new Error("E-mail ou senha inválidos.");
        erro.status = 401;
        throw erro;
    }

    const senhaValida = await usuariosService.validarSenha(senha, usuario.senha_hash);
    if (!senhaValida) {
        const erro = new Error("E-mail ou senha inválidos.");
        erro.status = 401;
        throw erro;
    }

    // O payload carrega id + role para que o middleware de autorização decida
    // acesso sem consultar o banco a cada requisição. Em troca, revogar um
    // token antes da expiração natural exigiria uma blocklist (fora do
    // escopo desta etapa) - por isso o token tem validade curta (JWT_EXPIRES_IN).
    const token = jwt.sign(
        { id: usuario.id, role: usuario.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return {
        token,
        usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            role: usuario.role,
        },
    };
}

module.exports = { login };
