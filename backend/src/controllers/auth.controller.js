const usuariosService = require("../services/usuarios.service");
const authService = require("../services/auth.service");

async function registrar(req, res, next) {
    try {
        const { nome, email, senha, telefone } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
        }

        const usuario = await usuariosService.cadastrarCliente({ nome, email, senha, telefone });
        res.status(201).json({ usuario });
    } catch (erro) {
        next(erro);
    }
}

async function login(req, res, next) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
        }

        const resultado = await authService.login(email, senha);
        res.json(resultado);
    } catch (erro) {
        next(erro);
    }
}

module.exports = { registrar, login };
