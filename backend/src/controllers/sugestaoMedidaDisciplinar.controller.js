/**
 * Controller de Sugestões de Medida Disciplinar
 */

const { prisma } = require("../config/database")
const { StatusMedidaDisciplinar } = require("@prisma/client")
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response")
const { detectarFaltasAutomatico } = require("../services/detectarFaltasAutomatico.service")
const { gerarOnboardingColaborador } = require("../services/dsrBackfill.service")

/* =====================================================
   CONTADORES POR STATUS
===================================================== */

const getContadores = async (req, res) => {

  try {

    const { dataInicio, dataFim, turno, lider } = req.query;

    const baseWhere = {};
    const colaboradorFilter = {};

    // Filtro de estação — igual ao getAllSugestoes
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      colaboradorFilter.idEstacao = req.dbContext.estacaoId;
    }

    if (dataInicio || dataFim) {
      baseWhere.dataReferencia = {};
      if (dataInicio) baseWhere.dataReferencia.gte = new Date(`${dataInicio}T00:00:00`);
      if (dataFim)    baseWhere.dataReferencia.lte = new Date(`${dataFim}T23:59:59`);
    }

    if (turno) colaboradorFilter.idTurno = Number(turno);
    if (lider) colaboradorFilter.idLider = lider;

    if (Object.keys(colaboradorFilter).length > 0) {
      baseWhere.colaborador = { is: colaboradorFilter };
    }

    const [pendente, rejeitada, aprovada] = await Promise.all([
      prisma.sugestaoMedidaDisciplinar.count({ where: { ...baseWhere, status: "PENDENTE" } }),
      prisma.sugestaoMedidaDisciplinar.count({ where: { ...baseWhere, status: "REJEITADA" } }),
      prisma.sugestaoMedidaDisciplinar.count({ where: { ...baseWhere, status: "APROVADA" } }),
    ]);

    return successResponse(res, { PENDENTE: pendente, REJEITADA: rejeitada, APROVADA: aprovada });

  } catch (err) {

    console.error("❌ GET CONTADORES SUGESTOES:", err);
    return errorResponse(res, "Erro ao buscar contadores", 500);

  }

};


/* =====================================================
   LISTAR SUGESTÕES
===================================================== */

const getAllSugestoes = async (req, res) => {

  try {

    const { status, opsId, dataInicio, dataFim, turno, lider } = req.query;

    const where = {};
    const colaboradorFilter = {};

    // Filtro de estação
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      colaboradorFilter.idEstacao = req.dbContext.estacaoId;
    }

    /* ==============================
       FILTRO STATUS
    ============================== */

    if (status) {

      where.status = status;

    }
    // sem filtro de status padrão — retorna todos (PENDENTE, REJEITADA, APROVADA)

    /* ==============================
       FILTRO OPS ID
    ============================== */

    if (opsId) {
      where.opsId = opsId;
    }

    /* ==============================
       FILTRO DATA (PERÍODO)
    ============================== */

    if (dataInicio || dataFim) {
      where.dataReferencia = {};
      if (dataInicio) where.dataReferencia.gte = new Date(`${dataInicio}T00:00:00`);
      if (dataFim)    where.dataReferencia.lte = new Date(`${dataFim}T23:59:59`);
    }

    /* ==============================
       FILTRO TURNO
    ============================== */

    if (turno) {

      colaboradorFilter.idTurno = Number(turno);

    }

    /* ==============================
       FILTRO LIDERANÇA
    ============================== */

    if (lider) {

      colaboradorFilter.idLider = lider;

    }

    /* ==============================
       APLICAR FILTRO COLABORADOR
    ============================== */

    if (Object.keys(colaboradorFilter).length > 0) {

      where.colaborador = {
        is: colaboradorFilter
      };

    }

    /* ==============================
       BUSCAR SUGESTÕES
    ============================== */

    const sugestoes = await prisma.sugestaoMedidaDisciplinar.findMany({

      where,

      orderBy: {
        dataReferencia: "desc",
      },

      include: {

        colaborador: {
          select: {
            opsId: true,
            nomeCompleto: true,
            matricula: true,
            idTurno: true,
            idLider: true,
            turno: {
              select: { nomeTurno: true },
            },
            lider: {
              select: { nomeCompleto: true },
            },
          },
        },

        frequencia: true,

      },

    });

    // Buscar emails dos usuários que aprovaram/rejeitaram
    const opsIds = [...new Set(sugestoes.map(s => s.aprovadoPor).filter(Boolean))];

    let emailMap = {};
    if (opsIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { opsId: { in: opsIds } },
        select: { opsId: true, email: true },
      });
      emailMap = Object.fromEntries(users.map(u => [u.opsId, u.email]));
    }

    const result = sugestoes.map(s => ({
      ...s,
      aprovadoPorEmail: s.aprovadoPor === "SISTEMA"
        ? "SISTEMA"
        : (emailMap[s.aprovadoPor] ?? s.aprovadoPor ?? null),
    }));

    return successResponse(res, result);

  } catch (err) {

    console.error("❌ GET SUGESTOES:", err);

    return errorResponse(
      res,
      "Erro ao buscar sugestões",
      500
    );

  }

};


/* =====================================================
   APROVAR SUGESTÃO
===================================================== */

const aprovarSugestao = async (req, res) => {

  try {

    const { id } = req.params

    const sugestao = await prisma.sugestaoMedidaDisciplinar.findUnique({
      where: { idSugestao: Number(id) },
    })

    if (!sugestao) {
      return notFoundResponse(res, "Sugestão não encontrada")
    }

    if (sugestao.status !== "PENDENTE") {
      return errorResponse(res, "Sugestão já processada", 400)
    }

    /* ===========================
       BUSCAR COLABORADOR
    =========================== */

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId: sugestao.opsId },
      select: {
        nomeCompleto: true,
        matricula: true,
      },
    })

    if (!colaborador) {
      return errorResponse(res, "Colaborador não encontrado", 400)
    }

    const dataOcorrencia = new Date(sugestao.dataReferencia)

    /* ===========================
       EVITAR DUPLICIDADE
    =========================== */

    const medidaExistente = await prisma.medidaDisciplinar.findFirst({
      where: {
        opsId: sugestao.opsId,
        violacao: sugestao.violacao,
        dataOcorrencia: dataOcorrencia,
        status: {
          in: [
            StatusMedidaDisciplinar.PENDENTE_ASSINATURA,
            StatusMedidaDisciplinar.ASSINADO
          ]
        }
      },
    })

    if (medidaExistente) {
      return errorResponse(
        res,
        `Já existe uma medida disciplinar ativa para esta ocorrência (${new Date(medidaExistente.dataOcorrencia).toLocaleDateString("pt-BR")}, ${medidaExistente.origem === "MANUAL" ? "criada manualmente" : "gerada pelo sistema"})`,
        400
      )
    }

    /* ===========================
       DETERMINAR MEDIDA PELO NÚMERO DE OCORRÊNCIAS
       Mesma progressão do detector:
         0 anteriores → 1ª ocorrência → PRIMEIRA_OCORRENCIA
         1 anterior   → 2ª ocorrência → REINCIDENCIA (menor diasSuspensao)
         2+ anteriores → 3ª+ ocorrência → REINCIDENCIA (maior diasSuspensao)
         4+ dias consecutivos → análise manual (preserva consequencia da sugestão)
    =========================== */

    const diasConsecutivos = sugestao.diasConsecutivos ?? 1;

    // 4+ dias: sugestão foi criada com DESLIGAMENTO_ANALISE_JURIDICA como flag.
    // Preservar a consequencia da sugestão sem re-escalar automaticamente.
    const ehAnaliseRH = diasConsecutivos >= 4;

    let tipoMedida, diasSuspensao, nivelViolacao, idMatriz;

    if (ehAnaliseRH) {
      tipoMedida    = sugestao.consequencia;
      diasSuspensao = sugestao.diasSuspensao ?? null;
      nivelViolacao = "ALTA";
      idMatriz      = null;
    } else {
      // Contar ocorrências anteriores para determinar o degrau
      const historicoResult = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM medida_disciplinar
        WHERE ops_id    = ${sugestao.opsId}
          AND violacao  = ${sugestao.violacao}
          AND status::text <> 'CANCELADA'
      `;
      const anteriores    = historicoResult[0]?.count ?? 0;
      const numOcorrencia = anteriores + 1;

      let matriz = null;

      if (numOcorrencia === 1) {
        matriz = await prisma.matrizMedidaDisciplinar.findFirst({
          where: { violacao: sugestao.violacao, frequencia: "PRIMEIRA_OCORRENCIA" },
        });
      } else {
        const reincidencias = await prisma.matrizMedidaDisciplinar.findMany({
          where: { violacao: sugestao.violacao, frequencia: "REINCIDENCIA" },
          orderBy: { diasSuspensao: "asc" },
        });
        if (reincidencias.length > 0) {
          matriz = numOcorrencia === 2
            ? reincidencias[0]
            : reincidencias[reincidencias.length - 1];
        }
      }

      // Fallback
      if (!matriz) {
        matriz = await prisma.matrizMedidaDisciplinar.findFirst({
          where: { violacao: sugestao.violacao },
        });
      }

      tipoMedida    = matriz?.consequencia  ?? sugestao.consequencia;
      diasSuspensao = matriz?.diasSuspensao ?? sugestao.diasSuspensao;
      nivelViolacao = matriz?.nivelViolacao  ?? "BAIXA";
      idMatriz      = matriz?.idMatriz       ?? null;
    }

    /* ===========================
       CRIAR MEDIDA DISCIPLINAR
    =========================== */

    const medida = await prisma.$transaction(async (tx) => {

      const novaMedida = await tx.medidaDisciplinar.create({

        data: {

          opsId: sugestao.opsId,

          nivelViolacao,

          violacao: sugestao.violacao,

          tipoMedida,

          diasSuspensao,

          motivo: (() => {
            if (ehAnaliseRH) {
              return `Requer análise manual do RH — ${diasConsecutivos} dias consecutivos de falta (aprovado pelo usuário após revisão)`;
            }
            if (diasConsecutivos > 1) {
              return `Gerado automaticamente pelo sistema — ${diasConsecutivos} dias consecutivos de falta`;
            }
            return "Gerado automaticamente pelo sistema";
          })(),

          dataOcorrencia,

          dataAplicacao: new Date(),

          origem: "SISTEMA",

          status: "PENDENTE_ASSINATURA",

          registradoPor: req.user?.opsId || "SISTEMA",

          idMatriz,

        },

        include: {

          colaborador: {
            select: {
              nomeCompleto: true,
              matricula: true,
            },
          },

          matriz: true,

        },

      })

      await tx.sugestaoMedidaDisciplinar.update({

        where: { idSugestao: sugestao.idSugestao },

        data: {
          status: "APROVADA",
          aprovadoPor: req.user?.opsId || "SISTEMA",
        },

      })

      return novaMedida

    })

    return createdResponse(
      res,
      medida,
      "Medida disciplinar criada"
    )

  } catch (err) {

    console.error("❌ APROVAR SUGESTAO:", err)

    return errorResponse(
      res,
      "Erro ao aprovar sugestão",
      500
    )

  }

}


/* =====================================================
   REJEITAR SUGESTÃO
===================================================== */

const rejeitarSugestao = async (req, res) => {

  try {

    const { id } = req.params

    const sugestao = await prisma.sugestaoMedidaDisciplinar.findUnique({
      where: { idSugestao: Number(id) },
    })

    if (!sugestao) {
      return notFoundResponse(res, "Sugestão não encontrada")
    }

    if (sugestao.status !== "PENDENTE") {
      return errorResponse(res, "Sugestão já processada", 400)
    }

    await prisma.sugestaoMedidaDisciplinar.update({

      where: { idSugestao: sugestao.idSugestao },

      data: {
        status: "REJEITADA",
        aprovadoPor: req.user?.opsId || "SISTEMA",
      },

    })

    return successResponse(
      res,
      null,
      "Sugestão rejeitada"
    )

  } catch (err) {

    console.error("❌ REJEITAR SUGESTAO:", err)

    return errorResponse(
      res,
      "Erro ao rejeitar sugestão",
      500
    )

  }

}


/* =====================================================
   CRIAR SUGESTÃO MANUAL
===================================================== */

const createSugestao = async (req, res) => {

  try {

    const {
      opsId,
      dataReferencia,
      violacao,
      consequencia,
      diasSuspensao,
    } = req.body

    if (!opsId || !violacao || !consequencia) {
      return errorResponse(
        res,
        "Campos obrigatórios não informados",
        400
      )
    }

    if (!dataReferencia || isNaN(new Date(dataReferencia))) {
      return errorResponse(res, "dataReferencia inválida (YYYY-MM-DD)", 400)
    }

    const sugestao = await prisma.sugestaoMedidaDisciplinar.create({

      data: {

        opsId,

        dataReferencia: new Date(dataReferencia),

        violacao,

        consequencia,

        diasSuspensao,

      },

    })

    return createdResponse(
      res,
      sugestao,
      "Sugestão criada"
    )

  } catch (err) {

    console.error("❌ CREATE SUGESTAO:", err)

    return errorResponse(
      res,
      "Erro ao criar sugestão",
      500
    )

  }

}

/* =====================================================
   BACKFILL — processar datas passadas manualmente
   POST /medidas-disciplinares/sugestoes/backfill
   Body: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" }
   Apenas ADMIN
===================================================== */

const backfillFaltas = async (req, res) => {

  try {

    // Se não informar datas, usa os últimos 31 dias até hoje (horário SP)
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = agoraSP.toISOString().slice(0, 10);

    const trintaDiasAtras = new Date(agoraSP);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 31);
    const trintaDiasAtrasStr = trintaDiasAtras.toISOString().slice(0, 10);

    const dataInicio = req.body?.dataInicio || trintaDiasAtrasStr;
    const dataFim    = req.body?.dataFim    || hojeStr;

    const inicio = new Date(dataInicio);
    const fim    = new Date(dataFim);

    if (isNaN(inicio) || isNaN(fim)) {
      return errorResponse(res, "Datas inválidas", 400);
    }

    if (fim < inicio) {
      return errorResponse(res, "dataFim deve ser >= dataInicio", 400);
    }

    const diffDias = Math.ceil((fim - inicio) / 86400000);
    if (diffDias > 31) {
      return errorResponse(res, "Intervalo máximo de 31 dias por chamada", 400);
    }

    // Filtro de estação: não-global usa a estação do contexto
    const estacaoId = !req.dbContext?.isGlobal && req.dbContext?.estacaoId
      ? req.dbContext.estacaoId
      : null;

    const resultado = await detectarFaltasAutomatico(dataInicio, dataFim, estacaoId);

    return successResponse(res, resultado, "Backfill concluído");

  } catch (err) {

    console.error("❌ BACKFILL FALTAS:", err);
    return errorResponse(res, "Erro ao executar backfill", 500);

  }

};

/* =====================================================
   BACKFILL ONBOARDING — gera ON para colaboradores sem ON
   POST /medidas-disciplinares/sugestoes/backfill-onboarding
   Body: { dataAdmissaoMinima: "YYYY-MM-DD" }  (default: 2026-01-02)
   Apenas ADMIN
===================================================== */

const backfillOnboarding = async (req, res) => {

  try {

    const { dataAdmissaoMinima = "2026-01-02" } = req.body;

    const minima = new Date(`${dataAdmissaoMinima}T00:00:00`);

    if (isNaN(minima)) {
      return errorResponse(res, "dataAdmissaoMinima inválida (YYYY-MM-DD)", 400);
    }

    const whereColaborador = {
      dataAdmissao: { gte: minima },
      // Isolamento por estação: ADMIN global processa todas, senão só a sua
      ...(!req.dbContext?.isGlobal && req.dbContext?.estacaoId
        ? { idEstacao: req.dbContext.estacaoId }
        : {}),
    };

    const colaboradores = await prisma.colaborador.findMany({
      where: whereColaborador,
      select: { opsId: true, dataAdmissao: true },
    });

    let processados = 0;
    let erros = 0;

    for (const col of colaboradores) {
      if (!col.dataAdmissao) continue;
      try {
        await gerarOnboardingColaborador({ opsId: col.opsId, dataAdmissao: col.dataAdmissao });
        processados++;
      } catch (e) {
        console.error(`⚠️ Erro ON para ${col.opsId}:`, e.message);
        erros++;
      }
    }

    return successResponse(res, { processados, erros }, "Backfill de onboarding concluído");

  } catch (err) {

    console.error("❌ BACKFILL ONBOARDING:", err);
    return errorResponse(res, "Erro ao executar backfill de onboarding", 500);

  }

};

module.exports = {

  getContadores,
  getAllSugestoes,
  aprovarSugestao,
  rejeitarSugestao,
  createSugestao,
  backfillFaltas,
  backfillOnboarding,

}