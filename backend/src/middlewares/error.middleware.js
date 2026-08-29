// Middleware de erro centralizado: services lançam Error com .status opcional,
// controllers só repassam via next(erro). Aqui é o único lugar que decide o
// formato da resposta de erro e evita vazar detalhes internos (stack, SQL) ao cliente.
function tratadorDeErros(erro, req, res, next) {
    // Erro do multer quando o arquivo excede o limite configurado - não vem
    // com .status próprio, então precisa ser reconhecido pelo código.
    if (erro.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ erro: "Imagem muito grande (limite de 3MB)." });
    }

    const status = erro.status || 500;
    const mensagem = status === 500 ? "Erro interno do servidor." : erro.message;

    if (status === 500) {
        console.error(erro);
    }

    res.status(status).json({ erro: mensagem });
}

module.exports = tratadorDeErros;
