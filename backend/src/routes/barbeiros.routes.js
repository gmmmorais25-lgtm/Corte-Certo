const express = require("express");
const barbeirosController = require("../controllers/barbeiros.controller");
const bloqueiosController = require("../controllers/bloqueios.controller");
const upload = require("../middlewares/upload.middleware");
const { autenticar, autenticarOpcional, autorizar } = require("../middlewares/auth.middleware");

const router = express.Router();

// Precisa vir antes de "/:id" - senão o Express trata "me" como valor de :id.
router.get("/me", autenticar, autorizar("barbeiro"), barbeirosController.meuPerfil);

// Listagem e expediente são públicos: o cliente precisa ver quem são os
// barbeiros e quando trabalham antes mesmo de logar, para escolher o horário.
router.get("/", autenticarOpcional, barbeirosController.listar);
router.get("/:id", barbeirosController.buscarPorId);
router.get("/:id/expediente", barbeirosController.listarExpediente);
router.get("/:id/disponibilidade", barbeirosController.disponibilidade);

router.post("/", autenticar, autorizar("admin"), barbeirosController.criar);
router.post(
    "/:id/foto",
    autenticar,
    autorizar("admin"),
    upload.single("foto"),
    barbeirosController.atualizarFoto
);
router.delete("/:id", autenticar, autorizar("admin"), barbeirosController.desativar);
router.delete("/:id/permanente", autenticar, autorizar("admin"), barbeirosController.excluirPermanentemente);
router.patch("/:id/reativar", autenticar, autorizar("admin"), barbeirosController.reativar);

// Gestão de expediente e bloqueios é só do admin agora - o barbeiro só
// acompanha a própria agenda, não configura os próprios horários.
router.put(
    "/:id/expediente/:diaSemana",
    autenticar,
    autorizar("admin"),
    barbeirosController.autorizarGestaoAgenda,
    barbeirosController.definirDiaExpediente
);
router.delete(
    "/:id/expediente/:diaSemana",
    autenticar,
    autorizar("admin"),
    barbeirosController.autorizarGestaoAgenda,
    barbeirosController.removerDiaExpediente
);

// Bloqueios pontuais: informação de gestão da agenda, não catálogo público
// (o "motivo" pode ser algo pessoal do barbeiro) - só admin enxerga/mexe.
router.get(
    "/:id/bloqueios",
    autenticar,
    autorizar("admin"),
    barbeirosController.autorizarGestaoAgenda,
    bloqueiosController.listar
);
router.post(
    "/:id/bloqueios",
    autenticar,
    autorizar("admin"),
    barbeirosController.autorizarGestaoAgenda,
    bloqueiosController.criar
);
router.delete(
    "/:id/bloqueios/:bloqueioId",
    autenticar,
    autorizar("admin"),
    barbeirosController.autorizarGestaoAgenda,
    bloqueiosController.remover
);

module.exports = router;
