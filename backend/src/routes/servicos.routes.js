const express = require("express");
const servicosController = require("../controllers/servicos.controller");
const { autenticar, autenticarOpcional, autorizar } = require("../middlewares/auth.middleware");

const router = express.Router();

// Catálogo é público (cliente precisa ver antes/sem estar logado), mas
// autenticarOpcional deixa o admin pedir os inativos também.
router.get("/", autenticarOpcional, servicosController.listar);
router.get("/:id", servicosController.buscarPorId);

// Gestão do catálogo (preço, duração) é decisão só do admin - o barbeiro
// não define os próprios preços/serviços.
router.post("/", autenticar, autorizar("admin"), servicosController.criar);
router.put("/:id", autenticar, autorizar("admin"), servicosController.atualizar);
router.delete("/:id", autenticar, autorizar("admin"), servicosController.desativar);
router.patch("/:id/reativar", autenticar, autorizar("admin"), servicosController.reativar);

module.exports = router;
