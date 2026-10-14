const { prisma } = require("../config/database");
const { successResponse, errorResponse, notFoundResponse } = require("../utils/response");
const { getStatusDocas } = require("../services/mapaOperacional/dockManagementSheets.service");
const { validarColaboradorElegivel, contextoDaOperacao } = require("../services/mapaOperacional/colaboradorElegibilidade.service");
const { calcularSaldoDiaristas } = require("./mapaOperacional.controller");
const { avaliarConflitoDoca, avaliarConflitoTime } = require("../services/mapaOperacional/alocacaoConflito.service");
const { getTurnoOperacionalAtual } = require("../utils/turnoMapaOperacional");
const { MINUTOS_SEM_VEICULO } = require("../services/mapaOperacional/docaAutoLiberacao.service");

const OPERACAO_LABEL = { INBOUND: "Recebimento", OUTBOUND: "Expedição" };
// LOG II e Volante existem nas duas operações, igual às esteiras.
const FUNCOES_POR_OPERACAO = { INBOUND: ["RECEIVED", "PULL", "LOG_II", "VOLANTE"], OUTBOUND: ["CONFERENTE", "PUSH", "LOG_II", "VOLANTE"] };
const FUNCAO_PARA_LABOR = {
  RECEIVED: "DOCK_RECEIVED",
  PULL: "DOCK_PULL",
  CONFERENTE: "DOCK_CONFERENTE",
  PUSH: "DOCK_PUSH",
  LOG_II: "DOCK_LOG_II",
  VOLANTE: "DOCK_VOLANTE",
};

const colaboradorSelect = {
  opsId: true,
  nomeCompleto: true,
  cargo: { select: { nomeCargo: true } },
};

function laborDoTime(time) {
  if (time.tipo === "FIFO") return "DOCK_FIFO";
  return time.operacao === "INBOUND" ? "DOCK_RECEIVED" : "DOCK_CONFERENTE";
}

async function buscarAlocacoesAtivas(idEstacao) {
  const alocacoes = await prisma.mapaAlocacao.findMany({
    where: { idEstacao, numeroDoca: { not: null }, fim: null },
    include: {
      colaborador: { select: colaboradorSelect },
      time: { include: { integrantes: { include: { colaborador: { select: colaboradorSelect } } } } },
    },
  });
  return new Map(alocacoes.map((a) => [a.numeroDoca, a]));
}

// O nome da doca no pátio já traz "Inbound"/"Outbound" (ex: "Doca Inbound LH
// 81") — é a zona física fixa daquele número, não uma escolha do COPEOPLE.
// Usamos isso só como fallback: se já existe um time/colaborador alocado
// pelo COPEOPLE, a operação registrada por quem alocou manda; sem alocação
// nenhuma, a doca com caminhão físico (planilha) ainda deve aparecer
// OCUPADA — senão a tela mostraria "Disponível" pra doca com carro docado,
// só porque ninguém formalizou o time ainda.
function derivarOperacaoSheet(nomeSheet) {
  if (!nomeSheet) return null;
  if (/inbound/i.test(nomeSheet)) return "INBOUND";
  if (/outbound/i.test(nomeSheet)) return "OUTBOUND";
  return null;
}

function estadoDoca(sheet, alocacao) {
  if (alocacao) return { ocupada: true, operacao: alocacao.operacaoDoca, fonte: "MANUAL" };
  if (sheet?.fisicamenteOcupada) return { ocupada: true, operacao: derivarOperacaoSheet(sheet.nomeSheet), fonte: "SHEET" };
  return { ocupada: false, operacao: null, fonte: null };
}

function montarDoca(numero, sheet, alocacao) {
  const estado = estadoDoca(sheet, alocacao);
  return {
    numero,
    sheet: sheet || null,
    ocupada: estado.ocupada,
    operacao: estado.operacao,
    fonteOcupacao: estado.fonte,
    alocacao: alocacao
      ? {
          idAlocacao: alocacao.idAlocacao,
          labor: alocacao.labor,
          diarista: alocacao.diarista,
          colaborador: alocacao.colaborador,
          time: alocacao.time
            ? {
                idTime: alocacao.time.idTime,
                nome: alocacao.time.nome,
                tipo: alocacao.time.tipo,
                turno: alocacao.time.turno,
                integrantes: alocacao.time.integrantes.map((i) => ({
                  funcao: i.funcao,
                  colaborador: i.colaborador,
                })),
              }
            : null,
          inicio: alocacao.inicio,
        }
      : null,
  };
}

/* =====================================================
   DOCAS (grid + indicadores)
===================================================== */
const listarDocas = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const [statusMap, alocPorNumero] = await Promise.all([getStatusDocas(), buscarAlocacoesAtivas(idEstacao)]);

    const numeros = new Set([...statusMap.keys(), ...alocPorNumero.keys()]);
    const docas = [...numeros]
      .sort((a, b) => a - b)
      .map((numero) => montarDoca(numero, statusMap.get(numero), alocPorNumero.get(numero)));

    const indicadores = {
      total: docas.length,
      disponiveis: docas.filter((d) => !d.ocupada).length,
      ocupadas: docas.filter((d) => d.ocupada).length,
      recebimento: docas.filter((d) => d.operacao === "INBOUND").length,
      expedicao: docas.filter((d) => d.operacao === "OUTBOUND").length,
      bloqueadas: 0,
    };

    return successResponse(res, { indicadores, docas });
  } catch (err) {
    console.error("❌ Erro ao listar docas:", err);
    return errorResponse(res, "Erro ao listar docas", 500);
  }
};

const obterDoca = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const numero = Number(req.params.numero);

    const [statusMap, alocPorNumero, historico] = await Promise.all([
      getStatusDocas(),
      buscarAlocacoesAtivas(idEstacao),
      prisma.mapaDocaHistorico.findMany({
        where: { idEstacao, numeroDoca: numero },
        orderBy: { criadoEm: "desc" },
        take: 20,
      }),
    ]);

    const doca = montarDoca(numero, statusMap.get(numero), alocPorNumero.get(numero));
    return successResponse(res, { ...doca, historico, liberacaoAutomaticaMinutos: MINUTOS_SEM_VEICULO });
  } catch (err) {
    console.error("❌ Erro ao obter doca:", err);
    return errorResponse(res, "Erro ao obter doca", 500);
  }
};

/* =====================================================
   ALOCAR / LIBERAR DOCA
===================================================== */
const alocarDoca = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const numero = Number(req.params.numero);
    const { operacao, idTime, opsId, diarista, funcao, confirmarSubstituicao = false } = req.body;

    if (!["INBOUND", "OUTBOUND"].includes(operacao)) {
      return errorResponse(res, "Informe a operação (INBOUND ou OUTBOUND)", 400);
    }

    const [ativaAgora, statusMap] = await Promise.all([
      prisma.mapaAlocacao.findFirst({ where: { idEstacao, numeroDoca: numero, fim: null } }),
      getStatusDocas(),
    ]);
    const estado = estadoDoca(statusMap.get(numero), ativaAgora);

    if (estado.ocupada && estado.operacao && estado.operacao !== operacao) {
      return errorResponse(
        res,
        `Doca ${numero} está em operação de ${OPERACAO_LABEL[estado.operacao]} e não pode ser utilizada pela ${OPERACAO_LABEL[operacao]} enquanto estiver ocupada.`,
        400
      );
    }
    // Já tem TIME/colaborador formalizado pelo COPEOPLE na mesma operação —
    // isso sim é "já tem uma operação ativa", bloqueia. Se a doca só está
    // ocupada fisicamente (planilha) sem ninguém alocado ainda, deixa passar:
    // é exatamente o caso de formalizar quem está trabalhando o caminhão.
    if (ativaAgora) {
      return errorResponse(res, `Doca ${numero} indisponível. Existe uma operação ativa nesta doca.`, 400);
    }

    const now = new Date();
    let dadosAlocacao;
    let historicoExtra = {};

    if (idTime) {
      const time = await prisma.timeOperacional.findFirst({ where: { idTime: Number(idTime), idEstacao, ativo: true } });
      if (!time) return notFoundResponse(res, "Time não encontrado");
      if (time.operacao !== operacao) {
        return errorResponse(
          res,
          `Este time é de ${OPERACAO_LABEL[time.operacao]} e não pode ser alocado numa doca de ${OPERACAO_LABEL[operacao]}.`,
          400
        );
      }

      const timeEmOutraDoca = await prisma.mapaAlocacao.findFirst({ where: { idEstacao, idTime: time.idTime, fim: null } });
      if (timeEmOutraDoca) {
        return errorResponse(res, `Este time já está alocado na Doca ${timeEmOutraDoca.numeroDoca}.`, 400);
      }

      const integrantes = await prisma.timeIntegrante.findMany({
        where: { idTime: time.idTime },
        include: { colaborador: { select: { nomeCompleto: true } } },
      });
      const conflitoTime = await avaliarConflitoTime({ integrantes });
      if (conflitoTime) return errorResponse(res, conflitoTime.mensagem, 400, { codigo: conflitoTime.codigo });

      dadosAlocacao = { labor: laborDoTime(time), idTime: time.idTime, opsId: null, diarista: false };
      historicoExtra = { idTime: time.idTime, nomeTime: time.nome };
    } else {
      const isDiarista = !!diarista;
      const permitidas = FUNCOES_POR_OPERACAO[operacao];
      if (!funcao || !permitidas.includes(funcao)) {
        return errorResponse(res, `Função inválida para essa operação — use: ${permitidas.join(" ou ")}`, 400);
      }

      if (!isDiarista) {
        if (!opsId) return errorResponse(res, "Informe o colaborador (opsId) ou marque diarista", 400);
        const { colaborador, erro } = await validarColaboradorElegivel(opsId, { contexto: contextoDaOperacao(operacao) });
        if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");
        if (erro) return errorResponse(res, erro, 400);

        // packing automático / outra esteira bloqueiam; outra doca ou função pede a confirmação do líder
        const conflito = await avaliarConflitoDoca({ colaborador, numeroDoca: numero, labor: FUNCAO_PARA_LABOR[funcao] });
        if (conflito) {
          const precisaConfirmar = conflito.codigo === "CONFIRMAR_SUBSTITUICAO";
          if (!precisaConfirmar || !confirmarSubstituicao) {
            return errorResponse(res, conflito.mensagem, precisaConfirmar ? 409 : 400, { codigo: conflito.codigo, atual: conflito.atual });
          }
        }

        await prisma.mapaAlocacao.updateMany({ where: { opsId, fim: null }, data: { fim: now } });
      } else {
        const { turno: turnoAtual, diaOperacional } = getTurnoOperacionalAtual();
        const saldo = await calcularSaldoDiaristas(idEstacao, diaOperacional, turnoAtual);
        if (saldo.disponiveis <= 0) {
          return errorResponse(
            res,
            `Não há diaristas disponíveis — ${saldo.total} lançados no Daily Works e ${saldo.alocados} já alocados neste turno.`,
            400
          );
        }
      }

      dadosAlocacao = {
        labor: FUNCAO_PARA_LABOR[funcao],
        idTime: null,
        opsId: isDiarista ? null : opsId,
        diarista: isDiarista,
      };
    }

    await prisma.mapaAlocacao.create({
      data: {
        idEstacao,
        numeroDoca: numero,
        operacaoDoca: operacao,
        origem: "MANUAL",
        ...dadosAlocacao,
      },
    });

    await prisma.mapaDocaHistorico.create({
      data: {
        idEstacao,
        numeroDoca: numero,
        acao: "ALOCADA",
        operacao,
        usuarioId: req.user?.id,
        usuarioNome: req.user?.name,
        ...historicoExtra,
      },
    });

    const alocPorNumero = await buscarAlocacoesAtivas(idEstacao);
    return successResponse(res, montarDoca(numero, statusMap.get(numero), alocPorNumero.get(numero)), "Doca alocada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao alocar doca:", err);
    return errorResponse(res, "Erro ao alocar doca", 500);
  }
};

const liberarDoca = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const numero = Number(req.params.numero);

    const ativa = await prisma.mapaAlocacao.findFirst({
      where: { idEstacao, numeroDoca: numero, fim: null },
      include: { time: { select: { nome: true } } },
    });
    if (!ativa) return notFoundResponse(res, "Nenhuma alocação ativa nesta doca");

    await prisma.mapaAlocacao.update({ where: { idAlocacao: ativa.idAlocacao }, data: { fim: new Date() } });

    await prisma.mapaDocaHistorico.create({
      data: {
        idEstacao,
        numeroDoca: numero,
        acao: "LIBERADA",
        operacao: ativa.operacaoDoca,
        idTime: ativa.idTime,
        nomeTime: ativa.time?.nome,
        usuarioId: req.user?.id,
        usuarioNome: req.user?.name,
      },
    });

    return successResponse(res, null, "Doca liberada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao liberar doca:", err);
    return errorResponse(res, "Erro ao liberar doca", 500);
  }
};

/* =====================================================
   ADICIONAR PESSOA DIRETO NA DOCA
   - Doca com TIME: a pessoa entra no time (fica no cadastro de Equipes, não só nesta doca).
   - Doca com pessoa AVULSA: cria um time com ela + a nova pessoa e passa a alocação da doca para esse time.
   Diarista avulso não vira time (não tem cadastro): libere e aloque um time.
===================================================== */
const LABOR_PARA_FUNCAO = Object.fromEntries(Object.entries(FUNCAO_PARA_LABOR).map(([funcao, labor]) => [labor, funcao]));

async function validarEntradaNoTime({ idEstacao, colaboradorOps, operacao, turno, idTimeAtual }) {
  const { colaborador, erro } = await validarColaboradorElegivel(colaboradorOps, { contexto: contextoDaOperacao(operacao), turno });
  if (!colaborador) return { status: 404, mensagem: "Colaborador não encontrado" };
  if (erro) return { status: 400, mensagem: erro };

  // Uma pessoa só pode estar em um time; time excluído não conta.
  const emOutroTime = await prisma.timeIntegrante.findFirst({
    where: { opsId: colaboradorOps, ...(idTimeAtual ? { idTime: { not: idTimeAtual } } : {}), time: { idEstacao, ativo: true } },
    include: { time: { select: { nome: true, turno: true } } },
  });
  if (emOutroTime) {
    return {
      status: 400,
      mensagem: `${colaborador.nomeCompleto} já faz parte do time "${emOutroTime.time.nome}" (${emOutroTime.time.turno}). Remova-o de lá antes de adicionar neste time.`,
    };
  }
  return { colaborador };
}

const adicionarPessoaNaDoca = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const numero = Number(req.params.numero);
    const { opsId, funcao } = req.body;
    if (!opsId) return errorResponse(res, "Informe o colaborador (opsId)", 400);

    const ativa = await prisma.mapaAlocacao.findFirst({
      where: { idEstacao, numeroDoca: numero, fim: null },
      include: { time: true, colaborador: { select: { opsId: true, nomeCompleto: true } } },
    });
    if (!ativa) return errorResponse(res, "A doca não tem equipe alocada. Aloque uma equipe antes de adicionar pessoas.", 400);
    if (ativa.diarista) {
      return errorResponse(res, "Esta doca está com um diarista avulso. Libere a doca e aloque uma equipe para poder adicionar pessoas.", 400);
    }

    const operacao = ativa.operacaoDoca;
    const permitidas = FUNCOES_POR_OPERACAO[operacao] || [];
    const fifo = ativa.time?.tipo === "FIFO";
    if (!fifo && (!funcao || !permitidas.includes(funcao))) {
      return errorResponse(res, `Função inválida para essa doca — use: ${permitidas.join(" ou ")}`, 400);
    }

    const montarResposta = async () => {
      const [statusMap, alocPorNumero] = await Promise.all([getStatusDocas(), buscarAlocacoesAtivas(idEstacao)]);
      return montarDoca(numero, statusMap.get(numero), alocPorNumero.get(numero));
    };

    /* ---------- Doca com time: entra no time ---------- */
    if (ativa.time) {
      const time = ativa.time;
      const ja = await prisma.timeIntegrante.findUnique({ where: { idTime_opsId: { idTime: time.idTime, opsId } } });
      if (ja) return errorResponse(res, "Essa pessoa já faz parte do time", 400);

      const v = await validarEntradaNoTime({ idEstacao, colaboradorOps: opsId, operacao, turno: time.turno, idTimeAtual: time.idTime });
      if (!v.colaborador) return v.status === 404 ? notFoundResponse(res, v.mensagem) : errorResponse(res, v.mensagem, v.status);

      // O time já está na doca: quem entra não pode estar em esteira ou em packing automático.
      const conflito = await avaliarConflitoTime({ integrantes: [{ opsId, colaborador: { nomeCompleto: v.colaborador.nomeCompleto } }] });
      if (conflito) return errorResponse(res, conflito.mensagem, 400, { codigo: conflito.codigo });

      await prisma.timeIntegrante.create({ data: { idTime: time.idTime, opsId, funcao: fifo ? null : funcao } });
      return successResponse(res, await montarResposta(), `${v.colaborador.nomeCompleto} entrou no time ${time.nome}`);
    }

    /* ---------- Doca com pessoa avulsa: vira um time ---------- */
    if (!ativa.opsId || !ativa.colaborador) return errorResponse(res, "Esta doca não tem uma pessoa alocada para formar o time.", 400);
    if (ativa.opsId === opsId) return errorResponse(res, "Essa pessoa já está alocada nesta doca.", 400);

    const funcaoAtual = LABOR_PARA_FUNCAO[ativa.labor];
    if (!funcaoAtual) return errorResponse(res, "Não foi possível identificar a função de quem está na doca.", 400);

    const { turno: turnoAtual } = getTurnoOperacionalAtual();
    const vAtual = await validarEntradaNoTime({ idEstacao, colaboradorOps: ativa.opsId, operacao, turno: turnoAtual, idTimeAtual: null });
    if (!vAtual.colaborador) return errorResponse(res, vAtual.mensagem, vAtual.status === 404 ? 404 : 400);
    const vNovo = await validarEntradaNoTime({ idEstacao, colaboradorOps: opsId, operacao, turno: turnoAtual, idTimeAtual: null });
    if (!vNovo.colaborador) return vNovo.status === 404 ? notFoundResponse(res, vNovo.mensagem) : errorResponse(res, vNovo.mensagem, vNovo.status);

    const conflito = await avaliarConflitoTime({ integrantes: [{ opsId, colaborador: { nomeCompleto: vNovo.colaborador.nomeCompleto } }] });
    if (conflito) return errorResponse(res, conflito.mensagem, 400, { codigo: conflito.codigo });

    const agora = new Date();
    const nomeBase = `Doca ${numero} · ${OPERACAO_LABEL[operacao]} · ${turnoAtual}`;
    const carimbo = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(agora);
    const nome = `${nomeBase} · ${carimbo}`.slice(0, 100);

    const novoTime = await prisma.$transaction(async (tx) => {
      const time = await tx.timeOperacional.create({
        data: {
          idEstacao,
          nome,
          operacao,
          tipo: "OPERACIONAL",
          turno: turnoAtual,
          integrantes: { create: [{ opsId: ativa.opsId, funcao: funcaoAtual }, { opsId, funcao }] },
        },
      });
      // Mesmo início da alocação anterior: a regra de liberação automática por veículo continua valendo.
      await tx.mapaAlocacao.update({ where: { idAlocacao: ativa.idAlocacao }, data: { fim: agora } });
      await tx.mapaAlocacao.create({
        data: {
          idEstacao,
          numeroDoca: numero,
          operacaoDoca: operacao,
          origem: "MANUAL",
          labor: laborDoTime(time),
          idTime: time.idTime,
          opsId: null,
          diarista: false,
          inicio: ativa.inicio,
        },
      });
      await tx.mapaDocaHistorico.create({
        data: {
          idEstacao,
          numeroDoca: numero,
          acao: "ALOCADA",
          operacao,
          idTime: time.idTime,
          nomeTime: time.nome,
          usuarioId: req.user?.id,
          usuarioNome: req.user?.name,
        },
      });
      return time;
    });

    return successResponse(res, await montarResposta(), `Time "${novoTime.nome}" criado com ${ativa.colaborador.nomeCompleto} e ${vNovo.colaborador.nomeCompleto}`);
  } catch (err) {
    console.error("❌ Erro ao adicionar pessoa na doca:", err);
    return errorResponse(res, "Erro ao adicionar pessoa na doca", 500);
  }
};

module.exports = {
  listarDocas,
  obterDoca,
  alocarDoca,
  liberarDoca,
  adicionarPessoaNaDoca,
};
