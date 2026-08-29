const pool = require("../config/db");

async function listar({ incluirInativos = false } = {}) {
    const sql = incluirInativos
        ? "SELECT id, nome, duracao_minutos, preco, ativo, criado_em FROM servicos ORDER BY nome"
        : "SELECT id, nome, duracao_minutos, preco, ativo, criado_em FROM servicos WHERE ativo = TRUE ORDER BY nome";

    const [linhas] = await pool.query(sql);
    return linhas;
}

async function buscarPorId(id) {
    const [linhas] = await pool.query(
        "SELECT id, nome, duracao_minutos, preco, ativo, criado_em FROM servicos WHERE id = ?",
        [id]
    );
    return linhas[0] || null;
}

async function criar({ nome, duracao_minutos, preco }) {
    const [resultado] = await pool.query(
        "INSERT INTO servicos (nome, duracao_minutos, preco) VALUES (?, ?, ?)",
        [nome, duracao_minutos, preco]
    );
    return buscarPorId(resultado.insertId);
}

// Atualiza só os campos informados (permite editar apenas o preço, por exemplo,
// sem reenviar nome e duração).
async function atualizar(id, { nome, duracao_minutos, preco }) {
    const servico = await buscarPorId(id);
    if (!servico) {
        const erro = new Error("Serviço não encontrado.");
        erro.status = 404;
        throw erro;
    }

    await pool.query(
        "UPDATE servicos SET nome = ?, duracao_minutos = ?, preco = ? WHERE id = ?",
        [
            nome ?? servico.nome,
            duracao_minutos ?? servico.duracao_minutos,
            preco ?? servico.preco,
            id,
        ]
    );

    return buscarPorId(id);
}

// "Excluir" um serviço é um soft delete (ativo = FALSE), nunca um DELETE físico:
// agendamentos antigos referenciam servico_id via FK, e o próprio catálogo
// precisa continuar mostrando o que aquele serviço era no histórico. Desativar
// só tira o serviço das opções para novos agendamentos.
async function desativar(id) {
    const servico = await buscarPorId(id);
    if (!servico) {
        const erro = new Error("Serviço não encontrado.");
        erro.status = 404;
        throw erro;
    }

    await pool.query("UPDATE servicos SET ativo = FALSE WHERE id = ?", [id]);
    return buscarPorId(id);
}

async function reativar(id) {
    const servico = await buscarPorId(id);
    if (!servico) {
        const erro = new Error("Serviço não encontrado.");
        erro.status = 404;
        throw erro;
    }

    await pool.query("UPDATE servicos SET ativo = TRUE WHERE id = ?", [id]);
    return buscarPorId(id);
}

module.exports = { listar, buscarPorId, criar, atualizar, desativar, reativar };
