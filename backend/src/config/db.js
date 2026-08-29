const mysql = require("mysql2/promise");

// Pool de conexões: cada requisição pega uma conexão emprestada e devolve ao
// final. Evita o custo de abrir/fechar conexão TCP a cada query e, mais
// importante para a regra de disponibilidade, permite usar transações com
// lock de linha (SELECT ... FOR UPDATE) sem disputar uma única conexão global.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    // Sem isso, colunas BOOLEAN (na prática TINYINT(1) no MySQL) voltam do
    // driver como 1/0 em vez de true/false - e o front-end (e o JSON da API)
    // esperam um booleano de verdade. TINYINT(1) é sempre um flag; qualquer
    // outro TINYINT (ex: dia_semana) não tem length 1 e não é afetado.
    typeCast: (campo, proximo) => {
        if (campo.type === "TINY" && campo.length === 1) {
            return campo.string() === "1";
        }
        return proximo();
    },
});

module.exports = pool;
