const pool = require("../config/db");
const barbeirosService = require("./barbeiros.service");
const servicosService = require("./servicos.service");
const disponibilidadeService = require("./disponibilidade.service");

async function buscarPorId(id, executor = pool) {
    const [linhas] = await executor.query(
        `SELECT id, cliente_id, barbeiro_id, servico_id, data, hora_inicio, hora_fim,
                duracao_minutos, preco_cobrado, status, criado_em
         FROM agendamentos WHERE id = ?`,
        [id]
    );
    return linhas[0] || null;
}

async function listarPorCliente(clienteId) {
    const [linhas] = await pool.query(
        `SELECT a.id, a.data, a.hora_inicio, a.hora_fim, a.preco_cobrado, a.status,
                s.nome AS servico_nome, u.nome AS barbeiro_nome
         FROM agendamentos a
         JOIN servicos s ON s.id = a.servico_id
         JOIN barbeiros b ON b.id = a.barbeiro_id
         JOIN usuarios u ON u.id = b.usuario_id
         WHERE a.cliente_id = ?
         ORDER BY a.data DESC, a.hora_inicio DESC`,
        [clienteId]
    );
    return linhas;
}

async function listarPorBarbeiro(barbeiroId, { data } = {}) {
    const condicoes = ["a.barbeiro_id = ?"];
    const parametros = [barbeiroId];

    if (data) {
        condicoes.push("a.data = ?");
        parametros.push(data);
    }

    const [linhas] = await pool.query(
        `SELECT a.id, a.data, a.hora_inicio, a.hora_fim, a.preco_cobrado, a.status,
                s.nome AS servico_nome, u.nome AS cliente_nome, u.telefone AS cliente_telefone
         FROM agendamentos a
         JOIN servicos s ON s.id = a.servico_id
         JOIN usuarios u ON u.id = a.cliente_id
         WHERE ${condicoes.join(" AND ")}
         ORDER BY a.data, a.hora_inicio`,
        parametros
    );
    return linhas;
}

// O coração da regra de negócio. Roda dentro de uma transação com um lock
// que serializa criações de agendamento POR BARBEIRO: duas requisições
// concorrentes pro mesmo barbeiro nunca fazem a verificação de disponibilidade
// "ao mesmo tempo" - uma espera a outra soltar o lock antes de sequer ler o
// que já está ocupado. Sem isso, duas pessoas clicando "confirmar" no mesmo
// segundo, no mesmo horário, poderiam passar as duas pela checagem antes de
// qualquer uma ter inserido sua linha - a clássica race condition de agenda.
async function criar({ clienteId, barbeiroId, servicoId, data, horaInicio }) {
    const barbeiro = await barbeirosService.buscarPorId(barbeiroId);
    if (!barbeiro || !barbeiro.ativo) {
        const erro = new Error("Barbeiro não encontrado ou inativo.");
        erro.status = 404;
        throw erro;
    }

    const servico = await servicosService.buscarPorId(servicoId);
    if (!servico || !servico.ativo) {
        const erro = new Error("Serviço não encontrado ou inativo.");
        erro.status = 404;
        throw erro;
    }

    const inicioMin = disponibilidadeService.paraMinutos(horaInicio);
    const fimMin = inicioMin + servico.duracao_minutos;
    const horaFim = disponibilidadeService.paraHoraStr(fimMin);

    if (data < disponibilidadeService.dataDeHojeStr()) {
        const erro = new Error("Não é possível agendar em uma data que já passou.");
        erro.status = 400;
        throw erro;
    }
    if (data === disponibilidadeService.dataDeHojeStr() && inicioMin < disponibilidadeService.minutosAgora()) {
        const erro = new Error("Não é possível agendar em um horário que já passou hoje.");
        erro.status = 400;
        throw erro;
    }

    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();

        // Lock no próprio barbeiro: mutex por barbeiro, não pela agenda inteira.
        // Barbeiros diferentes continuam agendando em paralelo sem se esperar.
        await conexao.query("SELECT id FROM barbeiros WHERE id = ? FOR UPDATE", [barbeiroId]);

        const disponivel = await disponibilidadeService.horarioEstaDisponivel(
            { barbeiroId, data, horaInicio, horaFim },
            conexao
        );

        if (!disponivel) {
            await conexao.rollback();
            const erro = new Error("Este horário não está mais disponível.");
            erro.status = 409;
            throw erro;
        }

        const [resultado] = await conexao.query(
            `INSERT INTO agendamentos
                (cliente_id, barbeiro_id, servico_id, data, hora_inicio, hora_fim, duracao_minutos, preco_cobrado, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
            [clienteId, barbeiroId, servicoId, data, horaInicio, horaFim, servico.duracao_minutos, servico.preco]
        );

        await conexao.commit();
        return buscarPorId(resultado.insertId);
    } catch (erro) {
        // ROLLBACK sem transação ativa (ex: já desfeita no caso do 409 acima)
        // é inofensivo no MySQL - por isso não precisa checar estado antes.
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
}

async function atualizarStatus(id, novoStatus, quemPede) {
    const agendamento = await buscarPorId(id);
    if (!agendamento) {
        const erro = new Error("Agendamento não encontrado.");
        erro.status = 404;
        throw erro;
    }

    const ehDonoDoAgendamento = quemPede.role === "cliente" && quemPede.id === agendamento.cliente_id;
    const podeGerenciarAgenda = quemPede.role === "admin" || quemPede.role === "barbeiro";

    // Cliente só pode cancelar o próprio agendamento; confirmar/concluir é
    // decisão de quem presta o serviço (barbeiro/admin).
    if (novoStatus === "cancelado") {
        if (!ehDonoDoAgendamento && !podeGerenciarAgenda) {
            const erro = new Error("Você não tem permissão para cancelar este agendamento.");
            erro.status = 403;
            throw erro;
        }
    } else if (!podeGerenciarAgenda) {
        const erro = new Error("Você não tem permissão para alterar o status deste agendamento.");
        erro.status = 403;
        throw erro;
    }

    await pool.query("UPDATE agendamentos SET status = ? WHERE id = ?", [novoStatus, id]);
    return buscarPorId(id);
}

module.exports = { buscarPorId, listarPorCliente, listarPorBarbeiro, criar, atualizarStatus };
