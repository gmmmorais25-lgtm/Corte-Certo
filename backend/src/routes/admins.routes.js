const express = require("express");
const adminsController = require("../controllers/admins.controller");
const { autenticar, autorizar } = require("../middlewares/auth.middleware");

const router = express.Router();

// Só um admin já autenticado pode criar outro - não existe autocadastro de admin.
router.post("/", autenticar, autorizar("admin"), adminsController.criar);

module.exports = router;
