const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getDateOperacional } = require("../utils/dateOperacional");
const { buscarDwPlanejado } = require("../services/googleSheetsDW.service");

/* =====================================================
   ⏰ TIMEZONE FIXO — BRASIL
===================================================== */
function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}

/* =====================================================
   HELPERS
===================================================== */
const normalize = (v) => String(v || "").trim();

const normalizeTurno = (t) => {
  const v = normalize(t).toUpperCase();
  if (v.includes("T1")) return "T1";
  if (v.includes("T2")) return "T2";
  if (v.includes("T3")) return "T3";
  return "Sem turno";
};

/* =====================================================
   ⏳ TEMPO DE CASA
===================================================== */
function calcularTempoDeCasa(dataAdmissao) {
  if (!dataAdmissao) {
    return {
      faixa: "-",
      dias: 0,
    };
  }

  const hoje = agoraBrasil();
  const adm = new Date(dataAdmissao);

  const diffMs = hoje - adm;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let faixa = "-";

  if (dias <= 30) faixa = "0 a 30 Dias";
  else if (dias <= 90) faixa = "1 a 3 meses";
  else if (dias <= 180) faixa = "3 a 6 meses";
  else if (dias <= 360) faixa = "6 a 12 meses";
  else if (dias <= 720) faixa = "1 a 2 anos";
  else faixa = "2 anos +";

  return {
    faixa,
    dias,
  };
}

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const daysInclusive = (inicio, fim) => {
  const a = new Date(inicio);
  const b = new Date(fim);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / 86400000) + 1;
};

function isCargoElegivel(cargo) {
  const nome = String(cargo || "").toUpperCase();
  // Exclui PCD da contagem
  if (nome.includes("PCD")) {
    return false;
  }
  return (
    nome.includes("AUXILIAR DE LOGÍSTICA I") ||
    nome.includes("AUXILIAR DE LOGÍSTICA II")
  );
}

function getSetor(registro, colaborador) {
  return (
    normalize(registro?.setor?.nomeSetor) ||
    normalize(colaborador?.setor?.nomeSetor) ||
    "Sem setor"
  );
}

const initTurnoMap = () => ({
  T1: {},
  T2: {},
  T3: {},
  "Sem turno": {},
});

/* =====================================================
   STATUS DO DIA — PADRÃO ADMIN (COM 4 ESTADOS OPERACIONAIS)
===================================================== */
function getStatusDoDiaOperacional(f) {
  // DSR/FO têm prioridade máxima — mesmo que haja horaEntrada (ajuste indevido),
  // o dia de folga não deve ser contado como escalado
  if (f?.tipoAusencia) {
    const codigo = String(f.tipoAusencia.codigo || "").toUpperCase();

    if (codigo === "DSR" || codigo === "FO") {
      return { label: "Folga", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }
  }

  // Presença via batida de ponto
  if (f?.horaEntrada) {
    return {
      label: "Presente",
      contaComoEscalado: true,
      impactaAbsenteismo: false,
      origem: "horaEntrada",
    };
  }

  // Ausência registrada (tipoAusencia)
  if (f?.tipoAusencia) {
    const codigo = String(f.tipoAusencia.codigo || "").toUpperCase();

    switch (codigo) {
      // Presença sem batida de ponto (ex: ajuste manual)
      case "P":
        return { label: "Presente", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };

      // Não escalado / fora do HC
      case "NC":
        return { label: "Não contratado", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "ON":
        return { label: "Onboarding", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "T":
        return { label: "Transferido", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };

      // Afastamentos / licenças — escalado mas não impacta absenteísmo operacional
      case "FE":
        return { label: "Férias", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "AFA":
      case "AF":
        return { label: "Afastamento", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "LM":
        return { label: "Licença Maternidade", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "LP":
        return { label: "Licença Paternidade", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "S1":
        return { label: "Sinergia Enviada", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "BH":
        return { label: "Banco de Horas", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };

      // Ausências que impactam absenteísmo
      case "AM":
      case "AA":
        return { label: "Atestado Médico", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };
      case "F":
        return { label: "Falta", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };

      // Qualquer código desconhecido — não conta como escalado para não inflar métricas
      default:
        return { label: "Outro", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }
  }

  // Sem registro no banco — falta real
  return {
    label: "Falta",
    contaComoEscalado: true,
    impactaAbsenteismo: true,
    origem: "semRegistro",
  };
}

/**
 * Retorna true se o registro existe no banco mas está "vazio"
 * (sem tipoAusencia e sem horaEntrada) — não deve ser contabilizado como falta.
 */
function isRegistroVazio(f) {
  return f && !f.horaEntrada && !f.tipoAusencia;
}

/* =====================================================
   CONTROLLER
===================================================== */
const carregarDashboard = async (req, res) => {
  try {
    /* ===============================
       1️⃣ FILTROS DE DATA
    =============================== */
    const { data, dataInicio, dataFim, turno: turnoFiltro } = req.query;

    const agora = agoraBrasil();
    const { dataOperacional, dataOperacionalStr, turnoAtual } =
      getDateOperacional(agora);

    /* ===============================
       🚫 GUARD T3 — turno ainda não começou
       T3 começa às 22h e termina às 06h do dia seguinte.
       Se o usuário filtrou por T3 e a hora atual está fora desse
       range (06:00–21:59) e não foi passada uma data específica,
       o turno ainda não iniciou: retorna zeros.
    =============================== */
    const horaAtual = agora.getHours();
    const t3EmAndamento = horaAtual >= 22 || horaAtual < 7; // 22h–06:20 (margem até 06:59)
    const t3AindaNaoComecou =
      turnoFiltro === "T3" &&
      !data && !dataInicio && !dataFim &&
      !t3EmAndamento;

    if (t3AindaNaoComecou) {
      return res.json({
        success: true,
        data: {
          dataOperacional: dataOperacionalStr,
          turnoAtual,
          periodo: { inicio: dataOperacionalStr, fim: dataOperacionalStr },
          kpis: {
            totalColaboradores: 0,
            presentes: 0,
            ausencias: 0,
            diaristasPlanejados: 0,
            diaristasPresentes: 0,
            aderenciaDW: 0,
            absenteismo: 0,
          },
          distribuicaoTurnoSetor: [],
          generoPorTurno: { T1: [], T2: [], T3: [] },
          statusColaboradoresPorTurno: { T1: [], T2: [], T3: [] },
          empresaPorTurno: { T1: [], T2: [], T3: [] },
          distribuicaoVinculoPorTurno: {
            T1: [{ name: "SPX", value: 0 }, { name: "BPO", value: 0 }],
            T2: [{ name: "SPX", value: 0 }, { name: "BPO", value: 0 }],
            T3: [{ name: "SPX", value: 0 }, { name: "BPO", value: 0 }],
          },
          ausenciasHoje: [],
          tendenciaPorDia: [],
          turnos: [],
          escalasAtivas: [],
        },
      });
    }

    /* ===============================
       📅 RANGE DE DATA (SEGURO)
    =============================== */
    let inicio;
    let fim;

    if (dataInicio && dataFim) {
      inicio = new Date(`${dataInicio}T00:00:00.000Z`);
      fim = new Date(`${dataFim}T23:59:59.999Z`);
    } else if (data) {
      inicio = new Date(`${data}T00:00:00.000Z`);
      fim = new Date(`${data}T23:59:59.999Z`);
    } else {
      const base = new Date(dataOperacional).toISOString().slice(0, 10);
      inicio = new Date(`${base}T00:00:00.000Z`);
      fim = new Date(`${base}T23:59:59.999Z`);
    }

    const dataSnapshotStr = isoDate(fim);

    /* ===============================
       2️⃣ QUERIES
    =============================== */
    const [colaboradores, empresas, turnos, escalasAtivas, frequenciasPeriodo] =
      await Promise.all([
        prisma.colaborador.findMany({
          where: {
            status: "ATIVO",
            dataDesligamento: null,
            ...(!req.dbContext?.isGlobal && req.dbContext?.estacaoId
              ? { idEstacao: req.dbContext.estacaoId }
              : {}),
          },
          include: {
            empresa: true,
            turno: true,
            setor: true,
            escala: true,
            cargo: true,
            lider: true,
          },
        }),

        prisma.empresa.findMany(),
        prisma.turno.findMany(),
        prisma.escala.findMany({ where: { ativo: true } }),

        prisma.frequencia.findMany({
          where: {
            dataReferencia: {
              gte: inicio,
              lte: fim,
            },
            colaborador: {
              status: "ATIVO",
              dataDesligamento: null,
              ...(!req.dbContext?.isGlobal && req.dbContext?.estacaoId
                ? { idEstacao: req.dbContext.estacaoId }
                : {}),
            },
          },
          include: {
            colaborador: { include: { turno: true, setor: true } },
            tipoAusencia: true,
            setor: true,
          },
          orderBy: { dataReferencia: "asc" },
        }),
      ]);
    /* ===============================
      DISTRIBUIÇÃO COLABORADORES — SPX vs BPO
    =============================== */
    let totalSPX = 0;
    let totalBPO = 0;

    colaboradores.forEach((c) => {
      if (c.status !== "ATIVO") return;

      const empresa = normalize(c.empresa?.razaoSocial).toUpperCase();

      // ajuste se o nome for diferente no seu banco
      if (empresa.includes("SHOPEE") || empresa.includes("SPX")) {
        totalSPX++;
      } else {
        totalBPO++;
      }
    });
  
    /* ===============================
       3️⃣ MAPA DE FREQUÊNCIAS (por opsId)
    =============================== */
    const freqMap = new Map();
    frequenciasPeriodo.forEach((f) => {
      if (!freqMap.has(f.opsId)) freqMap.set(f.opsId, []);
      freqMap.get(f.opsId).push(f);
    });

    /* ===============================
       4️⃣ AGREGADORES
    =============================== */
    const turnoSetorAgg = {};
    const generoPorTurno = initTurnoMap();
    const statusPorTurno = initTurnoMap();
    const empresaPorTurno = initTurnoMap();
    const ausenciasHoje = [];
    const tendenciaPorDia = {}; // { data: { presentes, ausentes, escalados } }

    const distribuicaoVinculoPorTurno = {
      T1: { SPX: 0, BPO: 0 },
      T2: { SPX: 0, BPO: 0 },
      T3: { SPX: 0, BPO: 0 },
    };
    colaboradores.forEach((c) => {
      if (c.status !== "ATIVO") return;
      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;

      const turno = normalizeTurno(c.turno?.nomeTurno);
      if (turno === "Sem turno") return;

      const empresa = normalize(c.empresa?.razaoSocial).toUpperCase();

      if (empresa.includes("SHOPEE") || empresa.includes("SPX")) {
        distribuicaoVinculoPorTurno[turno].SPX += 1;
      } else {
        distribuicaoVinculoPorTurno[turno].BPO += 1;
      }
    });
    
    /* ===============================
       5️⃣ LOOP PRINCIPAL (ALINHADO AO ADMIN)
    =============================== */
    colaboradores.forEach((c) => {
      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;

      const turno = normalizeTurno(c.turno?.nomeTurno);
      if (turno === "Sem turno") return;
      if (turnoFiltro && turno !== turnoFiltro) return;

      const genero = normalize(c.genero) || "N/I";
      const empresa = normalize(c.empresa?.razaoSocial) || "Sem empresa";

      const registros = freqMap.get(c.opsId) || [];

      /* ========= 5.1 TENDÊNCIA (por dia, com escalados/dias esperados) ========= */
      registros.forEach((reg) => {
        const dataRef = isoDate(reg.dataReferencia);
        if (!dataRef) return;

        const s = getStatusDoDiaOperacional(reg);

        if (!tendenciaPorDia[dataRef]) {
          tendenciaPorDia[dataRef] = {
            data: dataRef,
            presentes: 0,
            ausentes: 0,
            escalados: 0,
          };
        }

        // só conta dias em que estava escalado (FO/DSR fora)
        // e respeita filtro de turno para não misturar T1/T2/T3
        if (s.contaComoEscalado) {
          tendenciaPorDia[dataRef].escalados++;

          if (s.label === "Presente") {
            tendenciaPorDia[dataRef].presentes++;
          } else if (s.impactaAbsenteismo) {
            // Falta / Atestado Médico
            tendenciaPorDia[dataRef].ausentes++;
          }
        }
      });

      /* ========= 5.2 SNAPSHOT (dia fim) ========= */
      const registroSnapshot =
        registros.find((r) => isoDate(r.dataReferencia) === dataSnapshotStr) ||
        null;

      // Igual ao Admin: se não tem frequência no dia, ele não entra no snapshot do dia
      // (evita inventar escalado sem base)
      if (!registroSnapshot) return;

      // Registro existe mas está vazio (sem tipo e sem hora) — trata como sem lançamento
      if (isRegistroVazio(registroSnapshot)) return;

      // 🔒 GUARD T3: colaboradores do T3 só devem ser contados se a horaEntrada
      // for compatível com o horário do T3 (≥ 20:50 ou < 06:20).
      // Isso evita que registros de ajuste manual ou batidas fora do horário
      // do T3 inflem a contagem de presentes.
      if (turno === "T3" && registroSnapshot.horaEntrada) {
        const h = new Date(registroSnapshot.horaEntrada).getUTCHours();
        const m = new Date(registroSnapshot.horaEntrada).getUTCMinutes();
        const minutos = h * 60 + m;
        const T3_INICIO = 20 * 60 + 50; // 20:50
        const T3_FIM = 6 * 60 + 20;     // 06:20
        const dentroDoT3 = minutos >= T3_INICIO || minutos < T3_FIM;
        if (!dentroDoT3) return;
      }

      const sSnap = getStatusDoDiaOperacional(registroSnapshot);

      // Só entra na base do dia se estava escalado (FO/DSR fora)
      if (!sSnap.contaComoEscalado) return;

      if (!turnoSetorAgg[turno]) {
        turnoSetorAgg[turno] = {
          turno,
          totalEscalados: 0,
          presentes: 0,
          ausentes: 0,
          setores: {},
        };
      }

      turnoSetorAgg[turno].totalEscalados++;

      generoPorTurno[turno][genero] =
        (generoPorTurno[turno][genero] || 0) + 1;

      if (!empresaPorTurno[turno][empresa]) {
        empresaPorTurno[turno][empresa] = { total: 0, ausencias: 0, faltas: 0, atestados: 0 };
      }

      empresaPorTurno[turno][empresa].total += 1;

      // Se for ausência que impacta (Falta / Atestado)
      if (sSnap.impactaAbsenteismo) {
        empresaPorTurno[turno][empresa].ausencias += 1;

        // Conta atestado separado
        if (sSnap.label === "Atestado Médico") {
          empresaPorTurno[turno][empresa].atestados += 1;
        }
        else if (sSnap.label === "Falta") {
          empresaPorTurno[turno][empresa].faltas += 1;
        }
      }

      const setor = getSetor(registroSnapshot, c);
      turnoSetorAgg[turno].setores[setor] =
        (turnoSetorAgg[turno].setores[setor] || 0) + 1;
      const tempoCasa = calcularTempoDeCasa(c.dataAdmissao);
      // Status do snapshot (4 estados)
      statusPorTurno[turno][sSnap.label] =
        (statusPorTurno[turno][sSnap.label] || 0) + 1;

      if (sSnap.label === "Presente") {
        turnoSetorAgg[turno].presentes++;
      } else if (sSnap.impactaAbsenteismo) {
        turnoSetorAgg[turno].ausentes++;  

        // Lista de ausências do dia (Falta / Atestado)
        ausenciasHoje.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          turno,
          motivo: sSnap.label, // "Falta" | "Atestado Médico"
          setor: normalize(c.setor?.nomeSetor),
          empresa: normalize(c.empresa?.razaoSocial),
          admissao: c.dataAdmissao,
          lider: normalize(c.lider?.nomeCompleto),
          origem: sSnap.origem,
          tempoCasa: tempoCasa.faixa,
          diasCasa: tempoCasa.dias,
        });
      }
    });

    /* ===============================
       6️⃣ KPIs (absenteísmo no período igual Admin)
    =============================== */
    let totalHcAptoDias = 0;
    let totalAusenciasDias = 0;

    frequenciasPeriodo.forEach((f) => {
      const c = colaboradores.find(col => col.opsId === f.opsId);
      if (!c) return;

      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;

      const turnoColab = normalizeTurno(c.turno?.nomeTurno);
      if (turnoFiltro && turnoColab !== turnoFiltro) return;

      const s = getStatusDoDiaOperacional(f);

      // HC APTO por dia
      if (s.contaComoEscalado) {
        totalHcAptoDias++;
      }

      // AUSÊNCIAS por dia (F, FJ, AM)
      if (s.impactaAbsenteismo) {
        totalAusenciasDias++;
      }
    });

    const absenteismoPeriodo =
      totalHcAptoDias > 0
        ? Number(((totalAusenciasDias / totalHcAptoDias) * 100).toFixed(2))
        : 0;


/* ===============================
   7️⃣ DIARISTAS PRESENTES (REAIS)
=============================== */
const diaristasPresentes = { T1: 0, T2: 0, T3: 0 };

await Promise.all(
  ["T1", "T2", "T3"].map(async (turno) => {
    try {
      const turnoId =
        turno === "T1" ? 1 :
        turno === "T2" ? 2 : 3;

      const diaristasReais = await prisma.dwReal.findMany({
        where: {
          data: new Date(dataSnapshotStr),
          idTurno: turnoId,
        },
      });

      diaristasPresentes[turno] = diaristasReais.reduce(
        (total, dw) => total + Number(dw.quantidade || 0),
        0
      );
    } catch (error) {
      console.warn(
        `⚠️ Erro ao buscar diaristas presentes para ${turno}:`,
        error.message
      );
      diaristasPresentes[turno] = 0;
    }
  })
);

/* ===============================
   7️⃣.1 DIARISTAS PLANEJADOS (Sheets)
=============================== */
const diaristasPlanejadosPorTurno = { T1: 0, T2: 0, T3: 0 };

for (const turno of ["T1", "T2", "T3"]) {
  try {
    const resultado = await buscarDwPlanejado(turno, dataSnapshotStr);

    // 🔥 ÚNICA FONTE VÁLIDA
    diaristasPlanejadosPorTurno[turno] = Number(
      resultado?.data?.dwPlanejado || 0
    );
  } catch (err) {
    console.warn(`⚠️ DW Planejado falhou para ${turno}:`, err.message);
    diaristasPlanejadosPorTurno[turno] = 0;
  }
}

console.log("📌 diaristasPlanejadosPorTurno:", diaristasPlanejadosPorTurno);

/* ===============================
   7️⃣.2 KPIs DIARISTAS (TOTAIS)
=============================== */
const totalDiaristasPlanejados = Object.values(
  diaristasPlanejadosPorTurno
).reduce((a, b) => a + b, 0);

const totalDiaristasPresentes = Object.values(
  diaristasPresentes
).reduce((a, b) => a + b, 0);

/* ===============================
   7️⃣.3 ADERÊNCIA DW
=============================== */
const aderenciaDwPorTurno = {
  T1:
    diaristasPlanejadosPorTurno.T1 > 0
      ? Number(
          (
            (diaristasPresentes.T1 /
              diaristasPlanejadosPorTurno.T1) *
            100
          ).toFixed(2)
        )
      : 0,

  T2:
    diaristasPlanejadosPorTurno.T2 > 0
      ? Number(
          (
            (diaristasPresentes.T2 /
              diaristasPlanejadosPorTurno.T2) *
            100
          ).toFixed(2)
        )
      : 0,

  T3:
    diaristasPlanejadosPorTurno.T3 > 0
      ? Number(
          (
            (diaristasPresentes.T3 /
              diaristasPlanejadosPorTurno.T3) *
            100
          ).toFixed(2)
        )
      : 0,
};

const aderenciaDW =
  totalDiaristasPlanejados > 0
    ? Number(
        (
          (totalDiaristasPresentes / totalDiaristasPlanejados) *
          100
        ).toFixed(2)
      )
    : 0;


    /* ===============================
       8️⃣ RESPONSE
    =============================== */
    return res.json({
      success: true,
      data: {
        // mantém campos existentes
        dataOperacional: dataOperacionalStr,
        turnoAtual,

        distribuicaoVinculoPorTurno: {
          T1: [
            { name: "SPX", value: distribuicaoVinculoPorTurno.T1.SPX },
            { name: "BPO", value: distribuicaoVinculoPorTurno.T1.BPO },
          ],
          T2: [
            { name: "SPX", value: distribuicaoVinculoPorTurno.T2.SPX },
            { name: "BPO", value: distribuicaoVinculoPorTurno.T2.BPO },
          ],
          T3: [
            { name: "SPX", value: distribuicaoVinculoPorTurno.T3.SPX },
            { name: "BPO", value: distribuicaoVinculoPorTurno.T3.BPO },
          ],
        },

        // adiciona período (padrão Admin)
        periodo: { inicio: isoDate(inicio), fim: isoDate(fim) },

        // KPIs alinhados ao Admin
        kpis: {
          totalColaboradores: totalHcAptoDias,
          presentes: totalHcAptoDias - totalAusenciasDias,
          ausencias: totalAusenciasDias,
          diaristasPlanejados: totalDiaristasPlanejados,
          diaristasPresentes: totalDiaristasPresentes,
          aderenciaDW,
          absenteismo: absenteismoPeriodo,
        },

        distribuicaoTurnoSetor: Object.values(turnoSetorAgg).map((t) => ({
          ...t,
          diaristasPlanejados: diaristasPlanejadosPorTurno[t.turno] || 0,
          diaristasPresentes: diaristasPresentes[t.turno] || 0,
          aderenciaDW: aderenciaDwPorTurno[t.turno] || 0,
          setores: Object.entries(t.setores).map(([setor, quantidade]) => ({
            setor,
            quantidade,
          })),
        })),

        generoPorTurno: Object.fromEntries(
          Object.entries(generoPorTurno).map(([t, g]) => [
            t,
            Object.entries(g).map(([name, value]) => ({ name, value })),
          ])
        ),

        // agora só 4 categorias possíveis:
        // "Presente", "Folga" (não entra pois não escalado), "Atestado Médico", "Falta"
        statusColaboradoresPorTurno: Object.fromEntries(
          Object.entries(statusPorTurno).map(([t, s]) => [
            t,
            Object.entries(s).map(([status, quantidade]) => ({
              status,
              quantidade,
            })),
          ])
        ),

        empresaPorTurno: Object.fromEntries(
          Object.entries(empresaPorTurno).map(([t, empresas]) => [
            t,
            Object.entries(empresas).map(([empresa, dados]) => {
              const ausencias = dados.faltas + dados.atestados;
              return {
                empresa,
                total: dados.total,
                faltas: dados.faltas,
                atestados: dados.atestados,
                ausencias,
                absenteismo:
                  dados.total > 0
                    ? Number(((ausencias / dados.total) * 100).toFixed(2))
                    : 0,
              };
            }),
          ])
        ),


        ausenciasHoje,

        tendenciaPorDia: Object.values(tendenciaPorDia)
          .sort((a, b) => a.data.localeCompare(b.data))
          .map((d) => ({
            data: d.data,
            presentes: d.presentes,
            ausentes: d.ausentes, // Falta + Atestado Médico
            escalados: d.escalados,
            percentual:
              d.escalados > 0
                ? Number(((d.ausentes / d.escalados) * 100).toFixed(2))
                : 0,
          })),

        turnos: turnos.map((t) => ({
          id: t.idTurno,
          nome: t.nomeTurno,
        })),

        escalasAtivas: escalasAtivas.map((e) => ({
          id: e.idEscala,
          nome: e.nomeEscala,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Erro dashboard:", error);
    res.status(500).json({ success: false });
  }
};

module.exports = { carregarDashboard };
