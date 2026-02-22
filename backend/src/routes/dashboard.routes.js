// backend/src/routes/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/auth.middleware");
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");

const { obterDashboard } = require("../controllers/dashboard.controller");

// GET /dashboard
router.get(
  "/",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("DASHBOARD_GERENTE"),
  obterDashboard,
);

module.exports = router;
