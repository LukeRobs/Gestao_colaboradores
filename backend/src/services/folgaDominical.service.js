const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

const DSR_ID = 4;
const JUSTIFICATIVA_AUTO = "DSR_FOLGA_DOMINICAL_AUTOMATICA";

const MINIMO_POR_TURNO = {
  T1: 111,
  T2: 113,
  T3: 152,
};

// Máximo de domingos trabalhados seguidos: no 4º o colaborador precisa folgar.
// Ou seja, entre duas folgas dominicais passam no máximo 28 dias.
const MAX_DOMINGOS_TRABALHADOS = 3;
const INTERVALO_MAX_ENTRE_FOLGAS = (MAX_DOMINGOS_TRABALHADOS + 1) * 7;

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

function somarDias(data, dias) {
  const d = new Date(data);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

/**
 * Prazo da próxima folga dominical: o domingo em que o colaborador completaria
 * o 4º domingo trabalhado seguido (28 dias depois da última folga).
 * Sem folga anterior conhecida, vale o 4º domingo do período.
 */
function prazoProximaFolga(ultimaData, domingos) {
  if (ultimaData) return somarDias(ultimaData, INTERVALO_MAX_ENTRE_FOLGAS);
  return domingos[Math.min(MAX_DOMINGOS_TRABALHADOS, domingos.length - 1)];
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

  // Só o DSR dominical conta como folga (FO, BH e outras ausências não zeram a contagem)
  const idsFolga = new Set([DSR_ID]);

  const ultimosDSRRaw = await prisma.$queryRaw`
    SELECT DISTINCT ON ("ops_id")
      "ops_id",
      "data_referencia"
    FROM "frequencia"
    WHERE
      "ops_id" IN (${Prisma.join(opsIdsElegiveis)})
      AND "id_tipo_ausencia" IN (${Prisma.join([...idsFolga])})
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

  // Admitido há pouco e sem nenhuma folga dominical: conta os domingos
  // trabalhados a partir da admissão (o domingo anterior vale como "última folga")
  for (const c of elegiveis) {
    if (ultimaFolgaPorOpsId.has(c.opsId) || !c.dataAdmissao) continue;

    const admissao = new Date(c.dataAdmissao);
    const domingoAnterior = somarDias(admissao, -(admissao.getUTCDay() || 7));

    if (diffDias(primeiroDomingoMes, domingoAnterior) <= INTERVALO_MAX_ENTRE_FOLGAS) {
      ultimaFolgaPorOpsId.set(c.opsId, { opsId: c.opsId, dataDomingo: domingoAnterior });
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
        ...(estacaoId && { idEstacao: estacaoId }),
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
    idsFolga,
  };
}

/* =====================================================
   MOTOR DE PLANEJAMENTO
===================================================== */

// Folga que já existe no domingo e conta como a folga do ciclo (não é sobrescrita).
// Geração mensal: só o DSR manual; o DSR comum do domingo ainda pode ser substituído.
function folgaFixaMensal(idsFolga) {
  return (f) =>
    !!f.idTipoAusencia &&
    idsFolga.has(f.idTipoAusencia) &&
    (f.idTipoAusencia !== DSR_ID || Boolean(f.manual));
}

// Complemento: qualquer folga já lançada (inclusive as automáticas) é mantida.
function folgaFixaQualquer(idsFolga) {
  return (f) => !!f.idTipoAusencia && idsFolga.has(f.idTipoAusencia);
}
function montarPlanejamento({
  ano,
  mes,
  userId = null,
  domingos,
  elegiveis,
  freqMap,
  capacidade,
  ultimaFolgaPorOpsId,
  folgaFixa = () => false,
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

  if (!domingos.length) return { planejamentos, ignorados, naoAlocados };

  const isoDomingos = domingos.map((d) => isoDate(d));
  const ultimoDomingoIso = isoDomingos[isoDomingos.length - 1];

  for (const turno of ["T1", "T2", "T3"]) {
    const lista = elegiveisPorTurno[turno] || [];

    // Mais urgente primeiro: quem tem o prazo (4º domingo trabalhado) mais próximo
    const prazoIsoDe = (c) =>
      isoDate(prazoProximaFolga(ultimaFolgaPorOpsId.get(c.opsId)?.dataDomingo ?? null, domingos));
    lista.sort((a, b) => prazoIsoDe(a).localeCompare(prazoIsoDe(b)));

    for (const colab of lista) {
      const slotBase = getSlotFixoPorOpsId(colab.opsId);
      const ultimaFolgaAnterior = ultimaFolgaPorOpsId.get(colab.opsId) || null;
      let ultimaData = ultimaFolgaAnterior?.dataDomingo ?? null;

      const freqDe = (idx) => freqMap.get(`${colab.opsId}__${isoDomingos[idx]}`);
      const bloqueado = (idx, ignorarAusencia) => {
        const f = freqDe(idx);
        if (f?.manual) return true;
        // Bloqueia ausências que NÃO são DSR (atestados, férias, afastamentos etc.)
        // DSR semanal (id === DSR_ID) pode ser sobrescrito pelo dominical
        if (!ignorarAusencia && f?.idTipoAusencia && f.idTipoAusencia !== DSR_ID) return true;
        return false;
      };

      // Cada volta resolve a próxima folga obrigatória; em mês de 5 domingos
      // quem folga no 1º volta a precisar de folga no 5º (28 dias depois).
      for (let volta = 0; volta < domingos.length; volta++) {
        const prazo = prazoProximaFolga(ultimaData, domingos);
        const prazoIso = isoDate(prazo);
        if (prazoIso > ultimoDomingoIso) break; // não precisa de mais folga neste período

        const ultimaIso = ultimaData ? isoDate(ultimaData) : "";
        const janela = isoDomingos
          .map((iso, idx) => ({ iso, idx }))
          .filter((x) => x.iso > ultimaIso && x.iso <= prazoIso)
          .map((x) => x.idx);

        // Folga já lançada na janela (FO/BH, DSR manual...): zera a contagem de domingos trabalhados
        const fixa = janela.filter((idx) => {
          const f = freqDe(idx);
          return f && folgaFixa(f);
        });
        if (fixa.length) {
          ultimaData = domingos[fixa[fixa.length - 1]];
          continue;
        }

        // Ciclo fixo: 3 domingos trabalhados e o 4º de DSR, ou seja, a folga cai exatamente no prazo
        // (28 dias depois da anterior). Só sai disso se o domingo do prazo estiver bloqueado, e então
        // usa o domingo livre mais perto dele. Prazo já vencido (domingos anteriores já passaram):
        // primeiro domingo possível.
        const vencido = janela.length === 0;
        const ordenados = vencido
          ? isoDomingos.map((iso, idx) => ({ iso, idx })).filter((x) => x.iso > ultimaIso).map((x) => x.idx)
          : [...janela].reverse();

        let escolhido = ordenados.find((idx) => !bloqueado(idx, false));
        if (escolhido === undefined) escolhido = ordenados.find((idx) => !bloqueado(idx, true));
        let foraDoPrazo = false;

        if (escolhido === undefined) {
          escolhido = isoDomingos
            .map((iso, idx) => idx)
            .filter((idx) => isoDomingos[idx] > ultimaIso && !ordenados.includes(idx))
            .find((idx) => !bloqueado(idx, true));
          foraDoPrazo = escolhido !== undefined;
        }
        const forcado = escolhido !== undefined && !vencido && isoDomingos[escolhido] !== prazoIso;

        if (escolhido === undefined) {
          naoAlocados.push({
            opsId: colab.opsId,
            nomeCompleto: colab.nomeCompleto,
            turno,
            escala: colab.escala?.nomeEscala || null,
            slotBase: slotBase + 1,
            ultimaFolgaAnterior: ultimaData ? isoDate(ultimaData) : null,
            motivo: "Todos os domingos possuem frequência manual — impossível alocar.",
          });
          break;
        }

        const domingo = domingos[escolhido];
        const slotCapacidade = capacidade[turno][isoDomingos[escolhido]];

        planejamentos.push({
          opsId: colab.opsId,
          nomeCompleto: colab.nomeCompleto,
          turno,
          escala: colab.escala?.nomeEscala || null,
          ano,
          mes,
          dataDomingo: domingo,
          domingo: isoDomingos[escolhido],
          domingoIndex: escolhido,
          slotBase,
          slotEscolhido: escolhido + 1,
          criadoPorId: userId,
          ultimaFolgaAnterior: ultimaData ? isoDate(ultimaData) : null,
          diasDesdeUltimaFolga: ultimaData ? diffDias(domingo, ultimaData) : null,
          prazo: prazoIso,
          ...(forcado && { forcado: true }),
          ...(foraDoPrazo && { foraDoPrazo: true }),
        });

        if (slotCapacidade) {
          slotCapacidade.folgasPlanejadas += 1;
          slotCapacidade.saldoDisponivel = Math.max(0, slotCapacidade.saldoDisponivel - 1);
        }

        ultimaData = domingo;
      }
    }
  }

  return {
    planejamentos,
    ignorados,
    naoAlocados,
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
    idsFolga,
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
    folgaFixa: folgaFixaMensal(idsFolga),
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
    segundaFolga: planejamentos.length - new Set(planejamentos.map((p) => p.opsId)).size,
    forcadas: planejamentos.filter((p) => p.forcado).length,
    foraDoPrazo: planejamentos.filter((p) => p.foraDoPrazo).length,
    ignoradas: ignorados.length,
    naoAlocados: naoAlocados.length,
    totalAtivosTurno,
    minimoPorTurno: MINIMO_POR_TURNO,
    capacidade: resumoCapacidade,
  };
}

/* =====================================================
   GERAR FOLGA DOMINICAL — INCREMENTAL (COMPLEMENTAR)
   Preenche só quem é elegível AGORA e precisa de folga em domingo do mês
   (sem folga ainda, ou prestes a completar o 4º domingo trabalhado seguido),
   usando apenas domingos que ainda não passaram. Não apaga nem altera o
   que já foi gerado; as folgas existentes entram na conta de capacidade.
   Cobre quem mudou de escala, entrou ou passou a ser elegível depois da
   geração mensal.
===================================================== */
function hojeBrasilISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function gerarFolgaDominicalIncremental({ ano, mes, userId, estacaoId = null, simular = false }) {
  if (!ano || !mes) throw new Error("Ano e mês são obrigatórios.");
  if (!userId) throw new Error("Usuário não autenticado.");

  const {
    domingos,
    totalAtivosTurno,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId,
    idsFolga,
  } = await carregarContextoPlanejamento({ ano, mes, estacaoId });

  const hoje = hojeBrasilISO();
  const domingosFuturos = domingos.filter((d) => isoDate(d) >= hoje);

  if (!domingosFuturos.length) {
    return {
      modo: "incremental", ano, mes,
      domingos: 0, elegiveis: elegiveis.length, geradas: 0, naoAlocados: 0,
      mensagem: "Todos os domingos do mês já passaram; nada a complementar.",
    };
  }

  const jaTemFolga = new Set();
  const primeiroFuturoIso = isoDate(domingosFuturos[0]);
  // Última folga conhecida de cada um, incluindo as dos domingos do mês que já passaram
  const ultimaFolgaAtual = new Map(ultimaFolgaPorOpsId);

  for (const f of freqMap.values()) {
    if (f.idTipoAusencia && idsFolga.has(f.idTipoAusencia)) {
      jaTemFolga.add(f.opsId);
      const iso = isoDate(f.dataReferencia);
      const atual = ultimaFolgaAtual.get(f.opsId)?.dataDomingo;
      if (iso < primeiroFuturoIso && (!atual || iso > isoDate(atual))) {
        ultimaFolgaAtual.set(f.opsId, { opsId: f.opsId, dataDomingo: f.dataReferencia });
      }
    }

    // Folgas automáticas já geradas ocupam a capacidade do turno naquele domingo
    if (f.idTipoAusencia === DSR_ID && f.justificativa === JUSTIFICATIVA_AUTO) {
      const turno = getTurnoNome(f.colaborador?.turno);
      const slot = turno ? capacidade[turno]?.[isoDate(f.dataReferencia)] : null;
      if (slot) {
        slot.folgasPlanejadas += 1;
        slot.saldoDisponivel = Math.max(0, slot.saldoDisponivel - 1);
      }
    }
  }

  const semFolga = elegiveis.filter((c) => !jaTemFolga.has(c.opsId));

  const { planejamentos, naoAlocados } = montarPlanejamento({
    ano,
    mes,
    userId,
    domingos: domingosFuturos,
    elegiveis,
    freqMap,
    capacidade,
    ultimaFolgaPorOpsId: ultimaFolgaAtual,
    folgaFixa: folgaFixaQualquer(idsFolga),
  });

  if (!planejamentos.length && !naoAlocados.length) {
    return {
      modo: "incremental", ano, mes,
      domingos: domingosFuturos.length, elegiveis: elegiveis.length,
      semFolga: semFolga.length, geradas: 0, naoAlocados: 0,
      mensagem: "Todos os elegíveis já têm folga dentro do limite de 3 domingos trabalhados seguidos.",
    };
  }

  if (!simular) await processarPlanejamentosEmLotes(planejamentos, userId);

  // Quem foi (ou seria) alocado e em qual domingo — para a tela mostrar o detalhe
  const extras = planejamentos.length
    ? await prisma.colaborador.findMany({
        where: { opsId: { in: planejamentos.map((pl) => pl.opsId) } },
        select: { opsId: true, lider: { select: { nomeCompleto: true } }, setor: { select: { nomeSetor: true } } },
      })
    : [];
  const extraPorOps = new Map(extras.map((e) => [e.opsId, e]));

  const alocados = planejamentos
    .map((pl) => ({
      opsId: pl.opsId,
      nomeCompleto: pl.nomeCompleto,
      turno: pl.turno,
      escala: pl.escala,
      setor: extraPorOps.get(pl.opsId)?.setor?.nomeSetor ?? null,
      lider: extraPorOps.get(pl.opsId)?.lider?.nomeCompleto ?? null,
      domingo: pl.domingo, // AAAA-MM-DD
      forcado: Boolean(pl.forcado),
    }))
    .sort((a, b) => a.domingo.localeCompare(b.domingo) || a.nomeCompleto.localeCompare(b.nomeCompleto));

  return {
    modo: "incremental",
    simulacao: simular,
    alocados,
    ano,
    mes,
    domingos: domingosFuturos.length,
    elegiveis: elegiveis.length,
    semFolga: semFolga.length,
    geradas: planejamentos.length,
    naoAlocados: naoAlocados.length,
    detalheNaoAlocados: naoAlocados.map((n) => ({ opsId: n.opsId, nomeCompleto: n.nomeCompleto, motivo: n.motivo })),
    mensagem: simular
      ? `Simulação: ${planejamentos.length} folga(s) dominical(is) seriam geradas.`
      : `${planejamentos.length} folga(s) dominical(is) complementada(s).`,
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
    idsFolga,
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
    folgaFixa: folgaFixaMensal(idsFolga),
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
      prazo: item.prazo,
      forcado: Boolean(item.forcado),
    })),
  };
}

module.exports = {
  gerarFolgaDominical,
  gerarFolgaDominicalIncremental,
  listarFolgaDominical,
  deletarFolgaDominical,
  previewFolgaDominical,
};