const usuariosService = require("../services/usuarios.service");

async function criar(req, res, next) {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
        }

        const admin = await usuariosService.criarAdmin({ nome, email, senha });
        res.status(201).json(admin);
    } catch (erro) {
        next(erro);
    }
}

module.exports = { criar };
