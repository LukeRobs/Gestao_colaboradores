const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  errorResponse,
} = require("../utils/response");

// ------------------------------
// DIA OPERACIONAL (06:00 → 05:59)
// ------------------------------
function getDataOperacionalRef(baseDate = new Date()) {
  const agora = new Date(baseDate);

  // Subtrai 6 horas para virar o dia
  const ref = new Date(agora.getTime() - 6 * 60 * 60 * 1000);

  // Zera horário
  ref.setHours(0, 0, 0, 0);

  return ref;
}

// ------------------------------
// CRON: gera AUSENTE para todos
// ------------------------------
const gerarAusenciasDiaOperacional = async () => {
  try {
    const agora = new Date();
    const dataOperacional = getDataOperacionalRef(agora);

    console.log("🕒 Gerando ausências:", dataOperacional);

    const tipoAusente = await prisma.tipoAusencia.findFirst({
      where: { codigo: "AUS" },
    });

    if (!tipoAusente) {
      console.error("❌ Não existe tipo 'AUS'. Crie no banco!");
      return;
    }

    const colaboradores = await prisma.colaborador.findMany({
      where: { status: "ATIVO" },
    });

    for (const col of colaboradores) {
      await prisma.frequencia.upsert({
        where: {
          opsId_dataReferencia: {
            opsId: col.opsId,
            dataReferencia: dataOperacional,
          },
        },
        update: {},
        create: {
          opsId: col.opsId,
          dataReferencia: dataOperacional,
          idTipoAusencia: tipoAusente.idTipoAusencia,
          horaEntrada: null,
          registradoPor: "sistema",
        },
      });
    }

    console.log("✅ Ausências geradas!");
  } catch (error) {
    console.error("❌ Erro no CRON:", error);
  }
};

// ------------------------------
// REGISTRO DO PONTO PELO CPF
// ------------------------------
const registrarPontoCPF = async (req, res) => {
  try {
    const { cpf } = req.body;

    if (!cpf) {
      return notFoundResponse(res, "CPF não informado");
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const agora = new Date();
    const dataOperacional = getDataOperacionalRef(agora);

    console.log("📅 Data operacional:", dataOperacional);

    // Tenta achar o tipo "P"
    const tipoPresenca = await prisma.tipoAusencia.findFirst({
      where: { codigo: "P" },
    });

    // Se não achar, registra sem tipo — SEM ERRO
    const idTipoPresenca = tipoPresenca ? tipoPresenca.idTipoAusencia : null;

    const registroExistente = await prisma.frequencia.findFirst({
      where: {
        opsId: colaborador.opsId,
        dataReferencia: dataOperacional,
      },
    });

    if (registroExistente && registroExistente.horaEntrada) {
      return successResponse(
        res,
        registroExistente,
        "Presença já registrada hoje"
      );
    }

    let registroFinal;

    if (registroExistente) {
      // AUS → PRESENÇA
      registroFinal = await prisma.frequencia.update({
        where: { idFrequencia: registroExistente.idFrequencia },
        data: {
          horaEntrada: agora,
          idTipoAusencia: idTipoPresenca,
          registradoPor: colaborador.opsId,
        },
      });
    } else {
      // cria registro direto
      registroFinal = await prisma.frequencia.create({
        data: {
          opsId: colaborador.opsId,
          dataReferencia: dataOperacional,
          horaEntrada: agora,
          idTipoAusencia: idTipoPresenca,
          registradoPor: colaborador.opsId,
        },
      });
    }

    return createdResponse(res, registroFinal, "Presença registrada!");
  } catch (err) {
    console.error("❌ ERRO registrar ponto:", err);
    return errorResponse(res, "Erro ao registrar ponto", 500);
  }
};

module.exports = {
  registrarPontoCPF,
  gerarAusenciasDiaOperacional,
};
