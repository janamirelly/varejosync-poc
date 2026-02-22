const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/auth.middleware");
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");


const {
  registrarMovimentacao,
  listarMovimentacoes,
} = require("../controllers/movimentacao.controller");

// cria movimentação manual (ENTRADA/SAIDA/AJUSTE)
router.post(
  "/",
  authMiddleware,
  authorizeRoles("Estoquista", "Gerente de Operações"),
  audit("MOV_ESTOQUE_MANUAL"),
  registrarMovimentacao
);


// lista histórico com nome/email/perfil (view)
router.get(
  "/",
  authMiddleware,
  authorizeRoles("Vendedora", "Estoquista", "Gerente de Operações"),
  audit("CONSULTA_MOVIMENTACOES"),
  listarMovimentacoes
);


module.exports = router;
