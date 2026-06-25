const { prisma } = require("../config/database");
const { getDiasDsr } = require("../utils/dsr");

function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(spString);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function gerarDSRBackfillColaborador({ opsId, nomeEscala, dataInicio, tx = prisma, idEstacao = null }) {
  if (!opsId) throw new Error("opsId é obrigatório.");
  if (!nomeEscala) return { criados: 0 };

  const diasDsr = await getDiasDsr(nomeEscala, tx, idEstacao);
  if (!diasDsr.length) return { criados: 0 };

  const tipoDSR = await tx.tipoAusencia.findFirst({
    where: { codigo: "DSR" },
    select: { idTipoAusencia: true },
  });
  if (!tipoDSR) throw new Error("Tipo de ausência DSR não encontrado.");

  const inicio = startOfDay(dataInicio || agoraBrasil());
  const hoje   = startOfDay(agoraBrasil());

  if (inicio > hoje) return { criados: 0 };

  const registros = [];
  for (let data = new Date(inicio); data <= hoje; data.setDate(data.getDate() + 1)) {
    const dataRef = startOfDay(new Date(data));
    if (!diasDsr.includes(dataRef.getDay())) continue;
    registros.push({
      opsId,
      dataReferencia: dataRef,
      idTipoAusencia: tipoDSR.idTipoAusencia,
      justificativa: "DSR_BACKFILL",
      manual: false,
      validado: true,
    });
  }

  if (!registros.length) return { criados: 0 };

  const resultado = await tx.frequencia.createMany({ data: registros, skipDuplicates: true });

  // Sobrescreve registros que já existiam com id_tipo_ausencia null no mesmo dia de DSR
  await tx.frequencia.updateMany({
    where: {
      opsId,
      dataReferencia: { in: registros.map((r) => r.dataReferencia) },
      idTipoAusencia: null,
    },
    data: {
      idTipoAusencia: tipoDSR.idTipoAusencia,
      justificativa: "DSR_BACKFILL",
      manual: false,
      validado: true,
    },
  });

  return { criados: resultado.count || 0 };
}

async function gerarDSRFuturoColaborador({ opsId, nomeEscala, tx = prisma, dias = 90, idEstacao = null }) {
  if (!nomeEscala) return;

  const diasDsr = await getDiasDsr(nomeEscala, tx, idEstacao);
  if (!diasDsr.length) return;

  const tipoDSR = await tx.tipoAusencia.findFirst({
    where: { codigo: "DSR" },
    select: { idTipoAusencia: true },
  });
  if (!tipoDSR) return;

  const hoje = startOfDay(agoraBrasil());
  const registros = [];

  for (let i = 1; i <= dias; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() + i);
    if (!diasDsr.includes(data.getDay())) continue;
    registros.push({
      opsId,
      dataReferencia: data,
      idTipoAusencia: tipoDSR.idTipoAusencia,
      justificativa: "DSR_AUTO",
      manual: false,
      validado: true,
    });
  }

  if (registros.length) {
    await tx.frequencia.createMany({ data: registros, skipDuplicates: true });

    // Sobrescreve registros que já existiam com id_tipo_ausencia null no mesmo dia de DSR
    await tx.frequencia.updateMany({
      where: {
        opsId,
        dataReferencia: { in: registros.map((r) => r.dataReferencia) },
        idTipoAusencia: null,
      },
      data: {
        idTipoAusencia: tipoDSR.idTipoAusencia,
        justificativa: "DSR_AUTO",
        manual: false,
        validado: true,
      },
    });
  }
}

/**
 * Gera os 2 dias de Onboarding (ON) para um colaborador:
 * data_admissao e data_admissao + 1 dia.
 */
async function gerarOnboardingColaborador({ opsId, dataAdmissao, tx = prisma, idTipoAusenciaFallback = 34 }) {
  if (!opsId) throw new Error("opsId é obrigatório.");
  if (!dataAdmissao) throw new Error("dataAdmissao é obrigatória.");

  // Tenta pelo código "ON"; se não achar, usa o ID fixo como fallback
  const tipoON = await tx.tipoAusencia.findFirst({
    where: { OR: [{ codigo: "ON" }, { idTipoAusencia: idTipoAusenciaFallback }] },
    select: { idTipoAusencia: true, codigo: true },
    orderBy: { codigo: "asc" }, // "ON" < outros códigos, garante prioridade
  });
  if (!tipoON) throw new Error(`Tipo de ausência ON não encontrado (tentou código "ON" e id ${idTipoAusenciaFallback}).`);

  const dia1 = startOfDay(new Date(dataAdmissao));
  const dia2 = new Date(dia1);
  dia2.setDate(dia2.getDate() + 1);

  for (const dia of [dia1, dia2]) {
    await tx.frequencia.upsert({
      where: { opsId_dataReferencia: { opsId, dataReferencia: dia } },
      update: { idTipoAusencia: tipoON.idTipoAusencia, manual: false, registradoPor: "SISTEMA_AUTO" },
      create: { opsId, dataReferencia: dia, idTipoAusencia: tipoON.idTipoAusencia, manual: false, registradoPor: "SISTEMA_AUTO" },
    });
  }
}

/**
 * Preenche os dias restantes do mês de desligamento com o tipo correspondente
 * (DP / DV / DF) na tabela frequencia, a partir de dataDesligamento.
 */
async function gerarFrequenciaDesligamento({ opsId, dataDesligamento, tipoDesligamento, tx = prisma }) {
  if (!opsId || !dataDesligamento) return;

  const CODIGOS_VALIDOS = ["DP", "DV", "DF"];
  const codigoInput = String(tipoDesligamento || "").toUpperCase();
  const codigoFinal = CODIGOS_VALIDOS.find((c) => codigoInput.includes(c)) || "DP";

  const tipoAus = await tx.tipoAusencia.findFirst({
    where: { codigo: codigoFinal },
    select: { idTipoAusencia: true },
  });
  if (!tipoAus) return;

  // Usa UTC para evitar deslocamento de fuso (mesmo padrão do ponto.controller)
  const d0 = new Date(dataDesligamento);
  const inicio = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()));
  const fimMes = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)); // último dia do mês

  for (
    let cur = new Date(inicio);
    cur.getTime() <= fimMes.getTime();
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1))
  ) {
    const dataRef = new Date(cur);
    await tx.frequencia.upsert({
      where: { opsId_dataReferencia: { opsId, dataReferencia: dataRef } },
      update: {
        idTipoAusencia: tipoAus.idTipoAusencia,
        justificativa: "AUTO_DESLIGAMENTO",
        manual: false,
        validado: true,
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipoAus.idTipoAusencia,
        justificativa: "AUTO_DESLIGAMENTO",
        manual: false,
        validado: true,
      },
    });
  }
}

/**
 * Preenche o período de afastamento com AFA na tabela frequencia.
 */
async function gerarFrequenciaAfastamento({ opsId, dataInicio, dataFim, tx = prisma }) {
  if (!opsId || !dataInicio || !dataFim) return;

  const tipoAus = await tx.tipoAusencia.findFirst({
    where: { OR: [{ codigo: "AFA" }, { codigo: "AF" }] },
    select: { idTipoAusencia: true },
    orderBy: { codigo: "asc" },
  });
  if (!tipoAus) return;

  const di = new Date(dataInicio);
  const df = new Date(dataFim);
  const inicio = new Date(Date.UTC(di.getUTCFullYear(), di.getUTCMonth(), di.getUTCDate()));
  const fim    = new Date(Date.UTC(df.getUTCFullYear(), df.getUTCMonth(), df.getUTCDate()));

  for (
    let cur = new Date(inicio);
    cur.getTime() <= fim.getTime();
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1))
  ) {
    const dataRef = new Date(cur);
    await tx.frequencia.upsert({
      where: { opsId_dataReferencia: { opsId, dataReferencia: dataRef } },
      update: {
        idTipoAusencia: tipoAus.idTipoAusencia,
        justificativa: "AUTO_AFASTAMENTO",
        manual: false,
        validado: true,
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipoAus.idTipoAusencia,
        justificativa: "AUTO_AFASTAMENTO",
        manual: false,
        validado: true,
      },
    });
  }
}

/**
 * Preenche os dias do mês de admissão ANTERIORES à dataAdmissao com NC no banco.
 * Exemplo: admitido em 05/06 → cria NC para 01/06, 02/06, 03/06, 04/06.
 * Usa skipDuplicates para não sobrescrever registros já existentes (ex: DSR).
 */
async function gerarNcPreAdmissao({ opsId, dataAdmissao, tx = prisma }) {
  if (!opsId || !dataAdmissao) return;

  const tipoNC = await tx.tipoAusencia.findFirst({
    where: { codigo: "NC" },
    select: { idTipoAusencia: true },
  });
  if (!tipoNC) return;

  const adm = new Date(dataAdmissao);
  const inicioMes = new Date(Date.UTC(adm.getUTCFullYear(), adm.getUTCMonth(), 1));
  // Dia anterior à admissão (exclusive)
  const ultimoDiaNC = new Date(Date.UTC(adm.getUTCFullYear(), adm.getUTCMonth(), adm.getUTCDate() - 1));

  if (inicioMes > ultimoDiaNC) return; // Admitido no dia 1 — sem dias anteriores

  const registros = [];
  for (
    let cur = new Date(inicioMes);
    cur <= ultimoDiaNC;
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1))
  ) {
    registros.push({
      opsId,
      dataReferencia: new Date(cur),
      idTipoAusencia: tipoNC.idTipoAusencia,
      manual: false,
      registradoPor: "SISTEMA_AUTO",
    });
  }

  if (!registros.length) return;

  await tx.frequencia.createMany({ data: registros, skipDuplicates: true });
}

module.exports = {
  gerarDSRBackfillColaborador,
  gerarDSRFuturoColaborador,
  gerarOnboardingColaborador,
  gerarFrequenciaDesligamento,
  gerarNcPreAdmissao,
  gerarFrequenciaAfastamento,
};
