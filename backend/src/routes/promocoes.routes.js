const express = require("express");
const router = express.Router();

const promocoesController = require("../controllers/promocoes.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.post("/", promocoesController.criarPromocao);
router.get("/", promocoesController.listarPromocoes);
router.get("/:id", promocoesController.detalharPromocao);
router.patch("/:id/cancelar", promocoesController.cancelarPromocao);

module.exports = router;
