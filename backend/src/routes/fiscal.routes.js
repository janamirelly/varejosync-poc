const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");
const { audit } = require("../middlewares/audit.middleware");

const {
  emitirDocumento,
  cancelarDocumento,
} = require("../controllers/fiscal.controller");

// Fiscal: somente Gerente
router.post(
  "/emitir/:id_venda",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("FISCAL_EMITIR"),
  emitirDocumento,
);

router.put(
  "/cancelar/:id_venda",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("FISCAL_CANCELAR"),
  cancelarDocumento,
);

module.exports = router;
