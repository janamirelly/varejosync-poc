const express = require("express");
const router = express.Router();

const { listarProdutos, criarProduto } = require("../controllers/produtos.controller");

// GET /produtos
router.get("/", listarProdutos);
router.post("/", criarProduto);

module.exports = router;
