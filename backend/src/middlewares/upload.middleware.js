const multer = require("multer");

const armazenamento = multer.memoryStorage();

const TIPOS_PERMITIDOS = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

function filtroArquivo(req, file, cb) {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
        const erro = new Error(
            "Formato de imagem não suportado. Use JPG, PNG ou WEBP."
        );
        erro.status = 400;
        return cb(erro);
    }

    cb(null, true);
}

const upload = multer({
    storage: armazenamento,
    fileFilter: filtroArquivo,
    limits: {
        fileSize: 3 * 1024 * 1024,
    },
});

module.exports = upload;