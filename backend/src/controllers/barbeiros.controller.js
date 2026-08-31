const cloudinary = require("../config/cloudinary")
const barbeirosService = require("../services/barbeiros.service");
const expedientesService = require("../services/expedientes.service");
const servicosService = require("../services/servicos.service");
const disponibilidadeService = require("../services/disponibilidade.service");

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

async function listar(req, res, next) {
    try {
        const podeVerInativos = req.usuario && req.usuario.role === "admin";
        const incluirInativos = podeVerInativos && req.query.incluirInativos === "true";

        const barbeiros = await barbeirosService.listar({ incluirInativos });
        res.json(barbeiros);
    } catch (erro) {
        next(erro);
    }
}

async function buscarPorId(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorId(req.params.id);
        if (!barbeiro) {
            return res.status(404).json({ erro: "Barbeiro não encontrado." });
        }
        res.json(barbeiro);
    } catch (erro) {
        next(erro);
    }
}

// Atalho para o próprio barbeiro logado descobrir seu barbeiros.id (diferente
// do id do usuário/token) sem precisar vasculhar a listagem pública.
async function meuPerfil(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorUsuarioId(req.usuario.id);
        if (!barbeiro) {
            return res.status(404).json({ erro: "Cadastro de barbeiro não encontrado para este usuário." });
        }
        res.json(barbeiro);
    } catch (erro) {
        next(erro);
    }
}

async function criar(req, res, next) {
    try {
        const { nome, email, senha, telefone } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
        }

        const barbeiro = await barbeirosService.criar({ nome, email, senha, telefone });
        res.status(201).json(barbeiro);
    } catch (erro) {
        next(erro);
    }
}

async function atualizarFoto(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorId(req.params.id);

        if (!barbeiro) {
            return res.status(404).json({
                erro: "Barbeiro não encontrado.",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                erro: "Nenhuma imagem enviada (campo 'foto').",
            });
        }

        const publicId = `barbeiro-${req.params.id}`;

        const resultadoUpload = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "corte-certo/barbeiros",
                    public_id: publicId,
                    overwrite: true,
                    invalidate: true,
                    resource_type: "image",
                },
                (erro, resultado) => {
                    if (erro) {
                        return reject(erro);
                    }

                    resolve(resultado);
                }
            );

            stream.end(req.file.buffer);
        });

        const atualizado = await barbeirosService.atualizarFoto(
            req.params.id,
            resultadoUpload.secure_url,
            barbeiro.foto_url
        );

        res.json(atualizado);
    } catch (erro) {
        next(erro);
    }
}

async function desativar(req, res, next) {
    try {
        const barbeiro = await barbeirosService.desativar(req.params.id);
        res.json(barbeiro);
    } catch (erro) {
        next(erro);
    }
}

async function reativar(req, res, next) {
    try {
        const barbeiro = await barbeirosService.reativar(req.params.id);
        res.json(barbeiro);
    } catch (erro) {
        next(erro);
    }
}

async function excluirPermanentemente(req, res, next) {
    try {
        await barbeirosService.excluirPermanentemente(req.params.id);
        res.status(204).send();
    } catch (erro) {
        next(erro);
    }
}

// Só admin gerencia expediente/bloqueios de barbeiro (a rota já filtra por
// autorizar("admin") antes de chegar aqui) - isso só confirma que o :id da
// URL corresponde a um barbeiro de verdade antes de seguir. Reaproveitado
// pelas rotas de bloqueios também.
async function autorizarGestaoAgenda(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorId(req.params.id);
        if (!barbeiro) {
            return res.status(404).json({ erro: "Barbeiro não encontrado." });
        }

        req.barbeiro = barbeiro;
        next();
    } catch (erro) {
        next(erro);
    }
}

async function listarExpediente(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorId(req.params.id);
        if (!barbeiro) {
            return res.status(404).json({ erro: "Barbeiro não encontrado." });
        }
        const expediente = await expedientesService.listarPorBarbeiro(req.params.id);
        res.json(expediente);
    } catch (erro) {
        next(erro);
    }
}

function validarDiaSemana(valor) {
    const dia = Number(valor);
    return Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : null;
}

async function definirDiaExpediente(req, res, next) {
    try {
        const diaSemana = validarDiaSemana(req.params.diaSemana);
        if (diaSemana === null) {
            return res.status(400).json({ erro: "Dia da semana deve ser um número entre 0 (domingo) e 6 (sábado)." });
        }

        const { hora_inicio, hora_fim } = req.body;
        if (!hora_inicio || !hora_fim || !REGEX_HORA.test(hora_inicio) || !REGEX_HORA.test(hora_fim)) {
            return res.status(400).json({ erro: "hora_inicio e hora_fim são obrigatórios, no formato HH:MM." });
        }
        if (hora_inicio >= hora_fim) {
            return res.status(400).json({ erro: "hora_inicio deve ser antes de hora_fim." });
        }

        const turno = await expedientesService.definirDia(req.params.id, diaSemana, { hora_inicio, hora_fim });
        res.json(turno);
    } catch (erro) {
        next(erro);
    }
}

async function removerDiaExpediente(req, res, next) {
    try {
        const diaSemana = validarDiaSemana(req.params.diaSemana);
        if (diaSemana === null) {
            return res.status(400).json({ erro: "Dia da semana deve ser um número entre 0 (domingo) e 6 (sábado)." });
        }

        const removido = await expedientesService.removerDia(req.params.id, diaSemana);
        if (!removido) {
            return res.status(404).json({ erro: "Este barbeiro não tem expediente cadastrado nesse dia." });
        }
        res.status(204).send();
    } catch (erro) {
        next(erro);
    }
}

async function disponibilidade(req, res, next) {
    try {
        const barbeiro = await barbeirosService.buscarPorId(req.params.id);
        if (!barbeiro || !barbeiro.ativo) {
            return res.status(404).json({ erro: "Barbeiro não encontrado ou inativo." });
        }

        const { data, servicoId } = req.query;
        if (!data || !REGEX_DATA.test(data)) {
            return res.status(400).json({ erro: "Parâmetro 'data' é obrigatório, no formato AAAA-MM-DD." });
        }
        if (!servicoId) {
            return res.status(400).json({ erro: "Parâmetro 'servicoId' é obrigatório." });
        }

        const servico = await servicosService.buscarPorId(servicoId);
        if (!servico || !servico.ativo) {
            return res.status(404).json({ erro: "Serviço não encontrado ou inativo." });
        }

        const horarios = await disponibilidadeService.calcularHorariosDisponiveis({
            barbeiroId: req.params.id,
            data,
            duracaoMinutos: servico.duracao_minutos,
        });

        res.json({ data, servico: servico.nome, duracao_minutos: servico.duracao_minutos, horarios });
    } catch (erro) {
        next(erro);
    }
}

module.exports = {
    listar,
    buscarPorId,
    meuPerfil,
    criar,
    atualizarFoto,
    desativar,
    reativar,
    excluirPermanentemente,
    autorizarGestaoAgenda,
    listarExpediente,
    definirDiaExpediente,
    removerDiaExpediente,
    disponibilidade,
};
