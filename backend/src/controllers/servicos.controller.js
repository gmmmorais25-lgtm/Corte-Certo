const servicosService = require("../services/servicos.service");

function validarCampos({ nome, duracao_minutos, preco }, exigirTodos) {
    if (exigirTodos && (!nome || duracao_minutos === undefined || preco === undefined)) {
        return "Nome, duração (em minutos) e preço são obrigatórios.";
    }
    if (duracao_minutos !== undefined && (!Number.isInteger(duracao_minutos) || duracao_minutos <= 0)) {
        return "Duração deve ser um número inteiro de minutos maior que zero.";
    }
    if (preco !== undefined && (typeof preco !== "number" || preco <= 0)) {
        return "Preço deve ser um número maior que zero.";
    }
    return null;
}

async function listar(req, res, next) {
    try {
        // Só admin (dono da gestão do catálogo) pode pedir os inativos;
        // o público em geral (e o barbeiro, que não gerencia isso) só vê os ativos.
        const podeVerInativos = req.usuario && req.usuario.role === "admin";
        const incluirInativos = podeVerInativos && req.query.incluirInativos === "true";

        const servicos = await servicosService.listar({ incluirInativos });
        res.json(servicos);
    } catch (erro) {
        next(erro);
    }
}

async function buscarPorId(req, res, next) {
    try {
        const servico = await servicosService.buscarPorId(req.params.id);
        if (!servico) {
            return res.status(404).json({ erro: "Serviço não encontrado." });
        }
        res.json(servico);
    } catch (erro) {
        next(erro);
    }
}

async function criar(req, res, next) {
    try {
        const erroValidacao = validarCampos(req.body, true);
        if (erroValidacao) {
            return res.status(400).json({ erro: erroValidacao });
        }

        const servico = await servicosService.criar(req.body);
        res.status(201).json(servico);
    } catch (erro) {
        next(erro);
    }
}

async function atualizar(req, res, next) {
    try {
        const erroValidacao = validarCampos(req.body, false);
        if (erroValidacao) {
            return res.status(400).json({ erro: erroValidacao });
        }

        const servico = await servicosService.atualizar(req.params.id, req.body);
        res.json(servico);
    } catch (erro) {
        next(erro);
    }
}

async function desativar(req, res, next) {
    try {
        const servico = await servicosService.desativar(req.params.id);
        res.json(servico);
    } catch (erro) {
        next(erro);
    }
}

async function reativar(req, res, next) {
    try {
        const servico = await servicosService.reativar(req.params.id);
        res.json(servico);
    } catch (erro) {
        next(erro);
    }
}

module.exports = { listar, buscarPorId, criar, atualizar, desativar, reativar };
