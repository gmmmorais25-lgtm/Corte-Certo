const bloqueiosService = require("../services/bloqueios.service");

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

async function listar(req, res, next) {
    try {
        const { de, ate } = req.query;
        const bloqueios = await bloqueiosService.listarPorBarbeiro(req.params.id, { de, ate });
        res.json(bloqueios);
    } catch (erro) {
        next(erro);
    }
}

async function criar(req, res, next) {
    try {
        const { data, hora_inicio, hora_fim, motivo } = req.body;

        if (!data || !REGEX_DATA.test(data)) {
            return res.status(400).json({ erro: "Campo 'data' é obrigatório, no formato AAAA-MM-DD." });
        }

        // Ou os dois horários vêm preenchidos (bloqueio parcial) ou nenhum
        // (bloqueio do dia inteiro) - meio a meio não faz sentido.
        const horaInicioPreenchida = hora_inicio !== undefined && hora_inicio !== null && hora_inicio !== "";
        const horaFimPreenchida = hora_fim !== undefined && hora_fim !== null && hora_fim !== "";

        if (horaInicioPreenchida !== horaFimPreenchida) {
            return res.status(400).json({ erro: "Informe hora_inicio e hora_fim juntos, ou nenhum dos dois (bloqueio do dia inteiro)." });
        }
        if (horaInicioPreenchida) {
            if (!REGEX_HORA.test(hora_inicio) || !REGEX_HORA.test(hora_fim)) {
                return res.status(400).json({ erro: "hora_inicio e hora_fim devem estar no formato HH:MM." });
            }
            if (hora_inicio >= hora_fim) {
                return res.status(400).json({ erro: "hora_inicio deve ser antes de hora_fim." });
            }
        }

        const bloqueio = await bloqueiosService.criar(req.params.id, { data, hora_inicio, hora_fim, motivo });
        res.status(201).json(bloqueio);
    } catch (erro) {
        next(erro);
    }
}

async function remover(req, res, next) {
    try {
        const removido = await bloqueiosService.remover(req.params.id, req.params.bloqueioId);
        if (!removido) {
            return res.status(404).json({ erro: "Bloqueio não encontrado para este barbeiro." });
        }
        res.status(204).send();
    } catch (erro) {
        next(erro);
    }
}

module.exports = { listar, criar, remover };
