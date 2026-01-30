const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getDateOperacional } = require("../utils/dateOperacional");

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
  // Presença
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
    const desc = String(f.tipoAusencia.descricao || "").toUpperCase();

    // ✅ NC -> não contratado (não escalado, não impacta abs)
    if (codigo === "NC") {
      return {
        label: "Não contratado",
        contaComoEscalado: false,
        impactaAbsenteismo: false,
        origem: "tipoAusencia",
      };
    }

    // ✅ ON -> onboarding (não escalado, não impacta abs)
    if (codigo === "ON") {
      return {
        label: "Onboarding",
        contaComoEscalado: false,
        impactaAbsenteismo: false,
        origem: "tipoAusencia",
      };
    }
    
    // FO / DSR -> não escalado (igual Admin)
    if (codigo === "FO" || codigo === "DSR") {
      return {
        label: codigo === "FO" ? "Folga" : "Folga",
        contaComoEscalado: false,
        impactaAbsenteismo: false,
        origem: "tipoAusencia",
      };
    }

    // Atestado médico (preferência por código AM; fallback por descrição)
    if (codigo === "AM" || desc.includes("ATEST")) {
      return {
        label: "Atestado Médico",
        contaComoEscalado: true,
        impactaAbsenteismo: true,
        origem: "tipoAusencia",
      };
    }

    if (codigo === "S1" || desc.includes("Sinergia")) {
      return {
        label: "Sinergia Enviada",
        contaComoEscalado: false,
        impactaAbsenteismo: false,
        origem: "tipoAusencia",
      }
    }
    
    // Qualquer outra ausência conta como falta operacional
    return {
      label: "Falta",
      contaComoEscalado: true,
      impactaAbsenteismo: true,
      origem: "tipoAusencia",
    };
  }

  // fallback (igual Admin: F)
  return {
    label: "Falta",
    contaComoEscalado: true,
    impactaAbsenteismo: true,
    origem: "semRegistro",
  };
}

/* =====================================================
   CONTROLLER
===================================================== */
const carregarDashboard = async (req, res) => {
  try {
    /* ===============================
       1️⃣ FILTROS DE DATA
    =============================== */
    const { data, dataInicio, dataFim } = req.query;

    const agora = agoraBrasil();
    const { dataOperacional, dataOperacionalStr, turnoAtual } =
      getDateOperacional(agora);
    const { turno: turnoFiltro } = req.query;

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

      empresaPorTurno[turno][empresa] =
        (empresaPorTurno[turno][empresa] || 0) + 1;

      const setor = getSetor(registroSnapshot, c);
      turnoSetorAgg[turno].setores[setor] =
        (turnoSetorAgg[turno].setores[setor] || 0) + 1;

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
        });
      }
    });

    /* ===============================
       6️⃣ KPIs (absenteísmo no período igual Admin)
    =============================== */
    const diasPeriodo = daysInclusive(inicio, fim);

    let absDias = 0;
    const escaladosSet = new Set();
    const presentesSet = new Set();

    frequenciasPeriodo.forEach((f) => {
      const c = colaboradores.find(col => col.opsId === f.opsId);
      if (!c) return;

      const turnoColab = normalizeTurno(c.turno?.nomeTurno);
      if (turnoFiltro && turnoColab !== turnoFiltro) return;

      const s = getStatusDoDiaOperacional(f);
      if (!s.contaComoEscalado) return;

      escaladosSet.add(f.opsId);

      if (s.label === "Presente") {
        presentesSet.add(f.opsId);
      }

      if (s.impactaAbsenteismo) {
        absDias++;
      }
    });


    const totalEscaladosPeriodo = escaladosSet.size;
    const diasEsperados = totalEscaladosPeriodo * diasPeriodo;

    const absenteismoPeriodo =
      diasEsperados > 0
        ? Number(((absDias / diasEsperados) * 100).toFixed(2))
        : 0;

    /* ===============================
       7️⃣ RESPONSE
    =============================== */
    return res.json({
      success: true,
      data: {
        // mantém campos existentes
        dataOperacional: dataOperacionalStr,
        turnoAtual,

        // adiciona período (padrão Admin)
        periodo: { inicio: isoDate(inicio), fim: isoDate(fim) },

        // KPIs alinhados ao Admin
        kpis: {
          totalColaboradores: totalEscaladosPeriodo,
          presentes: presentesSet.size,
          absenteismo: absenteismoPeriodo,
        },

        distribuicaoTurnoSetor: Object.values(turnoSetorAgg).map((t) => ({
          ...t,
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
          Object.entries(empresaPorTurno).map(([t, e]) => [
            t,
            Object.entries(e).map(([empresa, quantidade]) => ({
              empresa,
              quantidade,
            })),
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

        empresas: empresas.map((e) => ({
          id: e.idEmpresa,
          nome: e.razaoSocial,
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
