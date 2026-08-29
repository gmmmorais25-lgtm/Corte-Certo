const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Salva direto em /public/uploads/barbeiros - o Express já serve /public
// como estático, então o arquivo fica acessível em /uploads/barbeiros/<nome>
// sem precisar de outra rota.
const PASTA_UPLOADS = path.join(__dirname, "..", "..", "..", "public", "uploads", "barbeiros");
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const armazenamento = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname).toLowerCase();
        cb(null, `barbeiro-${req.params.id}-${Date.now()}${extensao}`);
    },
});

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function filtroArquivo(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
        const erro = new Error("Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
        erro.status = 400;
        return cb(erro);
    }
    cb(null, true);
}

const upload = multer({
    storage: armazenamento,
    fileFilter: filtroArquivo,
    limits: { fileSize: 3 * 1024 * 1024 },
});

module.exports = upload;
