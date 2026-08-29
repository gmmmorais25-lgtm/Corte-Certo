const pool = require("../config/db");

// Granularidade dos horários sugeridos ao cliente. Não precisa ser igual à
// duração do serviço - só o passo entre um horário candidato e o próximo.
const GRANULARIDADE_MINUTOS = 40;

function paraMinutos(horaStr) {
    const [h, m] = horaStr.split(":").map(Number);
    return h * 60 + m;
}

function paraHoraStr(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}:00`;
}

// new Date("YYYY-MM-DD") interpreta como meia-noite UTC; num fuso negativo
// (Brasil, UTC-3) isso "vira" o dia anterior ao converter pra hora local, e
// getDay() erraria o dia da semana. Construindo com ano/mês/dia separados,
// o Date é criado em hora local e o dia da semana sai correto.
function diaDaSemana(dataStr) {
    const [ano, mes, dia] = dataStr.split("-").map(Number);
    return new Date(ano, mes - 1, dia).getDay();
}

function dataDeHojeStr() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function minutosAgora() {
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes();
}

function seSobrepoem(inicioA, fimA, inicioB, fimB) {
    return inicioA < fimB && fimA > inicioB;
}

// `executor` é o pool por padrão, mas o serviço de agendamentos passa uma
// conexão de transação aqui para ler dentro do mesmo lock (ver agendamentos.service.js).
async function buscarExpedienteDoDia(barbeiroId, dataStr, executor = pool) {
    const dia = diaDaSemana(dataStr);
    const [linhas] = await executor.query(
        "SELECT hora_inicio, hora_fim FROM expedientes WHERE barbeiro_id = ? AND dia_semana = ?",
        [barbeiroId, dia]
    );
    return linhas[0] || null;
}

async function buscarIntervalosOcupados(barbeiroId, dataStr, executor = pool) {
    const [bloqueios] = await executor.query(
        "SELECT hora_inicio, hora_fim FROM bloqueios_agenda WHERE barbeiro_id = ? AND data = ?",
        [barbeiroId, dataStr]
    );

    const diaTodoBloqueado = bloqueios.some((b) => b.hora_inicio === null);

    const [agendamentos] = await executor.query(
        "SELECT hora_inicio, hora_fim FROM agendamentos WHERE barbeiro_id = ? AND data = ? AND status != 'cancelado'",
        [barbeiroId, dataStr]
    );

    const ocupados = [
        ...bloqueios
            .filter((b) => b.hora_inicio !== null)
            .map((b) => ({ inicio: paraMinutos(b.hora_inicio), fim: paraMinutos(b.hora_fim) })),
        ...agendamentos.map((a) => ({ inicio: paraMinutos(a.hora_inicio), fim: paraMinutos(a.hora_fim) })),
    ];

    return { diaTodoBloqueado, ocupados };
}

// Lista os horários de início possíveis para um serviço de `duracaoMinutos`
// num barbeiro/data, cruzando expediente (quando ele trabalha) menos
// bloqueios pontuais e agendamentos já existentes (o que já está ocupado).
async function calcularHorariosDisponiveis({ barbeiroId, data, duracaoMinutos }) {
    const expediente = await buscarExpedienteDoDia(barbeiroId, data);
    if (!expediente) {
        return [];
    }

    const { diaTodoBloqueado, ocupados } = await buscarIntervalosOcupados(barbeiroId, data);
    if (diaTodoBloqueado) {
        return [];
    }

    const inicioExpediente = paraMinutos(expediente.hora_inicio);
    const fimExpediente = paraMinutos(expediente.hora_fim);
    const ehHoje = data === dataDeHojeStr();
    const limiteMinimo = ehHoje ? Math.max(inicioExpediente, minutosAgora()) : inicioExpediente;

    const horarios = [];
    for (let inicio = limiteMinimo; inicio + duracaoMinutos <= fimExpediente; inicio += GRANULARIDADE_MINUTOS) {
        const fim = inicio + duracaoMinutos;
        const conflita = ocupados.some((o) => seSobrepoem(inicio, fim, o.inicio, o.fim));
        if (!conflita) {
            horarios.push(paraHoraStr(inicio).slice(0, 5));
        }
    }

    return horarios;
}

// Verificação pontual de UM horário específico (usada na criação do
// agendamento, dentro da transação com lock - ver agendamentos.service.js).
// Reaproveita a mesma lógica de sobreposição, só que para um único intervalo
// em vez de gerar a lista inteira de candidatos.
async function horarioEstaDisponivel({ barbeiroId, data, horaInicio, horaFim }, executor = pool) {
    const expediente = await buscarExpedienteDoDia(barbeiroId, data, executor);
    if (!expediente) {
        return false;
    }

    const inicio = paraMinutos(horaInicio);
    const fim = paraMinutos(horaFim);
    if (inicio < paraMinutos(expediente.hora_inicio) || fim > paraMinutos(expediente.hora_fim)) {
        return false;
    }

    const { diaTodoBloqueado, ocupados } = await buscarIntervalosOcupados(barbeiroId, data, executor);
    if (diaTodoBloqueado) {
        return false;
    }

    return !ocupados.some((o) => seSobrepoem(inicio, fim, o.inicio, o.fim));
}

module.exports = {
    calcularHorariosDisponiveis,
    horarioEstaDisponivel,
    paraMinutos,
    paraHoraStr,
    dataDeHojeStr,
    minutosAgora,
};
