const pool = require("../config/db");

async function listarPorBarbeiro(barbeiroId) {
    const [linhas] = await pool.query(
        "SELECT id, dia_semana, hora_inicio, hora_fim FROM expedientes WHERE barbeiro_id = ? ORDER BY dia_semana",
        [barbeiroId]
    );
    return linhas;
}

// Upsert: cada barbeiro tem no máximo um turno por dia da semana (é o que a
// unique key (barbeiro_id, dia_semana) do schema garante). Definir o mesmo
// dia de novo substitui o horário anterior em vez de duplicar linha.
async function definirDia(barbeiroId, diaSemana, { hora_inicio, hora_fim }) {
    await pool.query(
        `INSERT INTO expedientes (barbeiro_id, dia_semana, hora_inicio, hora_fim)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE hora_inicio = VALUES(hora_inicio), hora_fim = VALUES(hora_fim)`,
        [barbeiroId, diaSemana, hora_inicio, hora_fim]
    );

    const [linhas] = await pool.query(
        "SELECT id, dia_semana, hora_inicio, hora_fim FROM expedientes WHERE barbeiro_id = ? AND dia_semana = ?",
        [barbeiroId, diaSemana]
    );
    return linhas[0];
}

// Remover um dia = barbeiro não trabalha mais nesse dia da semana (não é o
// mesmo que "folga pontual" numa data específica; isso ficaria numa tabela
// de exceções, fora do escopo desta etapa).
async function removerDia(barbeiroId, diaSemana) {
    const [resultado] = await pool.query(
        "DELETE FROM expedientes WHERE barbeiro_id = ? AND dia_semana = ?",
        [barbeiroId, diaSemana]
    );
    return resultado.affectedRows > 0;
}

module.exports = { listarPorBarbeiro, definirDia, removerDia };
