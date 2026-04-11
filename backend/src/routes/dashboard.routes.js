// backend/src/routes/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/auth.middleware");
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");

const {
  obterDashboard,
  obterDashboardPdv,
  obterFaturamentoAnalitico,
} = require("../controllers/dashboard.controller");

// GET /dashboard
router.get(
  "/",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("DASHBOARD_GERENTE"),
  obterDashboard,
);
// GET /dashboard/pdv
router.get(
  "/pdv",
  authMiddleware,
  authorizeRoles("Vendedora", "Gerente de Operações"),
  audit("DASHBOARD_PDV"),
  obterDashboardPdv,
);

router.get("/faturamento", obterFaturamentoAnalitico);
module.exports = router;
