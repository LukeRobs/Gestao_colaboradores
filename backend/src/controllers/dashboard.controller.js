const { prisma } = require("../config/database");
const { getDateOperacional } = require("../utils/dateOperacional");
const { buscarDwPlanejado } = require("../services/googleSheetsDW.service");
const { buscarDwPlanejadoBanco } = require("../services/dwPlanejado.service");
const { buscarDwPlanejadoCalculadoraBatch } = require("../services/googleSheetsCalculadora.service");

const ESTACAO_SHEETS = 1;

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
  // Aceita tanto "T1" quanto formas por extenso como "TURNO 1" (com ou sem espaço)
  const match = v.match(/T\D*(\d+)/);
  return match ? `T${match[1]}` : "Sem turno";
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

const initTurnoMap = (turnoNomes = ["T1", "T2", "T3"]) =>
  Object.fromEntries([...turnoNomes, "Sem turno"].map((t) => [t, {}]));

/* =====================================================
   STATUS DO DIA — PADRÃO ADMIN (COM 4 ESTADOS OPERACIONAIS)
===================================================== */
function getStatusDoDiaOperacional(f) {
  // DSR/FO/AM/AA têm prioridade máxima — mesmo que haja horaEntrada
  if (f?.tipoAusencia) {
    const codigo = String(f.tipoAusencia.codigo || "").toUpperCase();

    if (codigo === "DSR") {
      return { label: "DSR", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }
    if (codigo === "FO") {
      return { label: "Folga", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }
    // Atestado médico tem prioridade sobre horaEntrada (batida pode ser erro de registro)
    if (codigo === "AM" || codigo === "AA") {
      return { label: "Atestado Médico", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };
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
      case "AB":
        return { label: "Licença - Atestado de Óbito", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "JE":
        return { label: "Licença - Justiça Eleitoral", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "S1":
        return { label: "Sinergia Enviada", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };
      case "BH":
        return { label: "Banco de Horas", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };

      // Ausências que impactam absenteísmo
      case "AM":
      case "AA":
        return { label: "Atestado Médico", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };
      case "F":
      case "FJ":
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
    const { data, dataInicio, dataFim, turno: turnoFiltroRaw } = req.query;
    // Normaliza para a forma canônica (T1/T2/T3) — o front pode enviar o nome
    // por extenso da estação (ex: "TURNO 2") como veio do cadastro de turnos.
    const turnoFiltro = turnoFiltroRaw ? normalizeTurno(turnoFiltroRaw) : turnoFiltroRaw;

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
            colaboradoresPlanejados: 0,
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
    const [colaboradores, empresas, turnos, escalasAtivas, frequenciasPeriodo, historicoMovs, cargos] =
      await Promise.all([
        prisma.colaborador.findMany({
          where: {
            // Inclui ativos + desligados no dia do início do período em diante (para preservar histórico)
            OR: [
              { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] }, dataDesligamento: null },
              { dataDesligamento: { gte: inicio } },
            ],
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
            atestadosMedicos: {
              where: {
                status: "ATIVO",
                dataInicio: { lte: fim },
                dataFim: { gte: inicio },
              },
            },
          },
        }),

        prisma.empresa.findMany(),
        prisma.turno.findMany({
          where: !req.dbContext?.isGlobal && req.dbContext?.estacaoId
            ? { OR: [{ idEstacao: req.dbContext.estacaoId }, { idEstacao: null }] }
            : {},
        }),
        prisma.escala.findMany({ where: { ativo: true } }),

        prisma.frequencia.findMany({
          where: {
            dataReferencia: { gte: inicio, lte: fim },
            // Sem filtro de status — inclui desligados que estavam ativos no período
            colaborador: {
              ...(!req.dbContext?.isGlobal && req.dbContext?.estacaoId
                ? { idEstacao: req.dbContext.estacaoId }
                : {}),
            },
          },
          include: {
            colaborador: { include: { turno: true, setor: true, cargo: true, empresa: true, lider: true, escala: true } },
            tipoAusencia: true,
            setor: true,
          },
          orderBy: { dataReferencia: "asc" },
        }),

        // Histórico de mudanças de cargo — busca TODAS as movimentações (incluindo futuras ao período)
        // pois uma mudança futura indica qual era o cargo anterior durante o período
        prisma.historicoMovimentacao.findMany({
          where: {
            cargoAnterior: { not: null },
            cargoNovo: { not: null },
          },
          select: { opsId: true, cargoAnterior: true, cargoNovo: true, dataEfetivacao: true },
          orderBy: { dataEfetivacao: "asc" },
        }),

        prisma.cargo.findMany({ select: { idCargo: true, nomeCargo: true } }),
      ]);

    // Mapa idCargo → nomeCargo
    const cargoNomeMap = new Map(cargos.map((c) => [c.idCargo, c.nomeCargo]));

    // Mapa opsId → histórico de mudanças de cargo (ordenado por data asc)
    const historicoCargoMap = {};
    historicoMovs.forEach((m) => {
      if (!historicoCargoMap[m.opsId]) historicoCargoMap[m.opsId] = [];
      historicoCargoMap[m.opsId].push(m);
    });

    // Retorna o idCargo que o colaborador tinha em determinada data
    function getCargoIdNoDia(opsId, data, cargoAtualId) {
      const movs = historicoCargoMap[opsId];
      if (!movs || !movs.length) return cargoAtualId;

      const cargoChanges = movs.filter(
        (m) => m.cargoAnterior !== null && m.cargoNovo !== null && m.cargoAnterior !== m.cargoNovo
      );
      if (!cargoChanges.length) return cargoAtualId;

      const d = new Date(data);
      let cargoId = null;

      for (const mov of cargoChanges) {
        if (new Date(mov.dataEfetivacao) <= d) {
          cargoId = mov.cargoNovo;
        } else {
          break;
        }
      }

      // Se todas as mudanças ocorreram APÓS a data, o cargo era o anterior à primeira mudança
      if (cargoId === null) return cargoChanges[0].cargoAnterior;
      return cargoId;
    }

    function isCargoElegivelNoDia(opsId, data, cargoAtualId) {
      const cargoId = getCargoIdNoDia(opsId, data, cargoAtualId);
      const nomeCargo = cargoNomeMap.get(cargoId) || "";
      return isCargoElegivel(nomeCargo);
    }

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
       4️⃣ AGREGADORES
    =============================== */
    // Turnos operacionais cadastrados no banco — filtrado pela estação atual.
    // Normalizado para a forma canônica (T1/T2/T3) para casar com o turno
    // resolvido por colaborador via normalizeTurno(), independente do nome
    // cadastrado ser "T1" ou por extenso ("TURNO 1").
    const turnoNomes = [...new Set(turnos.map((t) => normalizeTurno(t.nomeTurno)))];
    // Prioriza o turno da estação atual; cai para idEstacao=null se não houver específico
    const _estacaoIdParaMap = req.dbContext?.isGlobal ? null : (req.dbContext?.estacaoId ?? null);
    const turnoIdMap = {};
    for (const t of turnos) {
      const chave = normalizeTurno(t.nomeTurno);
      if (!turnoIdMap[chave] || t.idEstacao === _estacaoIdParaMap) {
        turnoIdMap[chave] = t.idTurno;
      }
    }

    const turnoSetorAgg = {};
    const generoPorTurno = initTurnoMap(turnoNomes);
    const generoPorTurnoSeen = Object.fromEntries(
      [...turnoNomes, "Sem turno"].map((t) => [t, new Set()])
    );
    const tempoCasaPorTurno = initTurnoMap(turnoNomes);
    const statusPorTurno = initTurnoMap(turnoNomes);
    // Companion de statusPorTurno: mesma estrutura, mas guarda os colaboradores
    // de cada status (não só a contagem) para o modal "ver quem" no frontend.
    const statusColaboradoresListPorTurno = initTurnoMap(turnoNomes);
    function pushStatusColab(turno, label, c) {
      statusPorTurno[turno] = statusPorTurno[turno] || {};
      statusPorTurno[turno][label] = (statusPorTurno[turno][label] || 0) + 1;

      statusColaboradoresListPorTurno[turno] = statusColaboradoresListPorTurno[turno] || {};
      if (!statusColaboradoresListPorTurno[turno][label]) {
        statusColaboradoresListPorTurno[turno][label] = [];
      }
      statusColaboradoresListPorTurno[turno][label].push({
        opsId: c.opsId,
        nome: c.nomeCompleto,
        setor: normalize(c.setor?.nomeSetor) || "Sem setor",
      });
    }
    const empresaPorTurno = initTurnoMap(turnoNomes);
    const ausenciasHoje = [];
    const presencasForaEscala = []; // status escalado lançado num dia que é DSR pela escala do colaborador
    const tendenciaPorDia = {}; // { data: { presentes, ausentes, escalados } }
    const DIAS_PT_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const distribuicaoVinculoPorTurno = Object.fromEntries(
      turnoNomes.map((t) => [t, { SPX: 0, BPO: 0 }])
    );
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
       PRÉ-PROCESSAMENTO: Deduplica por (opsId, dataReferencia)
       Quando um colaborador tem múltiplos registros no mesmo dia,
       aplica prioridade: DSR > FO > P/horaEntrada > outros > AM/AA > F/FJ
       Garante que ajustes manuais (ex: FO em feriado) sobrescrevam
       ausências automáticas (ex: AM do atestado).
    =============================== */
    const _prioridadeFreq = (f) => {
      const codigo = String(f.tipoAusencia?.codigo || "").toUpperCase();
      if (codigo === "DSR") return 0;
      if (codigo === "FO") return 1;
      if (f.horaEntrada || codigo === "P") return 2;
      if (["BH", "S1", "ON", "NC", "T", "FE", "AFA", "AF", "LM", "LP"].includes(codigo)) return 3;
      if (codigo === "AM" || codigo === "AA") return 4;
      if (codigo === "F" || codigo === "FJ") return 5;
      return 6;
    };

    const _freqDedupMap = new Map();
    for (const f of frequenciasPeriodo) {
      const opsId = f.colaborador?.opsId;
      if (!opsId) continue;
      const key = `${opsId}_${isoDate(f.dataReferencia)}`;
      const existing = _freqDedupMap.get(key);
      if (!existing || _prioridadeFreq(f) < _prioridadeFreq(existing)) {
        _freqDedupMap.set(key, f);
      }
    }
    const frequenciasDedup = [..._freqDedupMap.values()];

    // Set de (opsId_data) onde o admin lançou FO explícito — impede que a Seção 6.1
    // insira o AM da tabela de atestados quando o dia foi marcado como folga (ex: feriado).
    const _overrideAtestadoSet = new Set();
    for (const [key, f] of _freqDedupMap) {
      const codigo = String(f.tipoAusencia?.codigo || "").toUpperCase();
      if (codigo === "FO") _overrideAtestadoSet.add(key);
    }

    /* ===============================
       5️⃣ LOOP PRINCIPAL (ALINHADO AO ADMIN)
    =============================== */
    // Itera sobre registros dedupliciados — um por colaborador por dia
    frequenciasDedup
      .forEach((registroSnapshot) => {
      const c = registroSnapshot.colaborador;
      if (!c) return;

      // Ignora colaboradores desligados — mas inclui quem foi desligado NA data ou depois
      // (ex: desligado em 11/06 ainda deve aparecer no registro de 11/06, dia em que estava presente)
      const dataRefSnap = new Date(registroSnapshot.dataReferencia);
      const foiDesligadoDepois =
        c.dataDesligamento && new Date(c.dataDesligamento) >= dataRefSnap;
      if (!["ATIVO", "FERIAS", "AFASTADO"].includes(c.status) && !foiDesligadoDepois) return;

      // Verifica cargo na data do registro — colaborador pode ter mudado de cargo depois
      if (!isCargoElegivelNoDia(c.opsId, registroSnapshot.dataReferencia, c.cargo?.idCargo)) return;

      const turno = normalizeTurno(c.turno?.nomeTurno);
      if (turno === "Sem turno") return;
      if (turnoFiltro && turno !== turnoFiltro) return;

      const genero = normalize(c.genero) || "N/I";
      const empresa = normalize(c.empresa?.razaoSocial) || "Sem empresa";

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

      // 🏷️ SINALIZAÇÃO: lançamento escalado (Presente/Folga/etc) num dia que é
      // DSR pela escala do colaborador — ele não estava "planejado" pra hoje,
      // mas há um registro real. Não altera nenhuma contagem, só sinaliza.
      const diaSemanaSnap = new Date(registroSnapshot.dataReferencia).getUTCDay();
      const diasDsrSnap = c.escala?.diasDsr || [];
      if (diasDsrSnap.includes(diaSemanaSnap)) {
        presencasForaEscala.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          data: isoDate(registroSnapshot.dataReferencia),
          diaSemana: DIAS_PT_CURTO[diaSemanaSnap],
          turno,
          status: sSnap.label,
          escala: normalize(c.escala?.nomeEscala),
          setor: normalize(c.setor?.nomeSetor),
          empresa: normalize(c.empresa?.razaoSocial),
          lider: normalize(c.lider?.nomeCompleto),
        });
      }

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

      if (!generoPorTurnoSeen[turno].has(c.opsId)) {
        generoPorTurnoSeen[turno].add(c.opsId);
        generoPorTurno[turno][genero] = (generoPorTurno[turno][genero] || 0) + 1;

        const faixaTempoCasa = calcularTempoDeCasa(c.dataAdmissao).faixa;
        tempoCasaPorTurno[turno][faixaTempoCasa] =
          (tempoCasaPorTurno[turno][faixaTempoCasa] || 0) + 1;
      }

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
      const tempoCasa = calcularTempoDeCasa(c.dataAdmissao);
      // Status do snapshot (4 estados)
      pushStatusColab(turno, sSnap.label, c);

      if (sSnap.label === "Presente") {
        turnoSetorAgg[turno].presentes++;
        // Conta setor apenas para presentes
        turnoSetorAgg[turno].setores[setor] =
          (turnoSetorAgg[turno].setores[setor] || 0) + 1;
      } else if (sSnap.impactaAbsenteismo) {
        turnoSetorAgg[turno].ausentes++;  

        // Lista de ausências do dia (Falta / Atestado)
        const DIAS_PT_AUSENCIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const diasFolga = (c.escala?.diasDsr || []).length > 0
          ? c.escala.diasDsr.map((d) => DIAS_PT_AUSENCIA[d] ?? d).join("/")
          : "-";
        ausenciasHoje.push({
          colaboradorId: c.opsId,
          nome: c.nomeCompleto,
          data: isoDate(registroSnapshot.dataReferencia),
          turno,
          motivo: sSnap.label, // "Falta" | "Atestado Médico"
          setor: normalize(c.setor?.nomeSetor),
          empresa: normalize(c.empresa?.razaoSocial),
          admissao: c.dataAdmissao,
          lider: normalize(c.lider?.nomeCompleto),
          origem: sSnap.origem,
          tempoCasa: tempoCasa.faixa,
          diasCasa: tempoCasa.dias,
          diasFolga,
        });
      }
    });

    /* ===============================
       6️⃣ KPIs (absenteísmo no período igual Admin)
    =============================== */
    let totalHcAptoDias = 0;
    let totalAusenciasDias = 0;

    frequenciasDedup.forEach((f) => {
      // Usa f.colaborador diretamente — inclui desligados que estavam ativos no período
      const c = f.colaborador;
      if (!c) return;

      // Alinhado à Seção 5: registro sem tipo e sem hora não é lançamento real
      if (isRegistroVazio(f)) return;

      // Alinhado à Seção 5: inclui INATIVO apenas no dia do desligamento ou antes
      const dataRefSnap6 = new Date(f.dataReferencia);
      const foiDesligadoDepois6 = c.dataDesligamento && new Date(c.dataDesligamento) >= dataRefSnap6;
      if (!["ATIVO", "FERIAS", "AFASTADO"].includes(c.status) && !foiDesligadoDepois6) return;

      // Verifica cargo na data do registro — colaborador pode ter mudado de cargo depois
      if (!isCargoElegivelNoDia(c.opsId, f.dataReferencia, c.cargo?.idCargo)) return;

      const turnoColab = normalizeTurno(c.turno?.nomeTurno);
      if (turnoFiltro && turnoColab !== turnoFiltro) return;

      const s = getStatusDoDiaOperacional(f);
      const dataRef = isoDate(f.dataReferencia);

      // HC APTO + tendenciaPorDia (mesma fonte = card e curva sempre iguais)
      if (s.contaComoEscalado) {
        totalHcAptoDias++;

        if (!tendenciaPorDia[dataRef]) {
          tendenciaPorDia[dataRef] = { data: dataRef, presentes: 0, ausentes: 0, escalados: 0 };
        }
        tendenciaPorDia[dataRef].escalados++;

        if (s.impactaAbsenteismo) {
          totalAusenciasDias++;
          tendenciaPorDia[dataRef].ausentes++;
        } else if (s.label === "Presente") {
          tendenciaPorDia[dataRef].presentes++;
        }
      }
    });

    /* ===============================
       6️⃣.1 ATESTADOS MÉDICOS (origem: atestadosMedicos)
       Colaboradores com AM via tabela separada não têm registro em frequenciasPeriodo
       — precisam entrar em ausenciasHoje manualmente
    =============================== */
    const ausenciasSet = new Set(
      ausenciasHoje.map((a) => `${a.colaboradorId}_${a.data}`)
    );

    const DIAS_PT_ATES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (const c of colaboradores) {
      if (!c.atestadosMedicos?.length) continue;
      if (!isCargoElegivel(c.cargo?.nomeCargo)) continue;

      const turno = normalizeTurno(c.turno?.nomeTurno);
      if (turno === "Sem turno") continue;
      if (turnoFiltro && turno !== turnoFiltro) continue;

      const tempoCasa = calcularTempoDeCasa(c.dataAdmissao);
      const diasFolga =
        (c.escala?.diasDsr || []).length > 0
          ? c.escala.diasDsr.map((d) => DIAS_PT_ATES[d] ?? d).join("/")
          : "-";

      for (const atestado of c.atestadosMedicos) {
        // Itera cada dia do período coberto pelo atestado que se sobrepõe ao range do dashboard
        const cur = new Date(
          Math.max(new Date(atestado.dataInicio).getTime(), inicio.getTime())
        );
        const fimAtes = new Date(
          Math.min(new Date(atestado.dataFim).getTime(), fim.getTime())
        );

        while (cur <= fimAtes) {
          // Pula dias após o desligamento — colaborador INATIVO não conta como ausente
          if (c.dataDesligamento && cur > new Date(c.dataDesligamento)) {
            cur.setUTCDate(cur.getUTCDate() + 1);
            continue;
          }

          // Pula dias de DSR — colaborador está de folga, não é ausência
          const diaSemana = cur.getUTCDay();
          const ehDiaDSR = (c.escala?.diasDsr || []).includes(diaSemana);
          if (ehDiaDSR) {
            cur.setUTCDate(cur.getUTCDate() + 1);
            continue;
          }

          const dataStr = isoDate(cur);
          const key = `${c.opsId}_${dataStr}`;

          if (!ausenciasSet.has(key) && !_overrideAtestadoSet.has(key)) {
            ausenciasHoje.push({
              colaboradorId: c.opsId,
              nome: c.nomeCompleto,
              data: dataStr,
              turno,
              motivo: "Atestado Médico",
              setor: normalize(c.setor?.nomeSetor),
              empresa: normalize(c.empresa?.razaoSocial),
              admissao: c.dataAdmissao,
              lider: normalize(c.lider?.nomeCompleto),
              origem: "atestado",
              tempoCasa: tempoCasa.faixa,
              diasCasa: tempoCasa.dias,
              diasFolga,
            });
            ausenciasSet.add(key);

            // Colaborador tem atestado mas sem registro AM na frequência:
            // sincroniza status e KPIs para que status card = tabela de ausentes
            if (!turnoFiltro || turno === turnoFiltro) {
              pushStatusColab(turno, "Atestado Médico", c);

              if (!turnoSetorAgg[turno]) {
                turnoSetorAgg[turno] = { turno, totalEscalados: 0, presentes: 0, ausentes: 0, setores: {} };
              }
              turnoSetorAgg[turno].totalEscalados++;
              turnoSetorAgg[turno].ausentes++;

              totalHcAptoDias++;
              totalAusenciasDias++;

              const dataRefStr = dataStr;
              if (!tendenciaPorDia[dataRefStr]) {
                tendenciaPorDia[dataRefStr] = { data: dataRefStr, presentes: 0, ausentes: 0, escalados: 0 };
              }
              tendenciaPorDia[dataRefStr].escalados++;
              tendenciaPorDia[dataRefStr].ausentes++;
            }
          }

          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    }

    // Calculado APÓS seção 6.1 para incluir atestados sem registro em frequencia
    const absenteismoPeriodo =
      totalHcAptoDias > 0
        ? Number(((totalAusenciasDias / totalHcAptoDias) * 100).toFixed(2))
        : 0;

/* ===============================
   6️⃣.2 DATAS NO PERÍODO (compartilhado com 7️⃣.1 e 6️⃣.3)
=============================== */
const datasNoPeriodo = [];
{
  const cur = new Date(isoDate(inicio) + "T00:00:00.000Z");
  const fimDate = new Date(isoDate(fim) + "T00:00:00.000Z");
  while (cur <= fimDate) {
    datasNoPeriodo.push(isoDate(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

/* ===============================
   6️⃣.3 COLABORADORES PLANEJADOS (DISPONIBILIDADE REAL)
   Conta todo colaborador ativo/elegível cujo dia da semana não seja um dia
   de DSR da sua escala E que não tenha lançamento real indicando férias/
   afastamento/licença/AB/JE (contaComoEscalado=false) — quem está em uma
   dessas licenças não estava de fato disponível pra ser escalado no dia.
   Usado apenas no card "Colaboradores Planejados" — não altera
   totalEscalados (base de ausências/absenteísmo/tendência). A soma das
   categorias do card "Status dos Colaboradores" deve sempre bater com
   este total.
=============================== */
const colaboradoresPlanejadosPorTurno = Object.fromEntries(turnoNomes.map((t) => [t, 0]));

colaboradores.forEach((c) => {
  const foiDesligadoDepois = c.dataDesligamento && new Date(c.dataDesligamento) >= inicio;
  if (!["ATIVO", "FERIAS", "AFASTADO"].includes(c.status) && !foiDesligadoDepois) return;

  const turno = normalizeTurno(c.turno?.nomeTurno);
  if (turno === "Sem turno") return;
  if (turnoFiltro && turno !== turnoFiltro) return;

  const diasDsr = c.escala?.diasDsr || [];
  const admissao = c.dataAdmissao ? new Date(c.dataAdmissao) : null;
  const desligamento = c.dataDesligamento ? new Date(c.dataDesligamento) : null;

  for (const dataStr of datasNoPeriodo) {
    const dia = new Date(`${dataStr}T00:00:00.000Z`);

    if (admissao && dia < admissao) continue;
    if (desligamento && dia > desligamento) continue;
    if (!isCargoElegivelNoDia(c.opsId, dia, c.cargo?.idCargo)) continue;

    const diaSemana = dia.getUTCDay();
    const ehDiaDsr = diasDsr.includes(diaSemana);

    // Dia planejado sem lançamento real de frequência (ou registro vazio) — não sabemos
    // se é falta, atraso no lançamento ou turno ainda em andamento. Mostra como categoria
    // separada no card de Status apenas para visibilidade, SEM contar como ausência/falta
    // e SEM entrar em totalHcAptoDias/totalAusenciasDias/empresaPorTurno/tendenciaPorDia.
    const key = `${c.opsId}_${dataStr}`;
    const freqRecord = _freqDedupMap.get(key);
    const semLancamento = !freqRecord || isRegistroVazio(freqRecord);
    const sSnapPlan = !semLancamento ? getStatusDoDiaOperacional(freqRecord) : null;

    // FERIAS/AFASTADO sem lançamento real não estavam disponíveis para ser escalados
    if (semLancamento && ["FERIAS", "AFASTADO"].includes(c.status) && !foiDesligadoDepois) continue;

    if (ehDiaDsr) {
      // Dia de folga na escala — só entra em "Planejados" se há lançamento real
      // de trabalho (colaborador trabalhou fora da escala); sem isso não é planejado.
      if (!sSnapPlan || !sSnapPlan.contaComoEscalado) continue;
    } else {
      // Lançamento real de férias/afastamento/licença/AB/JE — colaborador não estava
      // disponível pra ser escalado nesse dia, então não entra em "Planejados".
      if (sSnapPlan && !sSnapPlan.contaComoEscalado) continue;
    }

    colaboradoresPlanejadosPorTurno[turno] += 1;

    if (semLancamento && !ausenciasSet.has(key)) {
      pushStatusColab(turno, "Sem Lançamento", c);
    }
  }
});

const totalColaboradoresPlanejados = Object.values(
  colaboradoresPlanejadosPorTurno
).reduce((a, b) => a + b, 0);

/* ===============================
   7️⃣ DIARISTAS PRESENTES (REAIS)
=============================== */
const diaristasPresentes = Object.fromEntries(turnoNomes.map((t) => [t, 0]));
const estacaoIdDash = req.dbContext?.isGlobal ? null : (req.dbContext?.estacaoId ?? null);

await Promise.all(
  turnoNomes.map(async (turno) => {
    try {
      const turnoId = turnoIdMap[turno];
      if (!turnoId) return;

      const whereReal = {
        AND: [
          { data: { gte: new Date(isoDate(inicio) + "T00:00:00.000Z") } },
          { data: { lte: new Date(isoDate(fim) + "T00:00:00.000Z") } },
          { idTurno: turnoId },
          ...(estacaoIdDash ? [{ idEstacao: estacaoIdDash }] : []),
        ],
      };

      const diaristasReais = await prisma.dwReal.findMany({ where: whereReal });

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
   7️⃣.1 DIARISTAS PLANEJADOS
=============================== */
const diaristasPlanejadosPorTurno = Object.fromEntries(turnoNomes.map((t) => [t, 0]));

// datasNoPeriodo já calculado na seção 6️⃣.2

// Mapa de turno nome → número (T1→1, T2→2, T3→3) para lookup na Calculadora
// A Calculadora usa TURNO_COL = {1:3, 2:4, 3:5} que corresponde ao número do turno, não ao idTurno do banco
const turnoNumeroMap = {};
for (const t of turnoNomes) {
  const m = t.match(/(\d+)$/);
  if (m) turnoNumeroMap[t] = Number(m[1]);
}

console.log("📌 estacaoIdDash:", estacaoIdDash, "ESTACAO_SHEETS:", ESTACAO_SHEETS, "match:", estacaoIdDash === ESTACAO_SHEETS);
console.log("📌 turnoIdMap:", turnoIdMap);
console.log("📌 turnoNumeroMap:", turnoNumeroMap);

for (const turno of turnoNomes) {
  try {
    if (!estacaoIdDash) {
      // Contexto global sem estação: busca no Sheets daily_plan
      let total = 0;
      for (const dataStr of datasNoPeriodo) {
        const resultado = await buscarDwPlanejado(turno, dataStr);
        total += Number(resultado?.data?.dwPlanejado || 0);
      }
      diaristasPlanejadosPorTurno[turno] = total;
    } else if (Number(estacaoIdDash) === ESTACAO_SHEETS) {
      // Estação 1: busca na aba Calculadora (mesma fonte do Daily Works)
      // Usa o número do turno (T1→1, T2→2, T3→3) que é o que TURNO_COL espera
      const turnoNum = turnoNumeroMap[turno];
      if (!turnoNum) continue;
      const requests = datasNoPeriodo.map((dataStr) => ({ dataISO: dataStr, idTurno: turnoNum }));
      const resultMap = await buscarDwPlanejadoCalculadoraBatch(requests);
      let total = 0;
      for (const dataStr of datasNoPeriodo) {
        total += resultMap.get(`${dataStr}_${turnoNum}`) || 0;
      }
      console.log(`📌 Calculadora ${turno} (turnoNum=${turnoNum}):`, total);
      diaristasPlanejadosPorTurno[turno] = total;
    } else {
      // Demais estações: busca no banco
      const turnoId = turnoIdMap[turno];
      if (!turnoId) continue;
      const registros = await prisma.dwPlanejado.findMany({
        where: {
          data: { gte: new Date(isoDate(inicio) + "T00:00:00.000Z"), lte: new Date(isoDate(fim) + "T00:00:00.000Z") },
          idTurno: turnoId,
          idEstacao: estacaoIdDash,
        },
      });
      diaristasPlanejadosPorTurno[turno] = registros.reduce((sum, r) => sum + (r.quantidade ?? 0), 0);
    }
  } catch (err) {
    console.warn(`⚠️ DW Planejado falhou para ${turno}:`, err.message);
    diaristasPlanejadosPorTurno[turno] = 0;
  }
}

console.log("📌 turnoNomes:", turnoNomes);
console.log("📌 diaristasPlanejadosPorTurno:", diaristasPlanejadosPorTurno);
console.log("📌 diaristasPresentes:", diaristasPresentes);

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
const aderenciaDwPorTurno = Object.fromEntries(
  turnoNomes.map((t) => [
    t,
    diaristasPlanejadosPorTurno[t] > 0
      ? Number(((diaristasPresentes[t] / diaristasPlanejadosPorTurno[t]) * 100).toFixed(2))
      : 0,
  ])
);

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

        distribuicaoVinculoPorTurno: Object.fromEntries(
          turnoNomes.map((t) => [
            t,
            [
              { name: "SPX", value: distribuicaoVinculoPorTurno[t]?.SPX || 0 },
              { name: "BPO", value: distribuicaoVinculoPorTurno[t]?.BPO || 0 },
            ],
          ])
        ),

        // adiciona período (padrão Admin)
        periodo: { inicio: isoDate(inicio), fim: isoDate(fim) },

        // KPIs alinhados ao Admin
        kpis: {
          totalColaboradores: totalHcAptoDias,
          colaboradoresPlanejados: totalColaboradoresPlanejados,
          presentes: totalHcAptoDias - totalAusenciasDias,
          ausencias: totalAusenciasDias,
          diaristasPlanejados: totalDiaristasPlanejados,
          diaristasPresentes: totalDiaristasPresentes,
          aderenciaDW,
          absenteismo: absenteismoPeriodo,
          presencasForaEscala: presencasForaEscala.length,
        },

        presencasForaEscala,

        distribuicaoTurnoSetor: turnoNomes.map((turno) => {
          const t = turnoSetorAgg[turno] || { turno, totalEscalados: 0, presentes: 0, ausentes: 0, setores: {} };
          return {
            ...t,
            colaboradoresPlanejados: colaboradoresPlanejadosPorTurno[turno] || 0,
            diaristasPlanejados: diaristasPlanejadosPorTurno[turno] || 0,
            diaristasPresentes: diaristasPresentes[turno] || 0,
            aderenciaDW: aderenciaDwPorTurno[turno] || 0,
            setores: Object.entries(t.setores).map(([setor, quantidade]) => ({
              setor,
              quantidade,
            })),
          };
        }),

        generoPorTurno: Object.fromEntries(
          Object.entries(generoPorTurno).map(([t, g]) => [
            t,
            Object.entries(g).map(([name, value]) => ({ name, value })),
          ])
        ),

        tempoCasaPorTurno: Object.fromEntries(
          Object.entries(tempoCasaPorTurno).map(([t, g]) => [
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
              colaboradores: (statusColaboradoresListPorTurno[t]?.[status] || [])
                .slice()
                .sort((a, b) => a.nome.localeCompare(b.nome)),
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
