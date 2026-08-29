const usuario = exigirSessao(["cliente"]);

const gradeBarbeiros = document.getElementById("grade-barbeiros");
const gradeServicos = document.getElementById("grade-servicos");
const inputData = document.getElementById("input-data");
const gradeHorarios = document.getElementById("grade-horarios");
const botaoConfirmar = document.getElementById("botao-confirmar");
const listaMeusAgendamentos = document.getElementById("lista-meus-agendamentos");

let barbeiros = [];
let servicos = [];
let barbeiroSelecionadoId = null;
let servicoSelecionadoId = null;
let horarioSelecionado = null;

document.getElementById("nome-usuario").textContent = usuario.nome;
document.getElementById("botao-sair").addEventListener("click", encerrarSessao);

const hoje = new Date();
const dataMinima = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
inputData.min = dataMinima;
inputData.value = dataMinima;

function formatarData(dataStr) {
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarPreco(preco) {
    return Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

async function carregarBarbeiros() {
    try {
        barbeiros = await api("GET", "/barbeiros");
        if (barbeiros.length === 0) {
            gradeBarbeiros.innerHTML = '<p class="vazio">Nenhum barbeiro disponível no momento.</p>';
            return;
        }

        gradeBarbeiros.innerHTML = "";
        barbeiros.forEach((barbeiro) => {
            const card = document.createElement("div");
            card.className = "card-barbeiro";
            card.dataset.id = barbeiro.id;
            card.innerHTML = `
                <img src="${fotoBarbeiro(barbeiro)}" alt="Foto de ${barbeiro.nome}">
                <div class="nome-barbeiro">${barbeiro.nome}</div>
                <div class="status-barbeiro">Barbeiro</div>
            `;
            card.addEventListener("click", () => selecionarBarbeiro(barbeiro.id));
            gradeBarbeiros.appendChild(card);
        });
    } catch (erro) {
        gradeBarbeiros.innerHTML = `<p class="vazio">Erro ao carregar barbeiros: ${erro.message}</p>`;
    }
}

async function carregarServicos() {
    try {
        servicos = await api("GET", "/servicos");
        if (servicos.length === 0) {
            gradeServicos.innerHTML = '<p class="vazio">Nenhum serviço disponível no momento.</p>';
            return;
        }

        gradeServicos.innerHTML = "";
        servicos.forEach((servico) => {
            const card = document.createElement("div");
            card.className = "card-servico";
            card.dataset.id = servico.id;
            card.innerHTML = `
                <div class="nome-servico">${servico.nome}</div>
                <div class="detalhes-servico">
                    <span>${servico.duracao_minutos} min</span>
                    <span class="preco-servico">${formatarPreco(servico.preco)}</span>
                </div>
            `;
            card.addEventListener("click", () => selecionarServico(servico.id));
            gradeServicos.appendChild(card);
        });
    } catch (erro) {
        gradeServicos.innerHTML = `<p class="vazio">Erro ao carregar serviços: ${erro.message}</p>`;
    }
}

function selecionarBarbeiro(id) {
    barbeiroSelecionadoId = id;
    document.querySelectorAll(".card-barbeiro").forEach((el) => {
        el.classList.toggle("selecionado", Number(el.dataset.id) === id);
    });
    aoMudarSelecaoRelevante();
}

function selecionarServico(id) {
    servicoSelecionadoId = id;
    document.querySelectorAll(".card-servico").forEach((el) => {
        el.classList.toggle("selecionado", Number(el.dataset.id) === id);
    });
    aoMudarSelecaoRelevante();
}

function aoMudarSelecaoRelevante() {
    horarioSelecionado = null;
    botaoConfirmar.disabled = true;

    if (barbeiroSelecionadoId && servicoSelecionadoId && inputData.value) {
        carregarHorarios();
    } else {
        gradeHorarios.innerHTML = '<p class="vazio">Selecione barbeiro, serviço e data para ver os horários disponíveis.</p>';
    }
}

async function carregarHorarios() {
    gradeHorarios.innerHTML = '<p class="vazio">Carregando horários...</p>';

    try {
        const resultado = await api(
            "GET",
            `/barbeiros/${barbeiroSelecionadoId}/disponibilidade?data=${inputData.value}&servicoId=${servicoSelecionadoId}`
        );

        if (resultado.horarios.length === 0) {
            gradeHorarios.innerHTML = '<p class="vazio">Nenhum horário disponível nesse dia. Tente outra data.</p>';
            return;
        }

        gradeHorarios.innerHTML = "";
        resultado.horarios.forEach((horario) => {
            const botao = document.createElement("button");
            botao.className = "horario-slot";
            botao.type = "button";
            botao.textContent = horario;
            botao.addEventListener("click", () => {
                horarioSelecionado = horario;
                document.querySelectorAll(".horario-slot").forEach((el) => el.classList.remove("selecionado"));
                botao.classList.add("selecionado");
                botaoConfirmar.disabled = false;
            });
            gradeHorarios.appendChild(botao);
        });
    } catch (erro) {
        gradeHorarios.innerHTML = `<p class="vazio">Erro ao carregar horários: ${erro.message}</p>`;
    }
}

inputData.addEventListener("change", aoMudarSelecaoRelevante);

botaoConfirmar.addEventListener("click", async () => {
    if (!barbeiroSelecionadoId || !servicoSelecionadoId || !horarioSelecionado) return;

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Confirmando...";

    try {
        await api("POST", "/agendamentos", {
            barbeiro_id: barbeiroSelecionadoId,
            servico_id: servicoSelecionadoId,
            data: inputData.value,
            hora_inicio: horarioSelecionado,
        });

        mostrarToast("Agendamento confirmado com sucesso!");
        horarioSelecionado = null;
        await Promise.all([carregarHorarios(), carregarMeusAgendamentos()]);
    } catch (erro) {
        mostrarToast(erro.message, "erro");
        // 409 = alguém pegou esse horário primeiro - atualiza a lista pra refletir a realidade.
        await carregarHorarios();
    } finally {
        botaoConfirmar.disabled = horarioSelecionado === null;
        botaoConfirmar.textContent = "Confirmar agendamento";
    }
});

const ROTULOS_STATUS = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    cancelado: "Cancelado",
    concluido: "Concluído",
};

async function carregarMeusAgendamentos() {
    try {
        const agendamentos = await api("GET", "/agendamentos/meus");

        if (agendamentos.length === 0) {
            listaMeusAgendamentos.innerHTML = '<p class="vazio">Você ainda não tem agendamentos.</p>';
            return;
        }

        listaMeusAgendamentos.innerHTML = "";
        agendamentos.forEach((agendamento) => {
            const card = document.createElement("div");
            card.className = "card-agendamento";

            const podeCancel = ["pendente", "confirmado"].includes(agendamento.status);

            card.innerHTML = `
                <div class="info-principal">
                    <span class="linha-destaque">${agendamento.servico_nome} com ${agendamento.barbeiro_nome}</span>
                    <span class="linha-secundaria">${formatarData(agendamento.data)} às ${agendamento.hora_inicio.slice(0, 5)} · ${formatarPreco(agendamento.preco_cobrado)}</span>
                </div>
                <div class="acoes">
                    <span class="badge badge-${agendamento.status}">${ROTULOS_STATUS[agendamento.status]}</span>
                    ${podeCancel ? `<button class="botao-acao perigo" data-id="${agendamento.id}">Cancelar</button>` : ""}
                </div>
            `;

            listaMeusAgendamentos.appendChild(card);
        });

        listaMeusAgendamentos.querySelectorAll("[data-id]").forEach((botao) => {
            botao.addEventListener("click", () => cancelarAgendamento(Number(botao.dataset.id)));
        });
    } catch (erro) {
        listaMeusAgendamentos.innerHTML = `<p class="vazio">Erro ao carregar agendamentos: ${erro.message}</p>`;
    }
}

async function cancelarAgendamento(id) {
    if (!confirm("Cancelar este agendamento?")) return;

    try {
        await api("PATCH", `/agendamentos/${id}/status`, { status: "cancelado" });
        mostrarToast("Agendamento cancelado.");
        await Promise.all([carregarMeusAgendamentos(), carregarHorarios()]);
    } catch (erro) {
        mostrarToast(erro.message, "erro");
    }
}

carregarBarbeiros();
carregarServicos();
carregarMeusAgendamentos();
