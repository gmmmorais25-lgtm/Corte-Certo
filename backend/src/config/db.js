const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: {
        rejectUnauthorized: false
    },

    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,

    typeCast: (campo, proximo) => {
        if (campo.type === "TINY" && campo.length === 1) {
            return campo.string() === "1";
        }

        return proximo();
    },
});

module.exports = pool;