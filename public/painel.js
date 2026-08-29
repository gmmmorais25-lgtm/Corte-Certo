const usuario = exigirSessao(["barbeiro", "admin"]);
const ehAdmin = usuario.role === "admin";
let meuBarbeiroId = null;

const NOMES_DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const ROTULOS_STATUS = { pendente: "Pendente", confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído" };

document.getElementById("nome-usuario").textContent = usuario.nome;
document.getElementById("papel-usuario").textContent = ehAdmin ? "(Administrador)" : "(Barbeiro)";
document.getElementById("botao-sair").addEventListener("click", encerrarSessao);

// Remove do DOM as abas/seções que não fazem sentido para o papel logado
// (ex: barbeiro não vê "Barbeiros"; admin não vê "Meu expediente").
document.querySelectorAll("[data-somente]").forEach((el) => {
    const somente = el.dataset.somente;
    if ((somente === "admin" && !ehAdmin) || (somente === "barbeiro" && ehAdmin)) {
        el.remove();
    }
});

function formatarData(dataStr) {
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarPreco(preco) {
    return Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataDeHojeStr() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function mostrarToast(mensagem, tipo = "sucesso") {
    const toastAntigo = document.querySelector(".toast");
    if (toastAntigo) toastAntigo.remove();

    const toast = document.createElement("div");
    toast.className = `toast ${tipo === "erro" ? "erro" : ""}`;
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- Navegação por abas ---
// Abas que giram em torno de UM barbeiro específico. Nessas, o admin usa o
// seletor compartilhado no topo; nas outras (Serviços/Barbeiros) ele some.
const ABAS_COM_BARBEIRO_EM_FOCO = ["agenda", "expediente", "bloqueios"];

function ativarAba(nome) {
    document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
    document.querySelectorAll(".painel-conteudo").forEach((s) => s.classList.toggle("ativo", s.id === `conteudo-${nome}`));

    if (ehAdmin) {
        const seletor = document.getElementById("selecao-barbeiro-admin");
        seletor.style.display = ABAS_COM_BARBEIRO_EM_FOCO.includes(nome) ? "block" : "none";
    }

    if (nome === "agenda") carregarAgenda();
    if (nome === "expediente") carregarExpediente();
    if (nome === "bloqueios") carregarBloqueios();
    if (nome === "servicos") carregarServicos();
    if (nome === "barbeiros") carregarBarbeirosPainel();
}

document.querySelectorAll(".aba").forEach((botao) => {
    botao.addEventListener("click", () => ativarAba(botao.dataset.aba));
});

// Barbeiro sob gestão no momento: o próprio, se for barbeiro logado; o
// escolhido no seletor, se for admin. Usado por Agenda/Expediente/Bloqueios.
function barbeiroEmFoco() {
    return ehAdmin ? document.getElementById("select-barbeiro-foco").value : meuBarbeiroId;
}

async function carregarSelectBarbeiros() {
    const select = document.getElementById("select-barbeiro-foco");
    const barbeiros = await api("GET", "/barbeiros?incluirInativos=true");
    select.innerHTML = barbeiros.map((b) => `<option value="${b.id}">${b.nome}${b.ativo ? "" : " (inativo)"}</option>`).join("");
}

function botaoAcaoAgendamento(agendamento) {
    const botoes = [];
    if (agendamento.status === "pendente") {
        botoes.push(`<button class="botao-acao sucesso" data-acao="confirmado" data-id="${agendamento.id}">Confirmar</button>`);
        botoes.push(`<button class="botao-acao perigo" data-acao="cancelado" data-id="${agendamento.id}">Cancelar</button>`);
    } else if (agendamento.status === "confirmado") {
        botoes.push(`<button class="botao-acao sucesso" data-acao="concluido" data-id="${agendamento.id}">Concluir</button>`);
        botoes.push(`<button class="botao-acao perigo" data-acao="cancelado" data-id="${agendamento.id}">Cancelar</button>`);
    }
    return botoes.join("");
}

async function carregarAgenda() {
    const lista = document.getElementById("lista-agenda");
    const inputData = document.getElementById("input-data-agenda");
    const agendaCompleta = document.getElementById("checkbox-agenda-completa").checked;
    const barbeiroId = barbeiroEmFoco();

    inputData.disabled = agendaCompleta;

    if (!barbeiroId) {
        lista.innerHTML = '<p class="vazio">Selecione um barbeiro.</p>';
        return;
    }

    lista.innerHTML = '<p class="vazio">Carregando...</p>';

    try {
        const query = agendaCompleta
            ? `/agendamentos?barbeiro_id=${barbeiroId}`
            : `/agendamentos?barbeiro_id=${barbeiroId}&data=${inputData.value}`;
        const agendamentos = await api("GET", query);

        if (agendamentos.length === 0) {
            lista.innerHTML = `<p class="vazio">Nenhum agendamento${agendaCompleta ? "" : " nesse dia"}.</p>`;
            return;
        }

        lista.innerHTML = "";
        agendamentos.forEach((agendamento) => {
            const card = document.createElement("div");
            card.className = "card-agendamento";
            // Na agenda completa (várias datas misturadas) a data precisa
            // aparecer; no filtro por dia ela é redundante mas não atrapalha.
            card.innerHTML = `
                <div class="info-principal">
                    <span class="linha-destaque">${formatarData(agendamento.data)} · ${agendamento.hora_inicio.slice(0, 5)} · ${agendamento.servico_nome}</span>
                    <span class="linha-secundaria">${agendamento.cliente_nome}${agendamento.cliente_telefone ? " · " + agendamento.cliente_telefone : ""} · ${formatarPreco(agendamento.preco_cobrado)}</span>
                </div>
                <div class="acoes">
                    <span class="badge badge-${agendamento.status}">${ROTULOS_STATUS[agendamento.status]}</span>
                    ${botaoAcaoAgendamento(agendamento)}
                </div>
            `;
            lista.appendChild(card);
        });

        lista.querySelectorAll("[data-acao]").forEach((botao) => {
            botao.addEventListener("click", async () => {
                try {
                    await api("PATCH", `/agendamentos/${botao.dataset.id}/status`, { status: botao.dataset.acao });
                    mostrarToast("Agendamento atualizado.");
                    carregarAgenda();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });
    } catch (erro) {
        lista.innerHTML = `<p class="vazio">Erro: ${erro.message}</p>`;
    }
}

// =========================================================
// Expediente (só admin - escolhe o barbeiro no seletor acima)
// =========================================================
async function carregarExpediente() {
    const grade = document.getElementById("grade-expediente");
    if (!grade) return;

    const barbeiroId = barbeiroEmFoco();
    if (!barbeiroId) {
        grade.innerHTML = '<p class="vazio">Selecione um barbeiro.</p>';
        return;
    }

    grade.innerHTML = '<p class="vazio">Carregando...</p>';

    try {
        const expediente = await api("GET", `/barbeiros/${barbeiroId}/expediente`);
        const porDia = {};
        expediente.forEach((e) => { porDia[e.dia_semana] = e; });

        grade.innerHTML = "";
        for (let dia = 0; dia <= 6; dia++) {
            const atual = porDia[dia];
            const linha = document.createElement("div");
            linha.className = `linha-expediente${atual ? "" : " folga"}`;
            linha.dataset.dia = dia;
            linha.innerHTML = `
                <label style="display:flex; align-items:center; gap:0.5rem; width:190px;">
                    <input type="checkbox" class="expediente-ativo" ${atual ? "checked" : ""}>
                    <span>${NOMES_DIAS[dia]}</span>
                </label>
                <input type="time" class="expediente-inicio" value="${atual ? atual.hora_inicio.slice(0, 5) : "09:00"}">
                <span>até</span>
                <input type="time" class="expediente-fim" value="${atual ? atual.hora_fim.slice(0, 5) : "18:00"}">
            `;
            grade.appendChild(linha);
        }

        grade.querySelectorAll(".expediente-ativo").forEach((cb) => {
            cb.addEventListener("change", () => {
                cb.closest(".linha-expediente").classList.toggle("folga", !cb.checked);
            });
        });
    } catch (erro) {
        grade.innerHTML = `<p class="vazio">Erro: ${erro.message}</p>`;
    }
}

const botaoSalvarExpediente = document.getElementById("botao-salvar-expediente");
if (botaoSalvarExpediente) {
    botaoSalvarExpediente.addEventListener("click", async () => {
        const linhas = document.querySelectorAll(".linha-expediente");
        const operacoes = [];

        linhas.forEach((linha) => {
            const dia = linha.dataset.dia;
            const ativo = linha.querySelector(".expediente-ativo").checked;

            if (ativo) {
                const inicio = linha.querySelector(".expediente-inicio").value;
                const fim = linha.querySelector(".expediente-fim").value;
                operacoes.push(api("PUT", `/barbeiros/${barbeiroEmFoco()}/expediente/${dia}`, { hora_inicio: inicio, hora_fim: fim }));
            } else {
                // Se não havia expediente nesse dia, o DELETE só devolve 404 - inofensivo de ignorar.
                operacoes.push(api("DELETE", `/barbeiros/${barbeiroEmFoco()}/expediente/${dia}`).catch(() => {}));
            }
        });

        await Promise.allSettled(operacoes);
        mostrarToast("Expediente atualizado.");
        carregarExpediente();
    });
}

// =========================================================
// Bloqueios (só admin - escolhe o barbeiro no seletor acima)
// =========================================================
const checkboxDiaInteiro = document.getElementById("bloqueio-dia-inteiro");
if (checkboxDiaInteiro) {
    checkboxDiaInteiro.addEventListener("change", (e) => {
        document.getElementById("bloqueio-horarios").style.display = e.target.checked ? "none" : "flex";
    });
}

const formBloqueio = document.getElementById("form-bloqueio");
if (formBloqueio) {
    formBloqueio.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById("erro-bloqueio");
        erroEl.textContent = "";

        const diaInteiro = document.getElementById("bloqueio-dia-inteiro").checked;
        const corpo = {
            data: document.getElementById("bloqueio-data").value,
            motivo: document.getElementById("bloqueio-motivo").value || undefined,
        };
        if (!diaInteiro) {
            corpo.hora_inicio = document.getElementById("bloqueio-inicio").value;
            corpo.hora_fim = document.getElementById("bloqueio-fim").value;
        }

        try {
            await api("POST", `/barbeiros/${barbeiroEmFoco()}/bloqueios`, corpo);
            mostrarToast("Bloqueio adicionado.");
            formBloqueio.reset();
            document.getElementById("bloqueio-dia-inteiro").checked = true;
            document.getElementById("bloqueio-horarios").style.display = "none";
            carregarBloqueios();
        } catch (erro) {
            erroEl.textContent = erro.message;
        }
    });
}

async function carregarBloqueios() {
    const lista = document.getElementById("lista-bloqueios");
    if (!lista) return;

    const barbeiroId = barbeiroEmFoco();
    if (!barbeiroId) {
        lista.innerHTML = '<p class="vazio">Selecione um barbeiro.</p>';
        return;
    }

    lista.innerHTML = '<p class="vazio">Carregando...</p>';

    try {
        const bloqueios = await api("GET", `/barbeiros/${barbeiroId}/bloqueios`);

        if (bloqueios.length === 0) {
            lista.innerHTML = '<p class="vazio">Nenhum bloqueio cadastrado.</p>';
            return;
        }

        lista.innerHTML = "";
        bloqueios.forEach((b) => {
            const janela = b.hora_inicio ? `${b.hora_inicio.slice(0, 5)} - ${b.hora_fim.slice(0, 5)}` : "Dia inteiro";
            const card = document.createElement("div");
            card.className = "card-agendamento";
            card.innerHTML = `
                <div class="info-principal">
                    <span class="linha-destaque">${formatarData(b.data)} · ${janela}</span>
                    <span class="linha-secundaria">${b.motivo || "Sem motivo informado"}</span>
                </div>
                <div class="acoes">
                    <button class="botao-acao perigo" data-id="${b.id}">Remover</button>
                </div>
            `;
            lista.appendChild(card);
        });

        lista.querySelectorAll("[data-id]").forEach((botao) => {
            botao.addEventListener("click", async () => {
                if (!confirm("Remover este bloqueio?")) return;
                try {
                    await api("DELETE", `/barbeiros/${barbeiroEmFoco()}/bloqueios/${botao.dataset.id}`);
                    carregarBloqueios();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });
    } catch (erro) {
        lista.innerHTML = `<p class="vazio">Erro: ${erro.message}</p>`;
    }
}

// =========================================================
// Serviços (só admin)
// =========================================================
let servicoEmEdicaoId = null;

function cancelarEdicaoServico() {
    servicoEmEdicaoId = null;
    document.getElementById("form-servico").reset();
    document.getElementById("botao-salvar-servico").textContent = "Cadastrar serviço";
    document.getElementById("botao-cancelar-edicao-servico").style.display = "none";
}

const formServico = document.getElementById("form-servico");
if (formServico) {
    formServico.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById("erro-servico");
        erroEl.textContent = "";

        const corpo = {
            nome: document.getElementById("servico-nome").value,
            duracao_minutos: Number(document.getElementById("servico-duracao").value),
            preco: Number(document.getElementById("servico-preco").value),
        };

        try {
            if (servicoEmEdicaoId) {
                await api("PUT", `/servicos/${servicoEmEdicaoId}`, corpo);
                mostrarToast("Serviço atualizado.");
            } else {
                await api("POST", "/servicos", corpo);
                mostrarToast("Serviço cadastrado.");
            }
            cancelarEdicaoServico();
            carregarServicos();
        } catch (erro) {
            erroEl.textContent = erro.message;
        }
    });

    document.getElementById("botao-cancelar-edicao-servico").addEventListener("click", cancelarEdicaoServico);
}

async function carregarServicos() {
    const lista = document.getElementById("lista-servicos");
    lista.innerHTML = '<p class="vazio">Carregando...</p>';

    try {
        const servicos = await api("GET", "/servicos?incluirInativos=true");

        if (servicos.length === 0) {
            lista.innerHTML = '<p class="vazio">Nenhum serviço cadastrado.</p>';
            return;
        }

        lista.innerHTML = "";
        servicos.forEach((s) => {
            const card = document.createElement("div");
            card.className = "card-agendamento";
            card.innerHTML = `
                <div class="info-principal">
                    <span class="linha-destaque">${s.nome}</span>
                    <span class="linha-secundaria">${s.duracao_minutos} min · ${formatarPreco(s.preco)}</span>
                </div>
                <div class="acoes">
                    <span class="badge ${s.ativo ? "badge-confirmado" : "badge-cancelado"}">${s.ativo ? "Ativo" : "Inativo"}</span>
                    <button class="botao-acao" data-editar="${s.id}">Editar</button>
                    <button class="botao-acao ${s.ativo ? "perigo" : "sucesso"}" data-alternar="${s.id}" data-ativo="${s.ativo}">${s.ativo ? "Desativar" : "Reativar"}</button>
                </div>
            `;
            lista.appendChild(card);
        });

        lista.querySelectorAll("[data-editar]").forEach((botao) => {
            botao.addEventListener("click", () => {
                const servico = servicos.find((s) => s.id === Number(botao.dataset.editar));
                servicoEmEdicaoId = servico.id;
                document.getElementById("servico-nome").value = servico.nome;
                document.getElementById("servico-duracao").value = servico.duracao_minutos;
                document.getElementById("servico-preco").value = servico.preco;
                document.getElementById("botao-salvar-servico").textContent = "Salvar alterações";
                document.getElementById("botao-cancelar-edicao-servico").style.display = "inline-block";
                document.getElementById("form-servico").scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });

        lista.querySelectorAll("[data-alternar]").forEach((botao) => {
            botao.addEventListener("click", async () => {
                try {
                    const ativo = botao.dataset.ativo === "true";
                    const id = botao.dataset.alternar;
                    await api(ativo ? "DELETE" : "PATCH", ativo ? `/servicos/${id}` : `/servicos/${id}/reativar`);
                    carregarServicos();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });
    } catch (erro) {
        lista.innerHTML = `<p class="vazio">Erro: ${erro.message}</p>`;
    }
}

// =========================================================
// Barbeiros (só admin)
// =========================================================
const formAdmin = document.getElementById("form-admin");
if (formAdmin) {
    formAdmin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById("erro-admin");
        erroEl.textContent = "";

        try {
            await api("POST", "/admins", {
                nome: document.getElementById("admin-nome").value,
                email: document.getElementById("admin-email").value,
                senha: document.getElementById("admin-senha").value,
            });
            mostrarToast("Administrador cadastrado.");
            formAdmin.reset();
        } catch (erro) {
            erroEl.textContent = erro.message;
        }
    });
}

const formBarbeiro = document.getElementById("form-barbeiro");
if (formBarbeiro) {
    document.getElementById("barbeiro-foto").addEventListener("change", (e) => {
        const arquivo = e.target.files[0];
        document.getElementById("rotulo-barbeiro-foto").textContent = arquivo ? arquivo.name : "Escolher arquivo";
    });

    formBarbeiro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById("erro-barbeiro");
        erroEl.textContent = "";

        try {
            const barbeiro = await api("POST", "/barbeiros", {
                nome: document.getElementById("barbeiro-nome").value,
                email: document.getElementById("barbeiro-email").value,
                telefone: document.getElementById("barbeiro-telefone").value,
                senha: document.getElementById("barbeiro-senha").value,
            });

            // A foto só pode ser enviada depois de criar o barbeiro (o
            // upload precisa do id gerado pelo INSERT). Se falhar aqui, o
            // barbeiro já foi criado - só avisa que a foto pode ser
            // definida depois pelo card na listagem.
            const arquivoFoto = document.getElementById("barbeiro-foto").files[0];
            if (arquivoFoto) {
                const formData = new FormData();
                formData.append("foto", arquivoFoto);
                await apiUpload(`/barbeiros/${barbeiro.id}/foto`, formData).catch((erroFoto) => {
                    mostrarToast(`Barbeiro criado, mas a foto falhou: ${erroFoto.message}`, "erro");
                });
            }

            mostrarToast("Barbeiro cadastrado.");
            formBarbeiro.reset();
            document.getElementById("rotulo-barbeiro-foto").textContent = "Escolher arquivo";
            carregarBarbeirosPainel();
        } catch (erro) {
            erroEl.textContent = erro.message;
        }
    });
}

async function carregarBarbeirosPainel() {
    const grade = document.getElementById("grade-barbeiros-painel");
    if (!grade) return;
    grade.innerHTML = '<p class="vazio">Carregando...</p>';

    try {
        const barbeiros = await api("GET", "/barbeiros?incluirInativos=true");

        if (barbeiros.length === 0) {
            grade.innerHTML = '<p class="vazio">Nenhum barbeiro cadastrado.</p>';
            return;
        }

        grade.innerHTML = "";
        barbeiros.forEach((b) => {
            const card = document.createElement("div");
            card.className = "card-barbeiro";
            card.innerHTML = `
                <img src="${fotoBarbeiro(b)}" alt="Foto de ${b.nome}">
                <div class="nome-barbeiro">${b.nome}</div>
                <div class="status-barbeiro">${b.email}</div>
                <span class="badge ${b.ativo ? "badge-confirmado" : "badge-cancelado"}" style="margin-top:0.5rem;">${b.ativo ? "Ativo" : "Inativo"}</span>
                <div class="acoes-barbeiro-card">
                    <label class="botao-acao" style="cursor:pointer;">
                        Alterar foto
                        <input type="file" accept="image/jpeg,image/png,image/webp" data-upload-foto="${b.id}" style="display:none;">
                    </label>
                    <button class="botao-acao ${b.ativo ? "perigo" : "sucesso"}" data-id="${b.id}" data-ativo="${b.ativo}">${b.ativo ? "Desativar" : "Reativar"}</button>
                    ${!b.ativo ? `<button class="botao-acao perigo" data-excluir="${b.id}">Excluir permanentemente</button>` : ""}
                </div>
            `;
            grade.appendChild(card);
        });

        grade.querySelectorAll("[data-id]").forEach((botao) => {
            botao.addEventListener("click", async () => {
                try {
                    const ativo = botao.dataset.ativo === "true";
                    await api(ativo ? "DELETE" : "PATCH", ativo ? `/barbeiros/${botao.dataset.id}` : `/barbeiros/${botao.dataset.id}/reativar`);
                    carregarBarbeirosPainel();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });

        grade.querySelectorAll("[data-excluir]").forEach((botao) => {
            botao.addEventListener("click", async () => {
                if (!confirm("Excluir este barbeiro PERMANENTEMENTE? Essa ação não pode ser desfeita. Só funciona se ele nunca teve nenhum agendamento.")) {
                    return;
                }
                try {
                    await api("DELETE", `/barbeiros/${botao.dataset.excluir}/permanente`);
                    mostrarToast("Barbeiro excluído permanentemente.");
                    carregarBarbeirosPainel();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });

        grade.querySelectorAll("[data-upload-foto]").forEach((input) => {
            input.addEventListener("change", async () => {
                const arquivo = input.files[0];
                if (!arquivo) return;

                const formData = new FormData();
                formData.append("foto", arquivo);

                try {
                    await apiUpload(`/barbeiros/${input.dataset.uploadFoto}/foto`, formData);
                    mostrarToast("Foto atualizada.");
                    carregarBarbeirosPainel();
                } catch (erro) {
                    mostrarToast(erro.message, "erro");
                }
            });
        });
    } catch (erro) {
        grade.innerHTML = `<p class="vazio">Erro: ${erro.message}</p>`;
    }
}

// =========================================================
// Inicialização
// =========================================================
async function iniciar() {
    document.getElementById("input-data-agenda").value = dataDeHojeStr();
    document.getElementById("input-data-agenda").addEventListener("change", carregarAgenda);
    document.getElementById("checkbox-agenda-completa").addEventListener("change", carregarAgenda);

    if (ehAdmin) {
        await carregarSelectBarbeiros();
        // Trocar o barbeiro no seletor recarrega o que estiver na tela no
        // momento (agenda, expediente ou bloqueios - a aba ativa decide).
        document.getElementById("select-barbeiro-foco").addEventListener("change", () => {
            const abaAtiva = document.querySelector(".aba.ativa");
            if (abaAtiva) ativarAba(abaAtiva.dataset.aba);
        });
    } else {
        try {
            const perfil = await api("GET", "/barbeiros/me");
            meuBarbeiroId = perfil.id;
        } catch (erro) {
            mostrarToast("Erro ao carregar seu perfil: " + erro.message, "erro");
        }
    }

    const primeiraAba = document.querySelector(".aba");
    if (primeiraAba) ativarAba(primeiraAba.dataset.aba);
}

iniciar();
