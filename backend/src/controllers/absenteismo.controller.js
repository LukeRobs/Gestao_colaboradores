const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");

/* ───────────────────────────────────────────────────────────
   HELPERS
─────────────────────────────────────────────────────────── */
function dateOnlyBrasil(dateStr) {
  // dataReferencia é armazenado como DATE puro (meia-noite UTC).
  // new Date(dateStr) + setHours() usa o fuso LOCAL do servidor (UTC-3),
  // o que desloca a data em 1 dia — sempre construir em UTC.
  return new Date(dateStr.slice(0, 10) + "T00:00:00.000Z");
}

function corrigirAdmissao(adm) {
  if (!adm) return null;
  const d = new Date(adm);
  const hoje = new Date();
  if (d <= hoje) return d;
  return new Date(d.getUTCFullYear(), d.getUTCDate() - 1, d.getUTCMonth() + 1);
}

/* Primeiro e último dia do mês calendário que contém a data de referência —
   usado pra recorrência, que não deve ficar restrita ao período filtrado
   (senão um filtro de 1 dia nunca acharia ninguém recorrente). */
function getMesReferencia(dataRef) {
  const d = new Date(dataRef);
  const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1);
  const fimMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  fimMes.setHours(23, 59, 59, 999);
  return { inicioMes, fimMes };
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
  const { setorNome, turnoNome, statusColaborador } = extras;
  return {
    dataReferencia: { gte: inicioDate, lte: fimDate },
    OR: [
      { tipoAusencia: { is: { codigo: { in: HC_APTO_CODES } } } },
      { idTipoAusencia: null, horaEntrada: { not: null } },
    ],
    colaborador: {
      is: {
        OR: [
          { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] } },
          { dataDesligamento: { gte: inicioDate } },
        ],
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaIds.length
          ? { idEmpresa: { in: empresaIds.map(Number) } }
          : empresaId
          ? { idEmpresa: Number(empresaId) }
          : {}),
        ...(estacaoId && { idEstacao: estacaoId }),
        ...(setorNome && { setor: { is: { nomeSetor: setorNome } } }),
        ...(turnoNome && { turno: { is: { nomeTurno: turnoNome } } }),
        ...(statusColaborador && { status: statusColaborador }),
      },
    },
  };
}

/**
 * extras: { setorNome, turnoNome, statusColaborador }  — drill-down dinâmico
 * codigos: códigos de tipoAusencia a considerar — "F"/"FJ" = faltas; "AA" = atestado de acompanhamento (sem tabela própria)
 */
function buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras = {}, empresaIds = [], codigos = ["F", "FJ"]) {
  const { setorNome, turnoNome, statusColaborador } = extras;
  return {
    dataReferencia: { gte: inicioDate, lte: fimDate },
    tipoAusencia: { is: { codigo: { in: codigos } } },
    colaborador: {
      is: {
        OR: [
          { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] } },
          { dataDesligamento: { gte: inicioDate } },
        ],
        cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
        ...(empresaIds.length
          ? { idEmpresa: { in: empresaIds.map(Number) } }
          : empresaId
          ? { idEmpresa: Number(empresaId) }
          : {}),
        ...(estacaoId  && { idEstacao: estacaoId }),
        ...(setorNome  && { setor: { is: { nomeSetor: setorNome } } }),
        ...(turnoNome  && { turno: { is: { nomeTurno: turnoNome } } }),
        ...(statusColaborador && { status: statusColaborador }),
      },
    },
  };
}

function buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras = {}, empresaIds = []) {
  const { setorNome, turnoNome, statusColaborador } = extras;
  return {
    dataInicio: { lte: fimDate },
    dataFim:    { gte: inicioDate },
    status: { not: "CANCELADO" },
    colaborador: {
      OR: [
        { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] } },
        { dataDesligamento: { gte: inicioDate } },
      ],
      cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
      ...(empresaIds.length
        ? { idEmpresa: { in: empresaIds.map(Number) } }
        : empresaId
        ? { idEmpresa: Number(empresaId) }
        : {}),
      ...(estacaoId  && { idEstacao: estacaoId }),
      ...(setorNome  && { setor: { is: { nomeSetor: setorNome } } }),
      ...(turnoNome  && { turno: { is: { nomeTurno: turnoNome } } }),
      ...(statusColaborador && { status: statusColaborador }),
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   RESUMO
═══════════════════════════════════════════════════════════ */
const getResumoAbsenteismo = async (req, res) => {
  try {
    const { inicio, fim, empresaId, setorNome, turnoNome, status } = req.query;
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome, statusColaborador: status };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    /* ── Busca paralela ── */
    const [faltasPeriodo, atestadosPeriodo, aaPeriodo] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, diasAfastamento: true },
      }),
      // AA (atestado de acompanhamento) não tem tabela própria — vem só da frequência, contado como atestado
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds, ["AA"]),
        select: { opsId: true, dataReferencia: true },
      }),
    ]);

    /* deduplication de faltas/AA por opsId+data */
    const faltasUnicas   = new Set(faltasPeriodo.map(f => `${f.opsId}_${f.dataReferencia}`)).size;
    const aaUnicas        = new Set(aaPeriodo.map(a => `${a.opsId}_${a.dataReferencia}`)).size;
    const totalAtestados = atestadosPeriodo.length + aaUnicas;
    const totalPeriodo   = faltasUnicas + totalAtestados;

    const diasAfastadosAtestado = atestadosPeriodo.reduce((acc, a) => acc + (a.diasAfastamento || 0), 0) + aaUnicas;
    const diasAfastados = faltasUnicas + diasAfastadosAtestado;

    /* colaboradores impactados = union dos opsIds */
    const opsIds = new Set([
      ...faltasPeriodo.map(f => f.opsId),
      ...atestadosPeriodo.map(a => a.opsId),
      ...aaPeriodo.map(a => a.opsId),
    ]);
    const colaboradoresImpactados = opsIds.size;

    /* recorrência: colaboradores com ≥2 ausências no MÊS CALENDÁRIO de referência
       (não só no período filtrado) — senão um filtro de 1 dia nunca mostraria
       ninguém como recorrente, mesmo que a pessoa tenha faltado várias vezes
       no mês. A base de comparação continua sendo só quem está impactado
       no período filtrado; o que muda é a janela usada pra contar as ausências. */
    const { inicioMes: inicioMesRec, fimMes: fimMesRec } = getMesReferencia(fimDate);
    const [faltasMesRec, atestadosMesRec, aaMesRec] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioMesRec, fimMesRec, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioMesRec, fimMesRec, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true },
      }),
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioMesRec, fimMesRec, empresaId, estacaoId, extras, empresaIds, ["AA"]),
        select: { opsId: true, dataReferencia: true },
      }),
    ]);

    const mapaAusenciasMes = {};
    new Set(faltasMesRec.map(f => `${f.opsId}_${f.dataReferencia}`)).forEach((chave) => {
      const opsId = chave.split("_")[0];
      mapaAusenciasMes[opsId] = (mapaAusenciasMes[opsId] || 0) + 1;
    });
    atestadosMesRec.forEach(a => { mapaAusenciasMes[a.opsId] = (mapaAusenciasMes[a.opsId] || 0) + 1; });
    new Set(aaMesRec.map(a => `${a.opsId}_${a.dataReferencia}`)).forEach((chave) => {
      const opsId = chave.split("_")[0];
      mapaAusenciasMes[opsId] = (mapaAusenciasMes[opsId] || 0) + 1;
    });

    const colaboradoresRecorrentes = [...opsIds].filter((opsId) => (mapaAusenciasMes[opsId] || 0) >= 2).length;
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
      faltasHoje, atestadosHoje, aaHoje,
      faltasSemana, atestadosSemana, aaSemana,
      faltasMes, atestadosMes, aaMes,
    ] = await Promise.all([
      prisma.frequencia.count({ where: buildWhereFrequencia(referencia, referencia, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(referencia, referencia, empresaId, estacaoId, extras, empresaIds) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(referencia, referencia, empresaId, estacaoId, extras, empresaIds, ["AA"]) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioSemana, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioSemana, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioSemana, hoje, empresaId, estacaoId, extras, empresaIds, ["AA"]) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioMes, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.atestadoMedico.count({ where: buildWhereAtestado(inicioMes, hoje, empresaId, estacaoId, extras, empresaIds) }),
      prisma.frequencia.count({ where: buildWhereFrequencia(inicioMes, hoje, empresaId, estacaoId, extras, empresaIds, ["AA"]) }),
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
        hoje:   faltasHoje + atestadosHoje + aaHoje,
        semana: faltasSemana + atestadosSemana + aaSemana,
        mes:    faltasMes + atestadosMes + aaMes,
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
    const { inicio, fim, empresaId, setorNome, turnoNome, status } = req.query;
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome, statusColaborador: status };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    // Só os campos que as contagens usam. Antes, cada linha trazia o colaborador inteiro com 5 relações
    // completas: num período de ~80 dias isso passava de 2 GB de memória e derrubava o servidor (OOM).
    const colaboradorDistribuicao = {
      select: {
        status: true,
        dataDesligamento: true,
        genero: true,
        empresa: { select: { razaoSocial: true } },
        setor: { select: { nomeSetor: true } },
        turno: { select: { nomeTurno: true } },
        lider: { select: { nomeCompleto: true } },
        escala: { select: { nomeEscala: true } },
      },
    };

    // Filtrar pelo id do tipo (resolvido uma vez, tabela minúscula) em vez de pelo código via relação:
    // o banco usa o índice de frequência direto e a consulta cai de ~10 s para poucos segundos.
    const tiposFiltro = await prisma.tipoAusencia.findMany({
      where: { codigo: { in: [...new Set(["F", "FJ", "AA", ...HC_APTO_CODES])] } },
      select: { idTipoAusencia: true, codigo: true },
    });
    const idsPorCodigos = (codigos) => tiposFiltro.filter((t) => codigos.includes(t.codigo)).map((t) => t.idTipoAusencia);
    const whereHcApto = buildWhereHcApto(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds);

    const [frequenciasAll, atestados, hcAptoRecords] = await Promise.all([
      // Só faltas (F/FJ) e atestado de acompanhamento (AA) — são os únicos códigos que o cálculo abaixo usa.
      prisma.frequencia.findMany({
        where: {
          dataReferencia: { gte: inicioDate, lte: fimDate },
          idTipoAusencia: { in: idsPorCodigos(["F", "FJ", "AA"]) },
          colaborador: {
            is: {
              cargo: { is: { nomeCargo: { in: CARGOS_ABSENTEISMO } } },
              ...(empresaIds.length
                ? { idEmpresa: { in: empresaIds.map(Number) } }
                : empresaId ? { idEmpresa: Number(empresaId) } : {}),
              ...(estacaoId && { idEstacao: estacaoId }),
              ...(extras.setorNome && { setor: { is: { nomeSetor: extras.setorNome } } }),
              ...(extras.turnoNome && { turno: { is: { nomeTurno: extras.turnoNome } } }),
              ...(extras.statusColaborador && { status: extras.statusColaborador }),
            },
          },
        },
        select: {
          opsId: true,
          dataReferencia: true,
          tipoAusencia: { select: { codigo: true } },
          colaborador: colaboradorDistribuicao,
        },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: {
          opsId: true,
          dataInicio: true,
          colaborador: colaboradorDistribuicao,
        },
      }),
      prisma.frequencia.findMany({
        where: {
          ...whereHcApto,
          OR: [
            { idTipoAusencia: { in: idsPorCodigos(HC_APTO_CODES) } },
            { idTipoAusencia: null, horaEntrada: { not: null } },
          ],
        },
        select: {
          dataReferencia: true,
          colaborador: {
            select: {
              empresa: { select: { razaoSocial: true } },
              turno: { select: { nomeTurno: true } },
            },
          },
        },
      }),
    ]);

    // Filtra em JS: exclui desligados antes do período
    const colaboradorValido = (f) => {
      const c = f.colaborador;
      if (!c) return false;
      if (!["ATIVO", "FERIAS", "AFASTADO"].includes(c.status)) {
        if (!c.dataDesligamento || new Date(c.dataDesligamento) < inicioDate) return false;
      }
      return true;
    };
    const CODIGOS_FALTA = new Set(["F", "FJ"]);
    const faltas = frequenciasAll.filter((f) => CODIGOS_FALTA.has(f.tipoAusencia?.codigo?.toUpperCase()) && colaboradorValido(f));
    // AA (atestado de acompanhamento) não tem tabela própria — vem só da frequência, contado como atestado
    const aaRegistros = frequenciasAll.filter((f) => f.tipoAusencia?.codigo?.toUpperCase() === "AA" && colaboradorValido(f));

    /* acc: cada chave armazena { faltas, atestados } */
    const acc = { empresa: {}, setor: {}, turno: {}, genero: {}, lider: {}, diaSemana: {}, escala: {} };

    const inc = (obj, key, tipo) => {
      if (!obj[key]) obj[key] = { faltas: 0, atestados: 0 };
      obj[key][tipo]++;
    };

    // opsIds já contados via frequencia — evita double-count com atestadoMedico
    const opsIdsNaFrequencia = new Set(faltas.map(f => f.opsId));

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
      // Pula se já contado via frequencia (evita double-count AM/AA + atestadoMedico)
      if (opsIdsNaFrequencia.has(a.opsId)) continue;
      inc(acc.empresa,   c.empresa?.razaoSocial || "N/I", "atestados");
      inc(acc.setor,     c.setor?.nomeSetor      || "N/I", "atestados");
      inc(acc.turno,     c.turno?.nomeTurno      || "N/I", "atestados");
      inc(acc.genero,    c.genero                || "N/I", "atestados");
      inc(acc.lider,     c.lider?.nomeCompleto   || "Sem líder", "atestados");
      inc(acc.diaSemana, DIAS_SEMANA[new Date(a.dataInicio).getDay()]          , "atestados");
      inc(acc.escala,    c.escala?.nomeEscala    || "N/I", "atestados");
    }

    /* AA (atestado de acompanhamento) — conta como atestado */
    for (const a of aaRegistros) {
      const c = a.colaborador;
      if (!c) continue;
      inc(acc.empresa,   c.empresa?.razaoSocial || "N/I", "atestados");
      inc(acc.setor,     c.setor?.nomeSetor      || "N/I", "atestados");
      inc(acc.turno,     c.turno?.nomeTurno      || "N/I", "atestados");
      inc(acc.genero,    c.genero                || "N/I", "atestados");
      inc(acc.lider,     c.lider?.nomeCompleto   || "Sem líder", "atestados");
      inc(acc.diaSemana, DIAS_SEMANA[new Date(a.dataReferencia).getDay()]     , "atestados");
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
        // Empate no total: desempata pelo nome. Sem isso a ordem dos empatados (e quem entra no Top 10 de líderes)
        // dependia da ordem em que o banco devolvia as linhas, e mudava de uma chamada para outra.
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    /* toArray com HC Apto — inclui todos os turnos/empresas com HC, mesmo com 0 ausências */
    const toArrayWithHc = (obj, hcMap) => {
      const allKeys = new Set([...Object.keys(obj), ...Object.keys(hcMap)]);
      return Array.from(allKeys)
        .map((name) => {
          const v = obj[name] || { faltas: 0, atestados: 0 };
          const headcount = hcMap[name] || 0;
          const taxa = headcount > 0
            ? Number((((v.faltas + v.atestados) / headcount) * 100).toFixed(2))
            : null;
          return { name, faltas: v.faltas, atestados: v.atestados, value: v.faltas + v.atestados, headcount, taxa };
        })
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    };

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
    const { inicio, fim, empresaId, setorNome, turnoNome, status } = req.query;
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome, statusColaborador: status };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados, aaRegistros] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds),
        select: { dataInicio: true, dataFim: true },
      }),
      // AA (atestado de acompanhamento) não tem tabela própria — vem só da frequência, contado como atestado
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds, ["AA"]),
        select: { opsId: true, dataReferencia: true },
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

    /* atestados — expande por todos os dias cobertos (clamped ao período consultado) */
    atestados.forEach((a) => {
      const di = new Date(Math.max(new Date(a.dataInicio).getTime(), inicioDate.getTime()));
      const df = new Date(Math.min(new Date(a.dataFim).getTime(),    fimDate.getTime()));
      for (let d = new Date(di); d <= df; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!mapa[key]) mapa[key] = { faltas: 0, atestados: 0 };
        mapa[key].atestados += 1;
      }
    });

    /* AA por dia (unique opsId+data) — conta como atestado */
    const aaVistos = new Set();
    aaRegistros.forEach((a) => {
      const key = a.dataReferencia.toISOString().slice(0, 10);
      const uniq = `${a.opsId}_${key}`;
      if (!aaVistos.has(uniq)) {
        aaVistos.add(uniq);
        if (!mapa[key]) mapa[key] = { faltas: 0, atestados: 0 };
        mapa[key].atestados += 1;
      }
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
    const { inicio, fim, empresaId, setorNome, turnoNome, status } = req.query;
    const empresaIds = req.query.empresaIds ? [].concat(req.query.empresaIds) : [];
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId : null;
    const extras = { setorNome, turnoNome, statusColaborador: status };

    if (!inicio || !fim) return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate   = dateOnlyBrasil(fim);

    const [faltas, atestados, aaRegistros] = await Promise.all([
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
      // AA (atestado de acompanhamento) não tem tabela própria — vem só da frequência, contado como atestado
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioDate, fimDate, empresaId, estacaoId, extras, empresaIds, ["AA"]),
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
          status: c.status,
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
          status: c.status,
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

    /* AA (atestado de acompanhamento) — conta como atestado, 1 dia cada */
    aaRegistros.forEach((a) => {
      const c = a.colaborador;
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
          status: c.status,
          diasDsrEscala: c.escala?.diasDsr || [],
          tempoCasa: getFaixaTempoCasa(c.dataAdmissao, fimDate),
          diasFaltas: new Set(),
          totalAtestados: 0,
          diasAfastados: 0,
        };
      }
      mapa[c.opsId].totalAtestados += 1;
      mapa[c.opsId].diasAfastados  += 1;
    });

    /* recorrência: mesma lógica do resumo — olha o mês calendário inteiro
       de referência, não só o período filtrado (senão um filtro de 1 dia
       nunca mostraria ninguém como recorrente). */
    const { inicioMes, fimMes } = getMesReferencia(fimDate);
    const [faltasMesRec, atestadosMesRec, aaMesRec] = await Promise.all([
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioMes, fimMes, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true, dataReferencia: true },
      }),
      prisma.atestadoMedico.findMany({
        where: buildWhereAtestado(inicioMes, fimMes, empresaId, estacaoId, extras, empresaIds),
        select: { opsId: true },
      }),
      prisma.frequencia.findMany({
        where: buildWhereFrequencia(inicioMes, fimMes, empresaId, estacaoId, extras, empresaIds, ["AA"]),
        select: { opsId: true, dataReferencia: true },
      }),
    ]);

    const mapaAusenciasMes = {};
    new Set(faltasMesRec.map(f => `${f.opsId}_${f.dataReferencia}`)).forEach((chave) => {
      const opsId = chave.split("_")[0];
      mapaAusenciasMes[opsId] = (mapaAusenciasMes[opsId] || 0) + 1;
    });
    atestadosMesRec.forEach(a => { mapaAusenciasMes[a.opsId] = (mapaAusenciasMes[a.opsId] || 0) + 1; });
    new Set(aaMesRec.map(a => `${a.opsId}_${a.dataReferencia}`)).forEach((chave) => {
      const opsId = chave.split("_")[0];
      mapaAusenciasMes[opsId] = (mapaAusenciasMes[opsId] || 0) + 1;
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
          status:         c.status,
          tempoCasa:      c.tempoCasa,
          diaFolgaDsr,
          totalFaltas,
          totalAtestados: c.totalAtestados,
          diasAfastados:  c.diasAfastados,
          totalAusencias,
          recorrencia:    (mapaAusenciasMes[c.opsId] || 0) >= 2,
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
