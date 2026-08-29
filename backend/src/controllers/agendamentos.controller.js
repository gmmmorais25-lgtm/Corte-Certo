const agendamentosService = require("../services/agendamentos.service");
const barbeirosService = require("../services/barbeiros.service");

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUS_VALIDOS = ["pendente", "confirmado", "cancelado", "concluido"];

async function criar(req, res, next) {
    try {
        const { barbeiro_id, servico_id, data, hora_inicio } = req.body;

        if (!barbeiro_id || !servico_id || !data || !hora_inicio) {
            return res.status(400).json({ erro: "barbeiro_id, servico_id, data e hora_inicio são obrigatórios." });
        }
        if (!REGEX_DATA.test(data)) {
            return res.status(400).json({ erro: "data deve estar no formato AAAA-MM-DD." });
        }
        if (!REGEX_HORA.test(hora_inicio)) {
            return res.status(400).json({ erro: "hora_inicio deve estar no formato HH:MM." });
        }

        const agendamento = await agendamentosService.criar({
            clienteId: req.usuario.id,
            barbeiroId: barbeiro_id,
            servicoId: servico_id,
            data,
            horaInicio: hora_inicio,
        });

        res.status(201).json(agendamento);
    } catch (erro) {
        next(erro);
    }
}

async function listarMeus(req, res, next) {
    try {
        const agendamentos = await agendamentosService.listarPorCliente(req.usuario.id);
        res.json(agendamentos);
    } catch (erro) {
        next(erro);
    }
}

// Agenda do barbeiro: um barbeiro só vê a própria (barbeiro_id na query é
// ignorado/forçado para o dele mesmo); admin pode consultar a de qualquer um.
async function listarDaAgenda(req, res, next) {
    try {
        let barbeiroId = req.query.barbeiro_id;

        if (req.usuario.role === "barbeiro") {
            const barbeiro = await barbeirosService.buscarPorUsuarioId(req.usuario.id);
            if (!barbeiro) {
                return res.status(404).json({ erro: "Cadastro de barbeiro não encontrado para este usuário." });
            }
            barbeiroId = barbeiro.id;
        } else if (!barbeiroId) {
            return res.status(400).json({ erro: "Parâmetro 'barbeiro_id' é obrigatório para admin." });
        }

        const agendamentos = await agendamentosService.listarPorBarbeiro(barbeiroId, { data: req.query.data });
        res.json(agendamentos);
    } catch (erro) {
        next(erro);
    }
}

async function atualizarStatus(req, res, next) {
    try {
        const { status } = req.body;
        if (!STATUS_VALIDOS.includes(status)) {
            return res.status(400).json({ erro: `status deve ser um de: ${STATUS_VALIDOS.join(", ")}.` });
        }

        const agendamento = await agendamentosService.atualizarStatus(req.params.id, status, req.usuario);
        res.json(agendamento);
    } catch (erro) {
        next(erro);
    }
}

module.exports = { criar, listarMeus, listarDaAgenda, atualizarStatus };
