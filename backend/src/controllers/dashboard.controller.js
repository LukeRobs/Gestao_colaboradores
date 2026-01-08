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

function isCargoElegivel(cargo) {
  const nome = String(cargo || "").toUpperCase();

  return (
    nome.includes("AUXILIAR DE LOGÍSTICA I") ||
    nome.includes("AUXILIAR DE LOGÍSTICA II")
  );
}

function isAusenciaValida(status) {
  const s = status.toUpperCase();

  const invalidos = [
    "PRESENTE",
    "PRESENÇA",
    "DSR",
    "DESCANSO",
    "FOLGA",
    "BANCO DE HORAS",
    "TREINAMENTO",
  ];

  return !invalidos.some((v) => s.includes(v));
}

function isDiaDSR(dataOperacional, nomeEscala) {
  // 0 = domingo ... 6 = sábado
  const dow = new Date(dataOperacional).getDay();

  const dsrMap = {
    A: [0, 3], // domingo, quarta
    B: [1, 2], // segunda, terça
    C: [4, 5], // quinta, sexta
  };

  const dias = dsrMap[String(nomeEscala || "").toUpperCase()];
  return !!dias?.includes(dow);
}

function getStatusDoDia(registro) {
  if (registro?.horaEntrada)
    return { status: "PRESENTE", origem: "horaEntrada" };

  if (registro?.idTipoAusencia)
    return {
      status: normalize(registro.tipoAusencia?.descricao || "AUSÊNCIA"),
      origem: "tipoAusencia",
    };

  return { status: "FALTA", origem: "semRegistro" };
}

function getCategoria(status, origem) {
  const s = status.toUpperCase();
  if (origem === "semRegistro") return "ausencia";
  if (s.includes("ATESTADO")) return "atestado";
  if (s.includes("ACIDENT")) return "acidente";
  if (s.includes("FERIA")) return "ferias";
  if (s.includes("DISCIPLIN")) return "disciplinar";
  return "ausencia";
}

function getCriticidade(categoria, origem) {
  if (categoria === "acidente" || origem === "semRegistro") return "alta";
  if (categoria === "disciplinar") return "media";
  return "baixa";
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

    /* ===============================
       2️⃣ QUERIES
    =============================== */
    const [
      colaboradores,
      empresas,
      turnos,
      escalasAtivas,
      frequenciasHoje,
    ] = await Promise.all([
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
       3️⃣ MAPA DE FREQUÊNCIAS
    =============================== */
    const freqMap = new Map();

    frequenciasHoje.forEach((f) => {
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
    const tendenciaPorDia = {};

    const dataSnapshotStr = fim.toISOString().slice(0, 10);

    /* ===============================
       5️⃣ LOOP PRINCIPAL
    =============================== */
    colaboradores.forEach((c) => {
      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;

      const turno = normalizeTurno(c.turno?.nomeTurno);
      if (turno === "Sem turno") return;

      const genero = normalize(c.genero) || "N/I";
      const empresa = normalize(c.empresa?.razaoSocial) || "Sem empresa";

      const registros = freqMap.get(c.opsId) || [];

      /* ========= 5.1 TENDÊNCIA ========= */
      registros.forEach((reg) => {
        const dataRef = reg.dataReferencia
          ?.toISOString()
          .slice(0, 10);
        if (!dataRef) return;

        if (
          c.escala?.nomeEscala &&
          isDiaDSR(reg.dataReferencia, c.escala.nomeEscala)
        )
          return;

        if (!tendenciaPorDia[dataRef]) {
          tendenciaPorDia[dataRef] = {
            data: dataRef,
            presentes: 0,
            ausentes: 0,
          };
        }

        const { status } = getStatusDoDia(reg);

        if (status === "PRESENTE") {
          tendenciaPorDia[dataRef].presentes++;
        } else if (isAusenciaValida(status)) {
          tendenciaPorDia[dataRef].ausentes++;
        }
      });

      /* ========= 5.2 SNAPSHOT ========= */
      if (
        c.escala?.nomeEscala &&
        isDiaDSR(fim, c.escala.nomeEscala)
      )
        return;

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

      const registroSnapshot =
        registros.find(
          (r) =>
            r.dataReferencia
              ?.toISOString()
              .slice(0, 10) === dataSnapshotStr
        ) || null;

      const setor = getSetor(registroSnapshot, c);
      turnoSetorAgg[turno].setores[setor] =
        (turnoSetorAgg[turno].setores[setor] || 0) + 1;

      const { status, origem } = getStatusDoDia(registroSnapshot);

      if (status === "PRESENTE") {
        turnoSetorAgg[turno].presentes++;
        statusPorTurno[turno][status] =
          (statusPorTurno[turno][status] || 0) + 1;
      } else if (isAusenciaValida(status)) {
        turnoSetorAgg[turno].ausentes++;
        statusPorTurno[turno][status] =
          (statusPorTurno[turno][status] || 0) + 1;

        ausenciasHoje.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          turno,
          motivo: status,
          setor: normalize(c.setor?.nomeSetor),
          empresa: normalize(c.empresa?.razaoSocial),
          admissao: c.dataAdmissao,
          lider: normalize(c.lider?.nomeCompleto),
          origem,
          categoria: getCategoria(status, origem),
          criticidade: getCriticidade(
            getCategoria(status, origem),
            origem
          ),
        });
      }
    });

    /* ===============================
       6️⃣ RESPONSE
    =============================== */
    return res.json({
      success: true,
      data: {
        dataOperacional: dataOperacionalStr,
        turnoAtual,

        distribuicaoTurnoSetor: Object.values(turnoSetorAgg).map((t) => ({
          ...t,
          setores: Object.entries(t.setores).map(
            ([setor, quantidade]) => ({ setor, quantidade })
          ),
        })),

        generoPorTurno: Object.fromEntries(
          Object.entries(generoPorTurno).map(([t, g]) => [
            t,
            Object.entries(g).map(([name, value]) => ({ name, value })),
          ])
        ),

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
            ...d,
            percentual: Number(
              (
                (d.ausentes / (d.ausentes + d.presentes)) *
                100
              ).toFixed(2)
            ),
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
