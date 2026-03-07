const express = require("express");
const router = express.Router();

const {
  registrarVenda,
  cancelarVenda,
  devolverVenda,
  listarVendas,
  buscarVenda,
} = require("../controllers/vendas.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");
const { audit } = require("../middlewares/audit.middleware");
const { authorizeRoles } = require("../middlewares/authorize.middleware");
const { aplicarDescontoItem } = require("../controllers/vendas.controller");
const {
  blockIfFiscalEmitida,
} = require("../middlewares/fiscalBlock.middleware");

// GET /vendas (listar)
router.get(
  "/vendas",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("VENDA_LISTADA"),
  listarVendas,
);

// GET /vendas/:id_venda (detalhar)
router.get(
  "/vendas/:id_venda",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("VENDA_DETALHADA"),
  buscarVenda,
);
router.put(
  "/vendas/:id_venda/cancelar",
  authMiddleware,
  authorizeRoles("Gerente de Operações"),
  audit("VENDA_CANCELADA"),
  blockIfFiscalEmitida("id_venda"), // aqui
  cancelarVenda,
);

// POST /vendas
router.post(
  "/vendas",
  authMiddleware,
  audit("VENDA_REGISTRADA"),
  registrarVenda,
);

// PUT /vendas/:id/devolver
router.put(
  "/vendas/:id/devolver",
  authMiddleware,
  audit("VENDA_DEVOLVIDA"),
  devolverVenda,
);

// PATCH /vendas/:id_venda/itens/:id_item/desconto
router.patch(
  "/vendas/:id_venda/itens/:id_item/desconto",
  authMiddleware,
  authorizeRoles("Vendedora", "Gerente de Operações"),
  audit("VENDA_DESCONTO_ITEM"),
  aplicarDescontoItem,
);

module.exports = router;
