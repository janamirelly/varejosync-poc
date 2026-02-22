const express = require("express");
const router = express.Router();
//const { obterDashboard } = require("../controllers/dashboard.controller");
const { authMiddleware } = require("../middlewares/auth.middleware"); // se já tiver auth em algumas
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");


const {
  consultarEstoque,
  registrarMovimentacao,
  atualizarEstoqueMinimo,
  listarEstoqueDetalhado,
  listarEstoquePorProduto,
} = require("../controllers/estoque.controller");

// GET /dashboard
//router.get("/dashboard", audit("CONSULTA_DASHBOARD"), obterDashboard);

// GET /estoque  -> lista detalhada (vendedora/estoquista)
router.get(
  "/estoque",
  authMiddleware,
  audit("CONSULTA_ESTOQUE_LISTA"),
  listarEstoqueDetalhado,
);

// GET /produtos/:id/estoque -> por produto (vendedora/estoquista)
router.get(
  "/produtos/:id/estoque",
  authMiddleware,
  audit("CONSULTA_ESTOQUE_PRODUTO"),
  listarEstoquePorProduto,
);

// GET /estoque/detalhado 
router.get(
  "/estoque/detalhado",
  authMiddleware,
  audit("CONSULTA_ESTOQUE_LISTA"),
  listarEstoqueDetalhado,
);

// GET /estoque/:id_variacao

router.get(
  "/estoque/:id_variacao",
  authMiddleware,
  audit("CONSULTA_ESTOQUE_VARIACAO"),
  consultarEstoque,
);

// PUT mínimo
router.put(
  "/estoque/:id_variacao/minimo",
  authMiddleware,
  authorizeRoles("Estoquista", "Gerente de Operações"),
  audit("ALTERAR_ESTOQUE_MIN"),
  atualizarEstoqueMinimo,
);

// POST /estoque/movimentacoes

router.post(
  "/estoque/movimentacoes",
  authMiddleware,
  authorizeRoles("Estoquista", "Gerente de Operações"),
  audit("MOV_ESTOQUE_MANUAL"),
  registrarMovimentacao,
);

module.exports = router;
