const express = require("express");
const router = express.Router();

const {
  criarVariacao,
  listarVariacoes,
  criarVariacoesEmLote,
} = require("../controllers/variacoes.controller");

// /produtos/:id/variacoes  
router.get("/:id/variacoes", listarVariacoes);
router.post("/:id/variacoes", criarVariacao);
router.post("/:id/variacoes/lote", criarVariacoesEmLote);


module.exports = router;
