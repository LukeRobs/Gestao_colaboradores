const { prisma } = require("../config/database");

async function detectarViolacaoDisciplinar(idFrequencia) {
  try {

    console.log("DETECTOR DISPARADO →", idFrequencia);

    /* ==============================
       BUSCAR FREQUÊNCIA
    ============================== */

    const frequencia = await prisma.frequencia.findUnique({
      where: { idFrequencia: parseInt(idFrequencia) },
      include: {
        tipoAusencia: true,
      },
    });

    if (!frequencia) {
      console.log("⚠️ Frequência não encontrada");
      return;
    }

    console.log("TIPO AUSENCIA →", frequencia.tipoAusencia?.codigo);

    /* ==============================
       VERIFICAR SE É FALTA
    ============================== */

    if (frequencia.tipoAusencia?.codigo !== "F") {
      console.log("Não é falta → ignorado");
      return;
    }

    /* ==============================
       EVITAR DUPLICAÇÃO
    ============================== */

    const jaExiste = await prisma.sugestaoMedidaDisciplinar.findFirst({
      where: {
        idFrequencia: frequencia.idFrequencia,
      },
    });

    if (jaExiste) {
      console.log("Sugestão já existe → ignorado");
      return;
    }

    /* ==============================
       BUSCAR MATRIZ DISCIPLINAR
    ============================== */

    const matriz = await prisma.matrizMedidaDisciplinar.findFirst({
      where: {
        violacao: "FALTA_INJUSTIFICADA",
      },
    });

    if (!matriz) {
      console.log("⚠️ Matriz disciplinar não encontrada");
      return;
    }

    /* ==============================
       CRIAR SUGESTÃO
    ============================== */

    // Verificar se já existe MD manual para o mesmo colaborador/violação (qualquer data)
    const mdManualExistente = await prisma.medidaDisciplinar.findFirst({
      where: {
        opsId: frequencia.opsId,
        violacao: "FALTA_INJUSTIFICADA",
        origem: "MANUAL",
        status: { not: "CANCELADO" },
      },
    });

    const statusSugestao = mdManualExistente ? "REJEITADA" : "PENDENTE";
    const aprovadoPor = mdManualExistente
      ? "SISTEMA — MD manual já registrada para esta data"
      : null;

    await prisma.sugestaoMedidaDisciplinar.create({
      data: {
        opsId: frequencia.opsId,
        idFrequencia: frequencia.idFrequencia,
        dataReferencia: frequencia.dataReferencia,
        violacao: "FALTA_INJUSTIFICADA",
        consequencia: matriz.consequencia,
        diasSuspensao: matriz.diasSuspensao,
        status: statusSugestao,
        ...(aprovadoPor && { aprovadoPor }),
      },
    });

    if (mdManualExistente) {
      console.log("⚠️ Sugestão criada como REJEITADA — MD manual já existe para", frequencia.opsId, "em", frequencia.dataReferencia);
    } else {
      console.log("✅ Sugestão criada para", frequencia.opsId);
    }

  } catch (error) {

    console.error("❌ detectorMedidaDisciplinar:", error);

  }
}

module.exports = detectarViolacaoDisciplinar;