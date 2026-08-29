const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const usuariosService = require("./usuarios.service");

const SALT_ROUNDS = 10;

async function listar({ incluirInativos = false } = {}) {
    const sql = `
        SELECT b.id, b.ativo, b.foto_url, b.criado_em, u.nome, u.email, u.telefone
        FROM barbeiros b
        JOIN usuarios u ON u.id = b.usuario_id
        ${incluirInativos ? "" : "WHERE b.ativo = TRUE"}
        ORDER BY u.nome
    `;
    const [linhas] = await pool.query(sql);
    return linhas;
}

async function buscarPorId(id) {
    const [linhas] = await pool.query(
        `SELECT b.id, b.usuario_id, b.ativo, b.foto_url, b.criado_em, u.nome, u.email, u.telefone
         FROM barbeiros b
         JOIN usuarios u ON u.id = b.usuario_id
         WHERE b.id = ?`,
        [id]
    );
    return linhas[0] || null;
}

// Diferente do cadastro público de cliente: aqui é uma ação de admin que
// precisa criar DUAS linhas (usuarios + barbeiros) de forma atômica. Se a
// segunda inserção falhar, a primeira precisa ser desfeita - senão sobra um
// usuario com role='barbeiro' sem registro correspondente em barbeiros,
// quebrando a garantia que o resto do sistema depende (barbeiros.id como
// única fonte de verdade de "quem é barbeiro").
async function criar({ nome, email, senha, telefone }) {
    const existente = await usuariosService.buscarPorEmail(email);
    if (existente) {
        const erro = new Error("Já existe uma conta cadastrada com este e-mail.");
        erro.status = 409;
        throw erro;
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const conexao = await pool.getConnection();

    try {
        await conexao.beginTransaction();

        const [resultadoUsuario] = await conexao.query(
            "INSERT INTO usuarios (nome, email, senha_hash, telefone, role) VALUES (?, ?, ?, ?, 'barbeiro')",
            [nome, email, senhaHash, telefone || null]
        );

        const [resultadoBarbeiro] = await conexao.query(
            "INSERT INTO barbeiros (usuario_id) VALUES (?)",
            [resultadoUsuario.insertId]
        );

        await conexao.commit();
        return buscarPorId(resultadoBarbeiro.insertId);
    } catch (erro) {
        await conexao.rollback();
        throw erro;
    } finally {
        conexao.release();
    }
}

async function buscarPorUsuarioId(usuarioId) {
    const [linhas] = await pool.query(
        `SELECT b.id, b.usuario_id, b.ativo, b.foto_url, b.criado_em, u.nome, u.email, u.telefone
         FROM barbeiros b
         JOIN usuarios u ON u.id = b.usuario_id
         WHERE b.usuario_id = ?`,
        [usuarioId]
    );
    return linhas[0] || null;
}

// Substitui a foto do barbeiro. Recebe o caminho relativo já salvo pelo
// multer (ex: "/uploads/barbeiros/barbeiro-3-171234.jpg") e apaga o arquivo
// antigo do disco em segundo plano - se não existir mais, ignora o erro.
async function atualizarFoto(id, novaFotoUrl, fotoUrlAntiga) {
    await pool.query("UPDATE barbeiros SET foto_url = ? WHERE id = ?", [novaFotoUrl, id]);

    if (fotoUrlAntiga) {
        const caminhoAntigo = path.join(__dirname, "..", "..", "..", "public", fotoUrlAntiga);
        fs.unlink(caminhoAntigo, () => {});
    }

    return buscarPorId(id);
}

async function desativar(id) {
    const barbeiro = await buscarPorId(id);
    if (!barbeiro) {
        const erro = new Error("Barbeiro não encontrado.");
        erro.status = 404;
        throw erro;
    }
    await pool.query("UPDATE barbeiros SET ativo = FALSE WHERE id = ?", [id]);
    return buscarPorId(id);
}

async function reativar(id) {
    const barbeiro = await buscarPorId(id);
    if (!barbeiro) {
        const erro = new Error("Barbeiro não encontrado.");
        erro.status = 404;
        throw erro;
    }
    await pool.query("UPDATE barbeiros SET ativo = TRUE WHERE id = ?", [id]);
    return buscarPorId(id);
}

// Exclusão de verdade (usuarios + barbeiros, via ON DELETE CASCADE), separada
// de "desativar". Só funciona quando não há nenhum agendamento apontando
// para esse barbeiro - a própria FK de agendamentos.barbeiro_id (sem
// cascade, de propósito) barra a exclusão nesse caso, e aqui só traduzimos
// esse erro do banco numa mensagem clara em vez de deixar virar um 500.
async function excluirPermanentemente(id) {
    const barbeiro = await buscarPorId(id);
    if (!barbeiro) {
        const erro = new Error("Barbeiro não encontrado.");
        erro.status = 404;
        throw erro;
    }
    if (barbeiro.ativo) {
        const erro = new Error("Desative o barbeiro antes de excluí-lo permanentemente.");
        erro.status = 409;
        throw erro;
    }

    try {
        await pool.query("DELETE FROM usuarios WHERE id = ?", [barbeiro.usuario_id]);
    } catch (erro) {
        if (erro.code === "ER_ROW_IS_REFERENCED_2" || erro.code === "ER_ROW_IS_REFERENCED") {
            const erroAmigavel = new Error(
                "Este barbeiro já tem agendamentos no histórico e não pode ser excluído permanentemente - mantenha-o desativado."
            );
            erroAmigavel.status = 409;
            throw erroAmigavel;
        }
        throw erro;
    }

    if (barbeiro.foto_url) {
        const caminho = path.join(__dirname, "..", "..", "..", "public", barbeiro.foto_url);
        fs.unlink(caminho, () => {});
    }
}

module.exports = {
    listar,
    buscarPorId,
    buscarPorUsuarioId,
    criar,
    desativar,
    reativar,
    atualizarFoto,
    excluirPermanentemente,
};
