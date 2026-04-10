const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");

/* ───────────────────────────────────────────────────────────
   HELPERS
─────────────────────────────────────────────────────────── */
function dateOnlyBrasil(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function corrigirAdmissao(adm) {
  if (!adm) return null;
  const d = new Date(adm);
  const hoje = new Date();
  if (d <= hoje) return d;
  return new Date(d.getUTCFullYear(), d.getUTCDate() - 1, d.getUTCMonth() + 1);
}

function getFaixaTempoCasa(adm, ref) {
  const admDate = corrigirAdmissao(adm);
  if (!admDate) return "N/I";
  const dias = Math.floor((new Date(ref) - admDate) / 86400000);
  if (dias <= 7)  return "0 a 7";
  if (dias <= 15) return "8 a 15";
  if (dias <= 30) return "16 a 30";
  if (dias <= 89) return "31 a 89";
  return "90+";
}

/* Cargos operacionais contemplados no absenteísmo */
const CARGOS_ABSENTEISMO = ["Auxiliar de Logística I", "Auxiliar de Logística II"];

/**
 * extras: { setorNome, turnoNome }  — drill-down dinâmico
 */
function buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras = {}) {
  const { setorNome, turnoNome } = extras;
  return {
    dataReferencia: { gte: inicioDate, lte: fimDate },
    idTipoAusencia: { in: [3, 32] },
    colaborador: {
      is: {
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaId  && { idEmpresa: Number(empresaId) }),
        ...(estacaoId  && { idEstacao: estacaoId }),
        ...(setorNome  && { setor: { is: { nomeSetor: setorNome } } }),
        ...(turnoNome  && { turno: { is: { nomeTurno: turnoNome } } }),
      },
    },
  };
}

function buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras = {}) {
  const { setorNome, turnoNome } = extras;
  return {
    dataInicio: { gte: inicioDate, lte: fimDate },
    status: { not: "CANCELADO" },
    colaborador: {
      cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
      ...(empresaId  && { idEmpresa: Number(empresaId) }),
      ...(estacaoId  && { idEstacao: estacaoId }),
      ...(setorNome  && { setor: { is: { nomeSetor: setorNome } } }),
      ...(turnoNome  && { turno: { is: { nomeTurno: turnoNome } } }),
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   RESUMO
═══════════════════════════════════════════════════════════ */
const getResumoAbsenteismo = async (req, res) => {
  try {
    const { inicio, fim, empresaId, setorNome, turnoNome } = req.query;
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    /* ── Busca paralela ── */
    const [faltasPeriodo, atestadosPeriodo] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras),
        select: { opsId: true, diasAfastamento: true },
      }),
    ]);

    /* deduplication de faltas por opsId+data */
    const faltasUnicas = new Set(faltasPeriodo.map(f => `${f.opsId}_${f.dataReferencia}`)).size;
    const totalAtestados = atestadosPeriodo.length;
    const totalPeriodo   = faltasUnicas + totalAtestados;

    const diasAfastadosAtestado = atestadosPeriodo.reduce((acc, a) => acc + (a.diasAfastamento || 0), 0);
    const diasAfastados = faltasUnicas + diasAfastadosAtestado;

    /* colaboradores impactados = union dos opsIds */
    const opsIds = new Set([
      ...faltasPeriodo.map(f => f.opsId),
      ...atestadosPeriodo.map(a => a.opsId),
    ]);
    const colaboradoresImpactados = opsIds.size;

    /* recorrência: colaboradores com ≥2 ausências (faltas + atestados somados) */
    const mapaAusencias = {};
    faltasPeriodo.forEach(f => { mapaAusencias[f.opsId] = (mapaAusencias[f.opsId] || 0) + 1; });
    atestadosPeriodo.forEach(a => { mapaAusencias[a.opsId] = (mapaAusencias[a.opsId] || 0) + 1; });
    const colaboradoresRecorrentes = Object.values(mapaAusencias).filter(q => q >= 2).length;
    const recorrencia = colaboradoresImpactados > 0
      ? Number(((colaboradoresRecorrentes / colaboradoresImpactados) * 100).toFixed(2))
      : 0;

    /* % HC — base: Aux. Logística I/II ativos na estação */
    const hcTotal = await prisma.colaborador.count({
      where: {
        status: "ATIVO",
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaId && { idEmpresa: Number(empresaId) }),
        ...(estacaoId && { idEstacao: estacaoId }),
      },
    });
    const percentualHC = hcTotal > 0
      ? Number(((colaboradoresImpactados / hcTotal) * 100).toFixed(2))
      : 0;

    /* hoje/semana/mês */
    const referencia    = fimDate;
    const hoje          = dateOnlyBrasil(new Date().toISOString().slice(0, 10));

    const diaSemana   = hoje.getDay();
    const diffSemana  = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diffSemana);

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const [
      faltasHoje, atestadosHoje,
      faltasSemana, atestadosSemana,
      faltasMes, atestadosMes,
    ] = await Promise.all([
      prisma.frequencia.count({ where: buildWhereFrequencia(referencia, referencia, empresaId, estacaoId, extras) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(referencia, referencia, empresaId, estacaoId, extras) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioSemana, hoje, empresaId, estacaoId, extras) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioSemana, hoje, empresaId, estacaoId, extras) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioMes, hoje, empresaId, estacaoId, extras) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioMes, hoje, empresaId, estacaoId, extras) }),
    ]);

    return successResponse(res, {
      kpis: {
        totalPeriodo,
        totalFaltas:    faltasUnicas,
        totalAtestados,
        diasAfastados,
        recorrencia,
        colaboradoresImpactados,
        percentualHC,
        hoje:   faltasHoje + atestadosHoje,
        semana: faltasSemana + atestadosSemana,
        mes:    faltasMes + atestadosMes,
      },
    });
  } catch (err) {
    console.error("❌ RESUMO ABSENTEISMO:", err);
    return errorResponse(res, "Erro ao gerar resumo", 500);
  }
};

/* ═══════════════════════════════════════════════════════════
   DISTRIBUIÇÕES
═══════════════════════════════════════════════════════════ */
const getDistribuicoesAbsenteismo = async (req, res) => {
  try {
    const { inicio, fim, empresaId, setorNome, turnoNome } = req.query;
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const [faltas, atestados] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, lider: true, escala: true },
          },
        },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, lider: true, escala: true },
          },
        },
      }),
    ]);

    const acc = {
      empresa: {}, setor: {}, turno: {}, genero: {},
      lider: {}, diaSemana: {}, escala: {}, tipo: {},
    };

    /* faltas */
    for (const f of faltas) {
      const c = f.colaborador;
      if (!c) continue;
      const empresa   = c.empresa?.razaoSocial || "N/I";
      const setor     = c.setor?.nomeSetor      || "N/I";
      const turno     = c.turno?.nomeTurno      || "N/I";
      const genero    = c.genero                || "N/I";
      const lider     = c.lider?.nomeCompleto   || "Sem líder";
      const diaSemana = DIAS_SEMANA[new Date(f.dataReferencia).getDay()];
      const escala    = c.escala?.nomeEscala    || "N/I";
      acc.empresa[empresa]     = (acc.empresa[empresa]     || 0) + 1;
      acc.setor[setor]         = (acc.setor[setor]         || 0) + 1;
      acc.turno[turno]         = (acc.turno[turno]         || 0) + 1;
      acc.genero[genero]       = (acc.genero[genero]       || 0) + 1;
      acc.lider[lider]         = (acc.lider[lider]         || 0) + 1;
      acc.diaSemana[diaSemana] = (acc.diaSemana[diaSemana] || 0) + 1;
      acc.escala[escala]       = (acc.escala[escala]       || 0) + 1;
      acc.tipo["Falta"]        = (acc.tipo["Falta"]        || 0) + 1;
    }

    /* atestados */
    for (const a of atestados) {
      const c = a.colaborador;
      if (!c) continue;
      const empresa   = c.empresa?.razaoSocial || "N/I";
      const setor     = c.setor?.nomeSetor      || "N/I";
      const turno     = c.turno?.nomeTurno      || "N/I";
      const genero    = c.genero                || "N/I";
      const lider     = c.lider?.nomeCompleto   || "Sem líder";
      const escala    = c.escala?.nomeEscala    || "N/I";
      acc.empresa[empresa]    = (acc.empresa[empresa]    || 0) + 1;
      acc.setor[setor]        = (acc.setor[setor]        || 0) + 1;
      acc.turno[turno]        = (acc.turno[turno]        || 0) + 1;
      acc.genero[genero]      = (acc.genero[genero]      || 0) + 1;
      acc.lider[lider]        = (acc.lider[lider]        || 0) + 1;
      acc.escala[escala]      = (acc.escala[escala]      || 0) + 1;
      acc.tipo["Atestado"]    = (acc.tipo["Atestado"]    || 0) + 1;
    }

    const toArray = (obj) =>
      Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return successResponse(res, {
      porEmpresa:   toArray(acc.empresa),
      porSetor:     toArray(acc.setor),
      porTurno:     toArray(acc.turno),
      porGenero:    toArray(acc.genero),
      porLider:     toArray(acc.lider).slice(0, 10),
      porDiaSemana: toArray(acc.diaSemana),
      porEscala:    toArray(acc.escala),
      porTipo:      toArray(acc.tipo),
    });
  } catch (err) {
    console.error("❌ DISTRIBUIÇÕES ABSENTEISMO:", err);
    return errorResponse(res, "Erro ao buscar distribuições", 500);
  }
};

/* ═══════════════════════════════════════════════════════════
   TENDÊNCIA
═══════════════════════════════════════════════════════════ */
const getTendenciaAbsenteismo = async (req, res) => {
  try {
    const { inicio, fim, empresaId, setorNome, turnoNome } = req.query;
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras),
        select: { dataInicio: true },
      }),
    ]);

    const mapa = {};

    /* faltas por dia (unique opsId+data) */
    const faltasVistas = new Set();
    faltas.forEach((f) => {
      const key = f.dataReferencia.toISOString().slice(0, 10);
      const uniq = `${f.opsId}_${key}`;
      if (!faltasVistas.has(uniq)) {
        faltasVistas.add(uniq);
        if (!mapa[key]) mapa[key] = { faltas: 0, atestados: 0 };
        mapa[key].faltas += 1;
      }
    });

    /* atestados por dia de início */
    atestados.forEach((a) => {
      const key = a.dataInicio.toISOString().slice(0, 10);
      if (!mapa[key]) mapa[key] = { faltas: 0, atestados: 0 };
      mapa[key].atestados += 1;
    });

    const resultado = Object.entries(mapa)
      .map(([data, v]) => ({
        data,
        total: v.faltas + v.atestados,
        faltas: v.faltas,
        atestados: v.atestados,
      }))
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    return successResponse(res, resultado);
  } catch (err) {
    console.error("❌ TENDÊNCIA ABSENTEISMO:", err);
    return errorResponse(res, "Erro ao buscar tendência", 500);
  }
};

/* ═══════════════════════════════════════════════════════════
   COLABORADORES
═══════════════════════════════════════════════════════════ */
const getColaboradoresAbsenteismo = async (req, res) => {
  try {
    const { inicio, fim, empresaId, setorNome, turnoNome } = req.query;
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, escala: true },
          },
        },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, escala: true },
          },
        },
      }),
    ]);

    const mapa = {};

    /* faltas */
    faltas.forEach((f) => {
      const c = f.colaborador;
      if (!c) return;
      if (!mapa[c.opsId]) {
        mapa[c.opsId] = {
          opsId: c.opsId,
          nome: c.nomeCompleto,
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          turno: c.turno?.nomeTurno || "N/I",
          escala: c.escala?.nomeEscala || "N/I",
          tempoCasa: getFaixaTempoCasa(c.dataAdmissao, fimDate),
          diasFaltas: new Set(),
          totalAtestados: 0,
          diasAfastados: 0,
        };
      }
      mapa[c.opsId].diasFaltas.add(new Date(f.dataReferencia).toISOString().slice(0, 10));
    });

    /* atestados */
    atestados.forEach((a) => {
      const c = a.colaborador;
      if (!c) return;
      if (!mapa[a.opsId]) {
        mapa[a.opsId] = {
          opsId: a.opsId,
          nome: c.nomeCompleto,
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          turno: c.turno?.nomeTurno || "N/I",
          escala: c.escala?.nomeEscala || "N/I",
          tempoCasa: getFaixaTempoCasa(c.dataAdmissao, fimDate),
          diasFaltas: new Set(),
          totalAtestados: 0,
          diasAfastados: 0,
        };
      }
      mapa[a.opsId].totalAtestados += 1;
      mapa[a.opsId].diasAfastados  += a.diasAfastamento || 0;
    });

    const lista = Object.values(mapa)
      .map((c) => {
        const totalFaltas    = c.diasFaltas.size;
        const totalAusencias = totalFaltas + c.totalAtestados;
        return {
          opsId:          c.opsId,
          nome:           c.nome,
          empresa:        c.empresa,
          setor:          c.setor,
          turno:          c.turno,
          escala:         c.escala,
          tempoCasa:      c.tempoCasa,
          totalFaltas,
          totalAtestados: c.totalAtestados,
          diasAfastados:  c.diasAfastados,
          totalAusencias,
          recorrencia:    totalAusencias >= 2,
        };
      })
      .sort((a, b) => {
        if (b.totalAusencias !== a.totalAusencias) return b.totalAusencias - a.totalAusencias;
        return a.nome.localeCompare(b.nome);
      });

    return successResponse(res, {
      tabela:       lista,
      topOfensores: lista.slice(0, 10),
    });
  } catch (err) {
    console.error("❌ COLABORADORES ABSENTEISMO:", err);
    return errorResponse(res, "Erro ao buscar colaboradores", 500);
  }
};

module.exports = {
  getResumoAbsenteismo,
  getDistribuicoesAbsenteismo,
  getTendenciaAbsenteismo,
  getColaboradoresAbsenteismo,
};
