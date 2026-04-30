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
  if (dias <= 60) return "31 a 60";
  if (dias <= 90) return "61 a 90";
  return "90+";
}

/* Cargos operacionais contemplados no absenteísmo */
const CARGOS_ABSENTEISMO = ["Auxiliar de Logística I", "Auxiliar de Logística II", "Auxiliar de Logística I - PCD"];

/* Códigos que compõem o HC Apto (denominador da taxa de absenteísmo) */
const HC_APTO_CODES = ["P", "F", "FJ", "AM", "AA", "FO", "BH", "S1"];

function buildWhereHcApto(inicioDate, fimDate, empresaId, estacaoId, extras = {}, empresaIds = []) {
  const { setorNome, turnoNome } = extras;
  return {
    dataReferencia: { gte: inicioDate, lte: fimDate },
    OR: [
      { tipoAusencia: { is: { codigo: { in: HC_APTO_CODES } } } },
      { idTipoAusencia: null, horaEntrada: { not: null } },
    ],
    colaborador: {
      is: {
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaIds.length
          ? { idEmpresa: { in: empresaIds.map(Number) } }
          : empresaId
          ? { idEmpresa: Number(empresaId) }
          : {}),
        ...(estacaoId && { idEstacao: estacaoId }),
        ...(setorNome && { setor: { is: { nomeSetor: setorNome } } }),
        ...(turnoNome && { turno: { is: { nomeTurno: turnoNome } } }),
      },
    },
  };
}

/**
 * extras: { setorNome, turnoNome }  — drill-down dinâmico
 */
function buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras = {}, empresaIds = []) {
  const { setorNome, turnoNome } = extras;
  return {
    dataReferencia: { gte: inicioDate, lte: fimDate },
    tipoAusencia: { is: { codigo: { in: ["F", "FJ"] } } },
    colaborador: {
      is: {
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaIds.length
          ? { idEmpresa: { in: empresaIds.map(Number) } }
          : empresaId
          ? { idEmpresa: Number(empresaId) }
          : {}),
        ...(estacaoId  && { idEstacao: estacaoId }),
        ...(setorNome  && { setor: { is: { nomeSetor: setorNome } } }),
        ...(turnoNome  && { turno: { is: { nomeTurno: turnoNome } } }),
      },
    },
  };
}

function buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras = {}, empresaIds = []) {
  const { setorNome, turnoNome } = extras;
  return {
    dataInicio: { gte: inicioDate, lte: fimDate },
    status: { not: "CANCELADO" },
    colaborador: {
      cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
      ...(empresaIds.length
        ? { idEmpresa: { in: empresaIds.map(Number) } }
        : empresaId
        ? { idEmpresa: Number(empresaId) }
        : {}),
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
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    /* ── Busca paralela ── */
    const [faltasPeriodo, atestadosPeriodo] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
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

    /* HC Apto — denominador real: registros com código apto no período */
    const hcApto = await prisma.frequencia.count({
      where: buildWhereHcApto(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
    });
    const taxaAbsenteismo = hcApto > 0
      ? Number(((totalPeriodo / hcApto) * 100).toFixed(2))
      : 0;

    /* % HC — mantido para compatibilidade: impactados / ativos */
    const hcTotal = await prisma.colaborador.count({
      where: {
        status: "ATIVO",
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaIds.length
          ? { idEmpresa: { in: empresaIds.map(Number) } }
          : empresaId
          ? { idEmpresa: Number(empresaId) }
          : {}),
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
      prisma.frequencia.count({ where: buildWhereFrequencia(referencia, referencia, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(referencia, referencia, empresaId, estacaoId, extras, empresaIds) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioSemana, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioSemana, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioMes, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioMes, hoje, empresaId, estacaoId, extras, empresaIds) }),
    ]);

    return successResponse(res, {
      kpis: {
        totalPeriodo,
        totalFaltas:              faltasUnicas,
        totalAtestados,
        diasAfastados,
        recorrencia,
        colaboradoresImpactados,
        colaboradoresRecorrentes,
        percentualHC,
        taxaAbsenteismo,
        hcApto,
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
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const [faltas, atestados, hcAptoRecords] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, lider: true, escala: true },
          },
        },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, lider: true, escala: true },
          },
        },
      }),
      prisma.frequencia.findMany({
        where: buildWhereHcApto(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        include: { colaborador: { include: { turno: true, empresa: true } } },
      }),
    ]);

    /* acc: cada chave armazena { faltas, atestados } */
    const acc = { empresa: {}, setor: {}, turno: {}, genero: {}, lider: {}, diaSemana: {}, escala: {} };

    const inc = (obj, key, tipo) => {
      if (!obj[key]) obj[key] = { faltas: 0, atestados: 0 };
      obj[key][tipo]++;
    };

    for (const f of faltas) {
      const c = f.colaborador;
      if (!c) continue;
      inc(acc.empresa,   c.empresa?.razaoSocial                          || "N/I", "faltas");
      inc(acc.setor,     c.setor?.nomeSetor                              || "N/I", "faltas");
      inc(acc.turno,     c.turno?.nomeTurno                              || "N/I", "faltas");
      inc(acc.genero,    c.genero                                        || "N/I", "faltas");
      inc(acc.lider,     c.lider?.nomeCompleto                           || "Sem líder", "faltas");
      inc(acc.diaSemana, DIAS_SEMANA[new Date(f.dataReferencia).getDay()]         , "faltas");
      inc(acc.escala,    c.escala?.nomeEscala                            || "N/I", "faltas");
    }

    for (const a of atestados) {
      const c = a.colaborador;
      if (!c) continue;
      inc(acc.empresa,   c.empresa?.razaoSocial || "N/I", "atestados");
      inc(acc.setor,     c.setor?.nomeSetor      || "N/I", "atestados");
      inc(acc.turno,     c.turno?.nomeTurno      || "N/I", "atestados");
      inc(acc.genero,    c.genero                || "N/I", "atestados");
      inc(acc.lider,     c.lider?.nomeCompleto   || "Sem líder", "atestados");
      inc(acc.diaSemana, DIAS_SEMANA[new Date(a.dataInicio).getDay()]          , "atestados");
      inc(acc.escala,    c.escala?.nomeEscala    || "N/I", "atestados");
    }

    /* acumuladores de HC Apto por empresa, turno e dia da semana */
    const hcEmpresa   = {};
    const hcTurno     = {};
    const hcDiaSemana = {};
    for (const r of hcAptoRecords) {
      const empresa = r.colaborador?.empresa?.razaoSocial || "N/I";
      const turno   = r.colaborador?.turno?.nomeTurno     || "N/I";
      const dia     = DIAS_SEMANA[new Date(r.dataReferencia).getDay()];
      hcEmpresa[empresa]  = (hcEmpresa[empresa]  || 0) + 1;
      hcTurno[turno]      = (hcTurno[turno]      || 0) + 1;
      hcDiaSemana[dia]    = (hcDiaSemana[dia]    || 0) + 1;
    }

    /* toArray simples */
    const toArray = (obj) =>
      Object.entries(obj)
        .map(([name, v]) => ({ name, faltas: v.faltas, atestados: v.atestados, value: v.faltas + v.atestados }))
        .sort((a, b) => b.value - a.value);

    /* toArray com HC Apto — adiciona headcount e taxa real */
    const toArrayWithHc = (obj, hcMap) =>
      Object.entries(obj)
        .map(([name, v]) => {
          const headcount = hcMap[name] || 0;
          const taxa = headcount > 0
            ? Number((((v.faltas + v.atestados) / headcount) * 100).toFixed(2))
            : null;
          return { name, faltas: v.faltas, atestados: v.atestados, value: v.faltas + v.atestados, headcount, taxa };
        })
        .sort((a, b) => b.value - a.value);

    return successResponse(res, {
      porEmpresa:   toArrayWithHc(acc.empresa, hcEmpresa),
      porSetor:     toArray(acc.setor),
      porTurno:     toArrayWithHc(acc.turno,    hcTurno),
      porGenero:    toArray(acc.genero),
      porLider:     toArray(acc.lider).slice(0, 10),
      porDiaSemana: toArrayWithHc(acc.diaSemana, hcDiaSemana),
      porEscala:    toArray(acc.escala),
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
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
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
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        include: {
          colaborador: {
            include: { empresa: true, setor: true, turno: true, escala: true },
          },
        },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
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
          matricula: c.matricula || "N/I",
          nome: c.nomeCompleto,
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          turno: c.turno?.nomeTurno || "N/I",
          escala: c.escala?.nomeEscala || "N/I",
          diasDsrEscala: c.escala?.diasDsr || [],
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
          matricula: c.matricula || "N/I",
          nome: c.nomeCompleto,
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          turno: c.turno?.nomeTurno || "N/I",
          escala: c.escala?.nomeEscala || "N/I",
          diasDsrEscala: c.escala?.diasDsr || [],
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
        const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const diaFolgaDsr = c.diasDsrEscala.length > 0
          ? c.diasDsrEscala.map((d) => DIAS_PT[d] ?? d).join(", ")
          : null;
        return {
          opsId:          c.opsId,
          matricula:      c.matricula,
          nome:           c.nome,
          empresa:        c.empresa,
          setor:          c.setor,
          turno:          c.turno,
          escala:         c.escala,
          tempoCasa:      c.tempoCasa,
          diaFolgaDsr,
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
