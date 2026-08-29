const express = require("express");
const agendamentosController = require("../controllers/agendamentos.controller");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", autenticar, autorizar("cliente"), agendamentosController.criar);
router.get("/meus", autenticar, autorizar("cliente"), agendamentosController.listarMeus);
router.get("/", autenticar, autorizar("barbeiro", "admin"), agendamentosController.listarDaAgenda);
router.patch("/:id/status", autenticar, autorizar("cliente", "barbeiro", "admin"), agendamentosController.atualizarStatus);

module.exports = router;
