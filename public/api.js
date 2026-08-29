// Camada única de acesso à API - todas as páginas usam essas funções em vez
// de chamar fetch() direto, então autenticação e tratamento de erro ficam
// consistentes em um só lugar.
const API_BASE = "/api";
const CHAVE_TOKEN = "corteCerto_token";
const CHAVE_USUARIO = "corteCerto_usuario";

function obterToken() {
    return localStorage.getItem(CHAVE_TOKEN);
}

function obterUsuario() {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? JSON.parse(bruto) : null;
}

function salvarSessao(token, usuario) {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function encerrarSessao() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    window.location.href = "index.html";
}

// Redireciona para o login se não houver sessão, ou se a role não bater com
// o que a página exige. Cada página protegida chama isso antes de renderizar.
function exigirSessao(rolesPermitidas) {
    const usuario = obterUsuario();
    if (!usuario || !obterToken()) {
        window.location.href = "index.html";
        return null;
    }
    if (rolesPermitidas && !rolesPermitidas.includes(usuario.role)) {
        window.location.href = "index.html";
        return null;
    }
    return usuario;
}

async function api(metodo, caminho, corpo) {
    const cabecalhos = { "Content-Type": "application/json" };
    const token = obterToken();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;

    const resposta = await fetch(`${API_BASE}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });

    if (resposta.status === 204) return null;

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        const erro = new Error((dados && dados.erro) || "Erro inesperado. Tente novamente.");
        erro.status = resposta.status;
        throw erro;
    }

    return dados;
}

// Envia multipart/form-data (upload de arquivo) - não usa api() porque o
// Content-Type precisa ser definido automaticamente pelo navegador (com o
// boundary do multipart), nunca "application/json".
async function apiUpload(caminho, formData) {
    const cabecalhos = {};
    const token = obterToken();
    if (token) cabecalhos.Authorization = `Bearer ${token}`;

    const resposta = await fetch(`${API_BASE}${caminho}`, {
        method: "POST",
        headers: cabecalhos,
        body: formData,
    });

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        const erro = new Error((dados && dados.erro) || "Erro ao enviar imagem.");
        erro.status = resposta.status;
        throw erro;
    }

    return dados;
}

// Silhueta neutra em SVG (embutida, sem depender de internet) usada só
// enquanto o admin não define uma foto real para o barbeiro.
const SILHUETA_PADRAO = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#2a2a2a"/>
        <circle cx="50" cy="38" r="18" fill="#555"/>
        <path d="M50 62c-22 0-34 14-34 30v8h68v-8c0-16-12-30-34-30z" fill="#555"/>
    </svg>
`);

function fotoBarbeiro(barbeiro) {
    return barbeiro.foto_url || SILHUETA_PADRAO;
}
