const jwt = require("jsonwebtoken");

// Verifica o token e popula req.usuario. Não consulta o banco: confia no
// payload assinado (id + role) pelo tempo de vida do token.
function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization;
    if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
        return res.status(401).json({ erro: "Token de autenticação não informado." });
    }

    const token = cabecalho.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = { id: payload.id, role: payload.role };
        next();
    } catch (erro) {
        return res.status(401).json({ erro: "Token inválido ou expirado." });
    }
}

// Para rotas públicas que se comportam diferente quando há um usuário logado
// (ex: listagem de serviços mostra inativos para barbeiro/admin). Nunca
// bloqueia a requisição: token ausente ou inválido só significa "anônimo".
function autenticarOpcional(req, res, next) {
    const cabecalho = req.headers.authorization;
    if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
        return next();
    }

    try {
        const payload = jwt.verify(cabecalho.split(" ")[1], process.env.JWT_SECRET);
        req.usuario = { id: payload.id, role: payload.role };
    } catch (erro) {
        // token inválido/expirado: segue como anônimo em vez de falhar.
    }
    next();
}

// Restringe o acesso por role. Uso: autorizar("barbeiro", "admin")
function autorizar(...rolesPermitidas) {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidas.includes(req.usuario.role)) {
            return res.status(403).json({ erro: "Você não tem permissão para acessar este recurso." });
        }
        next();
    };
}

module.exports = { autenticar, autenticarOpcional, autorizar };
