const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const SALT_ROUNDS = 10;

async function buscarPorEmail(email) {
    const [linhas] = await pool.query(
        "SELECT id, nome, email, senha_hash, telefone, role FROM usuarios WHERE email = ?",
        [email]
    );
    return linhas[0] || null;
}

async function buscarPorId(id) {
    const [linhas] = await pool.query(
        "SELECT id, nome, email, telefone, role, criado_em FROM usuarios WHERE id = ?",
        [id]
    );
    return linhas[0] || null;
}

// Cadastro público: sempre cria usuário com role "cliente". Criar um
// barbeiro é uma ação administrativa separada (ver barbeiros.service.js),
// não algo que qualquer pessoa deve conseguir fazer se autocadastrando.
async function cadastrarCliente({ nome, email, senha, telefone }) {
    const existente = await buscarPorEmail(email);
    if (existente) {
        const erro = new Error("Já existe uma conta cadastrada com este e-mail.");
        erro.status = 409;
        throw erro;
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const [resultado] = await pool.query(
        "INSERT INTO usuarios (nome, email, senha_hash, telefone, role) VALUES (?, ?, ?, ?, 'cliente')",
        [nome, email, senhaHash, telefone || null]
    );

    return buscarPorId(resultado.insertId);
}

async function validarSenha(senhaTextoPuro, senhaHash) {
    return bcrypt.compare(senhaTextoPuro, senhaHash);
}

// Diferente de cadastrarCliente: exposto só num endpoint autenticado como
// admin (ver admins.routes.js) - ninguém vira admin se autocadastrando.
// Não precisa de linha de extensão (como barbeiros tem) porque admin não
// tem expediente/agenda própria.
async function criarAdmin({ nome, email, senha }) {
    const existente = await buscarPorEmail(email);
    if (existente) {
        const erro = new Error("Já existe uma conta cadastrada com este e-mail.");
        erro.status = 409;
        throw erro;
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const [resultado] = await pool.query(
        "INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, 'admin')",
        [nome, email, senhaHash]
    );

    return buscarPorId(resultado.insertId);
}

module.exports = {
    buscarPorEmail,
    buscarPorId,
    cadastrarCliente,
    criarAdmin,
    validarSenha,
};
