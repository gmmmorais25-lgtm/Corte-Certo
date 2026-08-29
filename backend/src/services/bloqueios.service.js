const pool = require("../config/db");

async function listarPorBarbeiro(barbeiroId, { de, ate } = {}) {
    const condicoes = ["barbeiro_id = ?"];
    const parametros = [barbeiroId];

    if (de) {
        condicoes.push("data >= ?");
        parametros.push(de);
    }
    if (ate) {
        condicoes.push("data <= ?");
        parametros.push(ate);
    }

    const [linhas] = await pool.query(
        `SELECT id, barbeiro_id, data, hora_inicio, hora_fim, motivo, criado_em
         FROM bloqueios_agenda
         WHERE ${condicoes.join(" AND ")}
         ORDER BY data, hora_inicio`,
        parametros
    );
    return linhas;
}

async function criar(barbeiroId, { data, hora_inicio, hora_fim, motivo }) {
    const [resultado] = await pool.query(
        `INSERT INTO bloqueios_agenda (barbeiro_id, data, hora_inicio, hora_fim, motivo)
         VALUES (?, ?, ?, ?, ?)`,
        [barbeiroId, data, hora_inicio || null, hora_fim || null, motivo || null]
    );

    const [linhas] = await pool.query(
        "SELECT id, barbeiro_id, data, hora_inicio, hora_fim, motivo, criado_em FROM bloqueios_agenda WHERE id = ?",
        [resultado.insertId]
    );
    return linhas[0];
}

async function remover(barbeiroId, bloqueioId) {
    const [resultado] = await pool.query(
        "DELETE FROM bloqueios_agenda WHERE id = ? AND barbeiro_id = ?",
        [bloqueioId, barbeiroId]
    );
    return resultado.affectedRows > 0;
}

module.exports = { listarPorBarbeiro, criar, remover };
