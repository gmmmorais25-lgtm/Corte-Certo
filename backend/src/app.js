const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const servicosRoutes = require("./routes/servicos.routes");
const barbeirosRoutes = require("./routes/barbeiros.routes");
const agendamentosRoutes = require("./routes/agendamentos.routes");
const adminsRoutes = require("./routes/admins.routes");
const tratadorDeErros = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/servicos", servicosRoutes);
app.use("/api/barbeiros", barbeirosRoutes);
app.use("/api/agendamentos", agendamentosRoutes);
app.use("/api/admins", adminsRoutes);

// O Express também serve o front-end estático (HTML/CSS/JS puro em /public),
// para tudo rodar na mesma origem com "npm start" - sem precisar de um
// servidor HTTP separado nem lidar com CORS entre as duas partes. Servir só
// /public (não a raiz do projeto) é o que impede backend/.env e os scripts
// SQL de ficarem acessíveis por HTTP.
app.use(express.static(path.join(__dirname, "..", "..", "public")));

// Precisa vir depois das rotas: é o único middleware com 4 argumentos,
// o que o Express usa para identificar um error handler.
app.use(tratadorDeErros);

module.exports = app;
