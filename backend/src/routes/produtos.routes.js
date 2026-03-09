const express = require("express");
const router = express.Router();

const {
  listarProdutos,
  criarProduto,
  listarProdutosPDV,
} = require("../controllers/produtos.controller");

// GET /produtos
router.get("/", listarProdutos);
// GET /produtos/pdv
router.get("/pdv", listarProdutosPDV);
router.post("/", criarProduto);

module.exports = router;
