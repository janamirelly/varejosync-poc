process.stdout.setDefaultEncoding("utf8");

const express = require("express");
const cors = require("cors");

// inicializa banco
require("./db/database");
const produtosRoutes = require("./routes/produtos.routes");
const variacoesRoutes = require("./routes/variacoes.routes");
const estoqueRoutes = require("./routes/estoque.routes");
const vendasRoutes = require("./routes/vendas.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const authRoutes = require("./routes/auth.routes");
const movimentacaoRoutes = require("./routes/movimentacao.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const fiscalRoutes = require("./routes/fiscal.routes");

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de teste
app.get("/", (req, res) => {
  res.json({ message: "Backend VarejoSync rodando com sucesso 🚀" });
});

app.use("/produtos", produtosRoutes);
app.use("/produtos", variacoesRoutes);
app.use("/", estoqueRoutes);
app.use("/", vendasRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/auth", authRoutes);
app.use("/movimentacoes", movimentacaoRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/fiscal", fiscalRoutes);

// Servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
