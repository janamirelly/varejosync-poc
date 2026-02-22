// backend/src/routes/relatorios.routes.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/auth.middleware");
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");

const {
  vendasPorPeriodo,
  topProdutos,
  movPorUsuario,
  rastreabilidadeVenda,
  fechamentoCaixa,
  fiscalPorPeriodo,
} = require("../controllers/relatorios.controller");

// Relatórios
router.get(
  "/vendas",
  authMiddleware,
  authorizeRoles("Estoquista", "Gerente de Operações"),
  audit("REL_VENDAS_PERIODO"),
  vendasPorPeriodo,
);

router.get(
  "/top-produtos",
  authMiddleware,
  authorizeRoles("Estoquista", "Gerente de Operações"),
  audit("REL_TOP_PRODUTOS"),
  topProdutos,
);

router.get(
  "/movimentacoes",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("REL_MOV_USUARIO_DIA"),
  movPorUsuario,
);

router.get(
  "/rastreabilidade",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("REL_RASTREABILIDADE_VENDA"),
  rastreabilidadeVenda,
);

router.get(
  "/fechamento-caixa",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("REL_FECHAMENTO_CAIXA"),
  fechamentoCaixa,
);

router.get(
  "/fiscal",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("REL_FISCAL_PERIODO"),
  fiscalPorPeriodo,
);

module.exports = router;
