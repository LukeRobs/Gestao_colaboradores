const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

const DSR_ID = 4;
const JUSTIFICATIVA_AUTO = "DSR_FOLGA_DOMINICAL_AUTOMATICA";

const MINIMO_POR_TURNO = {
  T1: 111,
  T2: 113,
  T3: 152,
};

// Distribuição percentual por domingo conforme qtd de domingos no mês
const PERCENTAGENS_POR_DOMINGOS = {
  5: [0.15, 0.15, 0.15, 0.275, 0.275],
  4: [0.15, 0.15, 0.35,  0.35],
};

/* =====================================================
   HELPERS
===================================================== */
const CHUNK_SIZE = 100;

async function processarPlanejamentosEmLotes(planejamentos, userId) {
  for (let i = 0; i < planejamentos.length; i += CHUNK_SIZE) {
    const chunk = planejamentos.slice(i, i + CHUNK_SIZE);

    console.log(
      `🚀 Lote ${Math.floor(i / CHUNK_SIZE) + 1} | Registros: ${chunk.length}`
    );

    await prisma.$transaction(
      chunk.map((item) =>
        prisma.frequencia.upsert({
          where: {
            opsId_dataReferencia: {
              opsId: item.opsId,
              dataReferencia: item.dataDomingo,
            },
          },
          update: {
            idTipoAusencia: DSR_ID,
            horaEntrada: null,
            horaSaida: null,
            justificativa: JUSTIFICATIVA_AUTO,
            registradoPor: userId,
            manual: false,
          },
          create: {
            opsId: item.opsId,
            dataReferencia: item.dataDomingo,
            idTipoAusencia: DSR_ID,
            justificativa: JUSTIFICATIVA_AUTO,
            registradoPor: userId,
            manual: false,
          },
        })
      ),
      {
        timeout: 20000, // proteção extra
      }
    );

    // evita stress no banco
    await new Promise((r) => setTimeout(r, 30));
  }
}

function getDomingosDoMes(ano, mes) {
  const domingos = [];
  const data = new Date(ano, mes - 1, 1);

  while (data.getMonth() === mes - 1) {
    if (data.getDay() === 0) {
      domingos.push(
        new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))
      );
    }
    data.setDate(data.getDate() + 1);
  }

  return domingos;
}

function isoDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Slot fixo do colaborador:
 * 0 => 1º domingo
 * 1 => 2º domingo
 * 2 => 3º domingo
 * 3 => 4º domingo
 */
function getSlotFixoPorOpsId(opsId) {
  return hashString(String(opsId)) % 4;
}

function getTurnoNome(turno) {
  const nome = turno?.nomeTurno || "";
  if (["T1", "T2", "T3"].includes(nome)) return nome;
  return null;
}

function inicializarMapaCapacidade(domingos) {
  const mapa = {};

  for (const turno of ["T1", "T2", "T3"]) {
    mapa[turno] = {};
    for (const domingo of domingos) {
      mapa[turno][isoDate(domingo)] = {
        capacidadeMaximaFolgas: 0,
        indisponibilidadesPrevias: 0,
        folgasPlanejadas: 0,
        saldoDisponivel: 0,
      };
    }
  }

  return mapa;
}

function diffDias(dataA, dataB) {
  const a = new Date(dataA);
  const b = new Date(dataB);

  a.setUTCHours(0, 0, 0, 0);
  b.setUTCHours(0, 0, 0, 0);

  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

function uniqueNumbers(arr) {
  return [...new Set(arr.filter((n) => Number.isInteger(n) && n >= 0))];
}

/**
 * Monta a ordem de preferência dos domingos para aquele colaborador.
 *
 * Regras:
 * - mantém slot base como referência principal
 * - se o mês tiver 5 domingos, pode usar o próximo domingo
 * - considera a última folga anterior para evitar:
 *   - intervalo MUITO curto
 *   - intervalo MUITO longo
 *
 * Janela ideal:
 * - < 14 dias => ruim
 * - ideal perto de 28 dias
 * - > 35 dias => começa a ficar ruim
 */
function construirIndicesPreferencia({ domingos, slotBase, ultimaFolga, capacidade, turno, }) {
  const totalDomingos = domingos.length;

  const indicesBase = uniqueNumbers([
    slotBase,
    totalDomingos >= 5 ? slotBase + 1 : null,
  ]).filter((idx) => idx < totalDomingos);

  if (!ultimaFolga?.dataDomingo) {
    // Sem folga anterior: tenta slot base primeiro, depois todos os outros como fallback
    const todosIndices = Array.from({ length: totalDomingos }, (_, i) => i);
    return uniqueNumbers([...indicesBase, ...todosIndices]);
  }

  const avaliados = domingos.map((domingo, idx) => {
    const diasDesdeUltimaFolga = diffDias(domingo, ultimaFolga.dataDomingo);

    let score = 0;

    // 1) penaliza intervalos curtos demais
    if (diasDesdeUltimaFolga < 14) {
      score += 1000 + (14 - diasDesdeUltimaFolga) * 20;
    }

    // 2) penaliza intervalos longos demais
    if (diasDesdeUltimaFolga > 35) {
      score += 250 + (diasDesdeUltimaFolga - 35) * 8;
    }

    // 3) prefere ficar perto da janela ideal de 28 dias
    score += Math.abs(diasDesdeUltimaFolga - 28);

    const ocupacao = capacidade[turno][isoDate(domingo)]?.folgasPlanejadas || 0;
    score += ocupacao * 3;

    // 4) favorece o slot base
    if (idx === slotBase) {
      score += 0;
    } else if (totalDomingos >= 5 && idx === slotBase + 1) {
      score += 15;
    } else {
      score += 50 + Math.abs(idx - slotBase) * 10;
    }

    return {
      idx,
      score,
    };
  });

  avaliados.sort((a, b) => a.score - b.score || a.idx - b.idx);

  return uniqueNumbers([
    ...avaliados.map((item) => item.idx),
    ...indicesBase,
  ]).filter((idx) => idx < totalDomingos);
}

function mapearUltimaFolgaAnterior(registros) {
  const mapa = new Map();

  for (const r of registros) {
    if (!mapa.has(r.opsId)) {
      mapa.set(r.opsId, r);
    }
  }

  return mapa;
}

/* =====================================================
   CONTEXTO DE PLANEJAMENTO
===================================================== */
async function carregarContextoPlanejamento({ ano, mes, estacaoId = null }) {
  if (!ano || !mes) throw new Error("Ano e mês são obrigatórios.");

  const domingos = getDomingosDoMes(ano, mes);

  if (!domingos.length) {
    throw new Error("Nenhum domingo encontrado para o mês informado.");
  }

  const primeiroDomingoMes = domingos[0];

  const estacaoFilter = estacaoId ? { idEstacao: estacaoId } : {};

  /* =====================================================
     1) TOTAL DE ATIVOS POR TURNO
  ===================================================== */
  const ativosPorTurno = await prisma.colaborador.findMany({
    where: {
      status: "ATIVO",
      ...estacaoFilter,
      turno: { nomeTurno: { in: ["T1", "T2", "T3"] } },
    },
    select: {
      opsId: true,
      turno: { select: { nomeTurno: true } },
    },
  });

  const totalAtivosTurno = {
    T1: 0,
    T2: 0,
    T3: 0,
  };

  for (const c of ativosPorTurno) {
    const turno = getTurnoNome(c.turno);
    if (turno) totalAtivosTurno[turno]++;
  }

  /* =====================================================
     2) ELEGÍVEIS (ESCALAS B, C, G | CARGOS ELEGÍVEIS)
  ===================================================== */
  const CARGOS_ELEGIVEIS = [
    "Auxiliar de Logística I",
    "Auxiliar de Logística I – PCD",
  ];

  const elegiveis = await prisma.colaborador.findMany({
    where: {
      status: "ATIVO",
      ...estacaoFilter,
      escala: {
        nomeEscala: { in: ["B", "C", "G"] },
        ativo: true,
      },
      turno: {
        nomeTurno: { in: ["T1", "T2", "T3"] },
      },
      cargo: {
        nomeCargo: { in: CARGOS_ELEGIVEIS },
      },
    },
    select: {
      opsId: true,
      nomeCompleto: true,
      dataAdmissao: true,
      turno: {
        select: {
          nomeTurno: true,
        },
      },
      escala: {
        select: {
          nomeEscala: true,
        },
      },
      cargo: {
        select: {
          nomeCargo: true,
        },
      },
    },
    orderBy: { opsId: "asc" },
  });

  if (!elegiveis.length) {
    throw new Error("Nenhum colaborador elegível encontrado.");
  }

  /* =====================================================
     3) ÚLTIMA FOLGA DOMINICAL ANTERIOR
        - usada para manter continuidade entre meses
  ===================================================== */
  const opsIdsElegiveis = elegiveis.map((c) => c.opsId);

  const ultimosDSRRaw = await prisma.$queryRaw`
    SELECT DISTINCT ON ("ops_id")
      "ops_id",
      "data_referencia"
    FROM "frequencia"
    WHERE 
      "ops_id" IN (${Prisma.join(opsIdsElegiveis)})
      AND "id_tipo_ausencia" = ${DSR_ID}
      AND "data_referencia" < ${primeiroDomingoMes}
      AND EXTRACT(DOW FROM "data_referencia") = 0
    ORDER BY "ops_id", "data_referencia" DESC
  `;

  const ultimaFolgaPorOpsId = new Map();

  for (const f of ultimosDSRRaw) {
    if (!ultimaFolgaPorOpsId.has(f.ops_id)) {
      ultimaFolgaPorOpsId.set(f.ops_id, {
        opsId: f.ops_id,
        dataDomingo: f.data_referencia,
      });
    }
  }

  /* =====================================================
     4) FREQUÊNCIAS JÁ EXISTENTES NOS DOMINGOS
        - usadas para:
          a) não sobrescrever manual / outras ausências
          b) reduzir capacidade do turno no domingo
  ===================================================== */
  const frequenciasDomingos = await prisma.frequencia.findMany({
    where: {
      dataReferencia: { in: domingos },
      colaborador: {
        status: "ATIVO",
        turno: {
          nomeTurno: { in: ["T1", "T2", "T3"] },
        },
      },
    },
    select: {
      opsId: true,
      dataReferencia: true,
      idTipoAusencia: true,
      justificativa: true,
      manual: true,
      colaborador: {
        select: {
          turno: {
            select: {
              nomeTurno: true,
            },
          },
        },
      },
    },
  });

  const freqMap = new Map();
  const capacidade = inicializarMapaCapacidade(domingos);

  for (const turno of ["T1", "T2", "T3"]) {
    const totalAtivos = totalAtivosTurno[turno];
    const minimo = MINIMO_POR_TURNO[turno];
    const maxFolgasBase = Math.max(0, totalAtivos - minimo);

    for (const domingo of domingos) {
      const chaveData = isoDate(domingo);
      capacidade[turno][chaveData].capacidadeMaximaFolgas = maxFolgasBase;
      capacidade[turno][chaveData].saldoDisponivel = maxFolgasBase;
    }
  }

  // Distribuição automática por percentagem baseada no total de elegíveis
  const totalElegiveis = elegiveis.length;
  const pcts = PERCENTAGENS_POR_DOMINGOS[domingos.length] || PERCENTAGENS_POR_DOMINGOS[4];
  const totalAtivosPresentes = ["T1", "T2", "T3"].reduce((s, t) => s + (totalAtivosTurno[t] || 0), 0);

  if (totalElegiveis > 0 && totalAtivosPresentes > 0) {
    // Calcula capacidade alvo por domingo com correção de arredondamento no último
    const targetsPorDomingo = domingos.map((_, idx) =>
      Math.round(totalElegiveis * (pcts[idx] ?? pcts[pcts.length - 1]))
    );
    const somaTargets = targetsPorDomingo.reduce((s, v) => s + v, 0);
    targetsPorDomingo[targetsPorDomingo.length - 1] += totalElegiveis - somaTargets;

    for (let dIdx = 0; dIdx < domingos.length; dIdx++) {
      const dataKey = isoDate(domingos[dIdx]);
      const targetTotal = targetsPorDomingo[dIdx];

      const turnosValidos = ["T1", "T2", "T3"].filter(t => capacidade[t]?.[dataKey] !== undefined);
      if (!turnosValidos.length) continue;

      const totalAtivosTurnos = turnosValidos.reduce((s, t) => s + (totalAtivosTurno[t] || 0), 0);
      if (totalAtivosTurnos === 0) continue;

      let remaining = targetTotal;
      for (let i = 0; i < turnosValidos.length; i++) {
        const t = turnosValidos[i];
        let share;
        if (i === turnosValidos.length - 1) {
          share = Math.max(0, remaining);
        } else {
          share = Math.round(targetTotal * (totalAtivosTurno[t] || 0) / totalAtivosTurnos);
          remaining -= share;
        }
        capacidade[t][dataKey].capacidadeMaximaFolgas = share;
        capacidade[t][dataKey].saldoDisponivel = share;
      }
    }
  }

  for (const f of frequenciasDomingos) {
    const chave = `${f.opsId}__${isoDate(f.dataReferencia)}`;
    freqMap.set(chave, f);

    const turno = getTurnoNome(f.colaborador?.turno);
    const dataKey = isoDate(f.dataReferencia);

    if (!turno || !capacidade[turno]?.[dataKey]) continue;

    // DSR semanal (idTipoAusencia === DSR_ID) pode ser sobrescrito — não conta como indisponibilidade
    const ehAusenciaPrevia =
      !!f.idTipoAusencia &&
      f.idTipoAusencia !== DSR_ID;

    if (ehAusenciaPrevia) {
      capacidade[turno][dataKey].indisponibilidadesPrevias += 1;
    }
  }

  for (const turno of ["T1", "T2", "T3"]) {
    for (const domingo of domingos) {
      const dataKey = isoDate(domingo);
      const item = capacidade[turno][dataKey];

      item.saldoDisponivel = Math.max(
        0,
        item.capacidadeMaximaFolgas - item.indisponibilidadesPrevias
      );
    }
  }

  return {
    domingos,
    totalAtivosTurno,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
  };
}

/* =====================================================
   MOTOR DE PLANEJAMENTO
===================================================== */
function montarPlanejamento({
  ano,
  mes,
  userId = null,
  domingos,
  elegiveis,
  freqMap,
  capacidade,
  ultimaFolgaPorOpsId,
}) {
  const elegiveisPorTurno = {
    T1: [],
    T2: [],
    T3: [],
  };

  for (const colab of elegiveis) {
    const turno = getTurnoNome(colab.turno);
    if (turno) elegiveisPorTurno[turno].push(colab);
  }

  const planejamentos = [];
  const ignorados = [];
  const naoAlocados = [];

  for (const turno of ["T1", "T2", "T3"]) {
    const lista = elegiveisPorTurno[turno] || [];

    // 🔥 ADICIONA ISSO
    lista.sort((a, b) => {
      const ultimaA = ultimaFolgaPorOpsId.get(a.opsId);
      const ultimaB = ultimaFolgaPorOpsId.get(b.opsId);

      const diasA = ultimaA?.dataDomingo
        ? diffDias(new Date(), ultimaA.dataDomingo)
        : 999;

      const diasB = ultimaB?.dataDomingo
        ? diffDias(new Date(), ultimaB.dataDomingo)
        : 999;

      return diasB - diasA; // 🔥 maior primeiro
    });

    for (const colab of lista) {
      const slotBase = getSlotFixoPorOpsId(colab.opsId);
      const ultimaFolga = ultimaFolgaPorOpsId.get(colab.opsId) || null;

      const indicesPreferencia = construirIndicesPreferencia({
        domingos,
        slotBase,
        ultimaFolga,
        capacidade,
        turno,
      });

      let alocado = false;
      let motivoNaoAlocado = null;

      for (const idxDomingo of indicesPreferencia) {
        const domingo = domingos[idxDomingo];
        if (!domingo) continue;

        const dataKey = isoDate(domingo);
        const freqKey = `${colab.opsId}__${dataKey}`;
        const freqExistente = freqMap.get(freqKey);

        const slotCapacidade = capacidade[turno][dataKey];
        if (!slotCapacidade || slotCapacidade.saldoDisponivel <= 0) {
          motivoNaoAlocado = `Sem capacidade no ${idxDomingo + 1}º domingo para o turno ${turno}.`;
          continue;
        }

        if (freqExistente?.manual) {
          motivoNaoAlocado = `Já existe frequência manual em ${dataKey}.`;
          continue;
        }

        // Bloqueia apenas ausências que NÃO são DSR (atestados, férias, afastamentos etc.)
        // DSR semanal (id === DSR_ID) pode ser sobrescrito pelo dominical
        if (
          freqExistente?.idTipoAusencia &&
          freqExistente.idTipoAusencia !== DSR_ID
        ) {
          motivoNaoAlocado = `Já existe ausência não elegível para substituição em ${dataKey}.`;
          continue;
        }

        planejamentos.push({
          opsId: colab.opsId,
          nomeCompleto: colab.nomeCompleto,
          turno,
          escala: colab.escala?.nomeEscala || null,
          ano,
          mes,
          dataDomingo: domingo,
          domingo: dataKey,
          domingoIndex: idxDomingo,
          slotBase,
          slotEscolhido: idxDomingo + 1,
          criadoPorId: userId,
          ultimaFolgaAnterior: ultimaFolga?.dataDomingo
            ? isoDate(ultimaFolga.dataDomingo)
            : null,
          diasDesdeUltimaFolga: ultimaFolga?.dataDomingo
            ? diffDias(domingo, ultimaFolga.dataDomingo)
            : null,
        });

        slotCapacidade.folgasPlanejadas += 1;
        slotCapacidade.saldoDisponivel -= 1;

        alocado = true;
        break;
      }

      if (!alocado) {
        naoAlocados.push({
          colab,
          turno,
          slotBase,
          ultimaFolga: ultimaFolga || null,
          motivo: motivoNaoAlocado || "Não foi possível alocar em domingo válido.",
        });
      }
    }
  }

  // ─── SEGUNDA PASSAGEM: força alocação dos não-alocados ───────────────────
  // Ignora saldo e ausências não-DSR; respeita apenas manual=true
  const aindaNaoAlocados = [];

  for (const item of naoAlocados) {
    const { colab, turno, slotBase, ultimaFolga } = item;

    // Ordena domingos pela menor ocupação (melhor domingo primeiro)
    const domingosPorOcupacao = domingos
      .map((d, idx) => ({ idx, ocupacao: capacidade[turno][isoDate(d)]?.folgasPlanejadas || 0 }))
      .sort((a, b) => a.ocupacao - b.ocupacao);

    let alocado = false;

    for (const { idx: idxDomingo } of domingosPorOcupacao) {
      const domingo = domingos[idxDomingo];
      if (!domingo) continue;

      const dataKey = isoDate(domingo);
      const freqKey = `${colab.opsId}__${dataKey}`;
      const freqExistente = freqMap.get(freqKey);

      // Único bloqueio respeitado na força: frequência manual
      if (freqExistente?.manual) continue;

      planejamentos.push({
        opsId: colab.opsId,
        nomeCompleto: colab.nomeCompleto,
        turno,
        escala: colab.escala?.nomeEscala || null,
        ano,
        mes,
        dataDomingo: domingo,
        domingo: dataKey,
        domingoIndex: idxDomingo,
        slotBase,
        slotEscolhido: idxDomingo + 1,
        criadoPorId: userId,
        ultimaFolgaAnterior: ultimaFolga?.dataDomingo
          ? isoDate(ultimaFolga.dataDomingo)
          : null,
        diasDesdeUltimaFolga: ultimaFolga?.dataDomingo
          ? diffDias(domingo, ultimaFolga.dataDomingo)
          : null,
        forcado: true,
      });

      capacidade[turno][dataKey].folgasPlanejadas += 1;
      alocado = true;
      break;
    }

    if (!alocado) {
      aindaNaoAlocados.push({
        opsId: colab.opsId,
        nomeCompleto: colab.nomeCompleto,
        turno,
        escala: colab.escala?.nomeEscala || null,
        slotBase: slotBase + 1,
        ultimaFolgaAnterior: ultimaFolga?.dataDomingo
          ? isoDate(ultimaFolga.dataDomingo)
          : null,
        motivo: "Todos os domingos possuem frequência manual — impossível alocar.",
      });
    }
  }

  return {
    planejamentos,
    ignorados,
    naoAlocados: aindaNaoAlocados,
  };
}

/* =====================================================
   GERAR FOLGA DOMINICAL
===================================================== */
async function gerarFolgaDominical({ ano, mes, userId, estacaoId = null }) {
  if (!ano || !mes) throw new Error("Ano e mês são obrigatórios.");
  if (!userId) throw new Error("Usuário não autenticado.");

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  const count = await prisma.frequencia.count({
    where: {
      idTipoAusencia: DSR_ID,
      justificativa: JUSTIFICATIVA_AUTO,
      dataReferencia: { gte: inicio, lte: fim },
      ...(estacaoId && { colaborador: { idEstacao: estacaoId } }),
    },
  });

  if (count > 0) {
    throw new Error("Já existe planejamento para este mês.");
  }

  const {
    domingos,
    totalAtivosTurno,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
  } = await carregarContextoPlanejamento({ ano, mes, estacaoId });

  const {
    planejamentos,
    ignorados,
    naoAlocados,
  } = montarPlanejamento({
    ano,
    mes,
    userId,
    domingos,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
  });

  if (naoAlocados.length > 0) {
    console.warn(`⚠️ ${naoAlocados.length} colaborador(es) não alocado(s) — indisponibilidades nos domingos disponíveis.`);
  }

  console.log("TOTAL PLANEJAMENTOS:", planejamentos.length);

  await processarPlanejamentosEmLotes(planejamentos, userId);

  const resumoCapacidade = {};
  for (const turno of ["T1", "T2", "T3"]) {
    resumoCapacidade[turno] = {};
    for (const domingo of domingos) {
      const dataKey = isoDate(domingo);
      resumoCapacidade[turno][dataKey] = capacidade[turno][dataKey];
    }
  }
  return {
    ano,
    mes,
    domingos: domingos.length,
    elegiveis: elegiveis.length,
    geradas: planejamentos.length,
    ignoradas: ignorados.length,
    naoAlocados: naoAlocados.length,
    totalAtivosTurno,
    minimoPorTurno: MINIMO_POR_TURNO,
    capacidade: resumoCapacidade,
  };
}

/* =====================================================
   LISTAR FOLGA DOMINICAL
===================================================== */
async function listarFolgaDominical({ ano, mes, estacaoId = null }) {
  if (!ano || !mes) {
    throw new Error("Ano e mês são obrigatórios.");
  }

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  const registros = await prisma.frequencia.findMany({
    where: {
      idTipoAusencia: DSR_ID,
      justificativa: JUSTIFICATIVA_AUTO,
      dataReferencia: {
        gte: inicio,
        lte: fim,
      },
      colaborador: {
        status: "ATIVO",
        ...(estacaoId && { idEstacao: estacaoId }),
      },
    },
    include: {
      colaborador: {
        include: {
          turno: true,
          setor: true,
          lider: true,
          escala: true,
        },
      },
    },
    orderBy: [
      { dataReferencia: "asc" },
      { opsId: "asc" },
    ],
  });

  if (!registros.length) {
    return null;
  }

  const resumoPorDomingo = {};
  const resumoPorTurnoEDomingo = {};
  const totalColaboradores = new Set(
      registros.map(r => r.colaborador.opsId)
    ).size;

  for (const r of registros) {
    const data = isoDate(r.dataReferencia);
    const turno = r.colaborador?.turno?.nomeTurno || "SEM_TURNO";

    if (!resumoPorDomingo[data]) resumoPorDomingo[data] = 0;
    resumoPorDomingo[data]++;

    if (!resumoPorTurnoEDomingo[turno]) {
      resumoPorTurnoEDomingo[turno] = {};
    }
    if (!resumoPorTurnoEDomingo[turno][data]) {
      resumoPorTurnoEDomingo[turno][data] = 0;
    }

    resumoPorTurnoEDomingo[turno][data]++;
  }

  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() - 90);

  const opsIdsElegiveis = [...new Set(registros.map(r => r.colaborador.opsId))];

  if (!opsIdsElegiveis.length) {
    return null;
  }

  const ultimosDSRRaw = await prisma.$queryRaw`
    SELECT DISTINCT ON ("ops_id")
      "ops_id",
      "data_referencia"
    FROM "frequencia"
    WHERE 
      "ops_id" IN (${Prisma.join(opsIdsElegiveis)})
      AND "id_tipo_ausencia" = ${DSR_ID}
      AND "data_referencia" < ${inicio}
      AND EXTRACT(DOW FROM "data_referencia") = 0
    ORDER BY "ops_id", "data_referencia" DESC
  `;

  // 🔥 MAPA FINAL (último domingo por colaborador)
  const ultimoDSRMap = new Map();

  for (const f of ultimosDSRRaw) {
    if (!ultimoDSRMap.has(f.ops_id)) {
      ultimoDSRMap.set(f.ops_id, f.data_referencia);
    }
  }

  // 🔥 MONTAR RESPOSTA
  const colaboradores = registros.map((r) => {
    const ultimoDSRRaw = ultimoDSRMap.get(r.colaborador.opsId) || null;

    const ultimoDSR = ultimoDSRRaw
      ? isoDate(ultimoDSRRaw)
      : null;

    const diasSemDSR = ultimoDSR
    ? Math.floor(
        (new Date() - new Date(ultimoDSR)) / (1000 * 60 * 60 * 24)
      )
    : null;
    
    return {
      opsId: r.colaborador.opsId,
      nome: r.colaborador.nomeCompleto,
      turno: r.colaborador.turno?.nomeTurno || null,
      escala: r.colaborador.escala?.nomeEscala || null,
      lider: r.colaborador.lider?.nomeCompleto || null,
      setor: r.colaborador.setor?.nomeSetor || null,
      dataDomingo: r.dataReferencia,

      // 🔥 NOVO
      ultimoDSR,
      diasSemDSR,
    };
  });

  return {
    ano,
    mes,
    total: totalColaboradores,
    porDomingo: resumoPorDomingo,
    porTurnoEDomingo: resumoPorTurnoEDomingo,
    colaboradores,
  };
}

/* =====================================================
   DELETAR FOLGA DOMINICAL
===================================================== */
async function deletarFolgaDominical({ ano, mes, estacaoId = null }) {
  if (!ano || !mes) throw new Error("Ano e mês são obrigatórios.");

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  const result = await prisma.frequencia.updateMany({
    where: {
      idTipoAusencia: DSR_ID,
      justificativa: JUSTIFICATIVA_AUTO,
      dataReferencia: { gte: inicio, lte: fim },
      ...(estacaoId && { colaborador: { idEstacao: estacaoId } }),
    },
    data: {
      idTipoAusencia: null,
      justificativa: null,
      registradoPor: null,
      manual: false,
      horaEntrada: null,
      horaSaida: null,
    },
  });

  return {
    removidos: result.count,
  };
}

/* =====================================================
   PREVIEW FOLGA DOMINICAL
===================================================== */
async function previewFolgaDominical({ ano, mes, estacaoId = null }) {
  if (!ano || !mes) throw new Error("Ano e mês são obrigatórios.");

  const {
    domingos,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
  } = await carregarContextoPlanejamento({ ano, mes, estacaoId });

  const {
    planejamentos,
    naoAlocados,
  } = montarPlanejamento({
    ano,
    mes,
    domingos,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
  });

  return {
    ano,
    mes,
    domingos: domingos.map((d) => isoDate(d)),
    totalElegiveis: elegiveis.length,
    totalPreview: planejamentos.length,
    naoAlocados,
    capacidade,
    preview: planejamentos.map((item) => ({
      opsId: item.opsId,
      nome: item.nomeCompleto,
      turno: item.turno,
      escala: item.escala,
      domingo: item.domingo,
      slot: item.slotEscolhido,
      slotBase: item.slotBase + 1,
      ultimaFolgaAnterior: item.ultimaFolgaAnterior,
      diasDesdeUltimaFolga: item.diasDesdeUltimaFolga,
    })),
  };
}

module.exports = {
  gerarFolgaDominical,
  listarFolgaDominical,
  deletarFolgaDominical,
  previewFolgaDominical,
};