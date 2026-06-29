/**
 * Controller de Colaborador
 */

const { prisma } = require("../config/database");
const csv = require("csvtojson");
const XLSX = require("xlsx");
const {
  successResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
  errorResponse,
  forbiddenResponse,
} = require("../utils/response");
const {
  gerarDSRBackfillColaborador,
  gerarDSRFuturoColaborador,
  gerarOnboardingColaborador,
  gerarFrequenciaDesligamento,
  gerarFrequenciaAfastamento,
  gerarNcPreAdmissao,
} = require("../services/dsrBackfill.service");


/* ================= HELPERS DE DATA (BR) ================= */
function startOfDayBR(date) {
  const d = date ? new Date(date) : agoraBrasil();
  d.setHours(0, 0, 0, 0);
  return d;
}

function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}


function aplicarStatusDinamico(colaborador) {
  if (!colaborador) return colaborador;

  const hoje = agoraBrasil(); // 🔥 usa Brasil
  hoje.setHours(0, 0, 0, 0);


  if (
    (colaborador.status === "FERIAS" ||
      colaborador.status === "AFASTADO") &&
    colaborador.dataFimStatus
  ) {
    const fim = new Date(colaborador.dataFimStatus);
    fim.setHours(0, 0, 0, 0);

    if (hoje > fim) {
      return {
        ...colaborador,
        status: "ATIVO",
      };
    }
  }

  return colaborador;
}

/* ================= GET ALL ================= */
const getAllColaboradores = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    idSetor,
    idCargo,
    idEmpresa,
    idLider,
    escala,
    turno,
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  // Filtro de estação — ADMIN/ALTA_GESTAO veem tudo
  if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
    where.idEstacao = req.dbContext.estacaoId;
  }

  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: "insensitive" } },
      { matricula: { contains: search, mode: "insensitive" } },
      { opsId: { contains: search, mode: "insensitive" } },
      { cpf: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status !== undefined && status !== "") {
    where.status = status;
  }
  if (idSetor) where.idSetor = Number(idSetor);
  if (idCargo) where.idCargo = Number(idCargo);
  if (idEmpresa) where.idEmpresa = Number(idEmpresa);
  if (idLider) where.idLider = idLider;
  if (escala) { where.escala = { nomeEscala: escala};} // A | B | C
  if (turno) {
    where.turno = {
      nomeTurno: turno, // "T1" | "T2" | "T3"
    };
  }


  try {
    const [data, total] = await Promise.all([
      prisma.colaborador.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { nomeCompleto: "asc" },
        include: {
          empresa: true,
          cargo: true,
          setor: true,
          turno: true,
          escala: {
            select: {
              idEscala: true,
              nomeEscala: true,
              descricao: true,
            },
          },
        },

      }),
      prisma.colaborador.count({ where }),
    ]);
    const dataAjustada = data.map(aplicarStatusDinamico);

    return paginatedResponse(res, dataAjustada, {
      page: Number(page),
      limit: Number(limit),
      total,
    });
  } catch (err) {
    console.error("❌ ERRO GET ALL:", err);
    return errorResponse(res, "Erro ao buscar colaboradores", 500, err);
  }
};
const getColaboradorByCpf = async (req, res) => {
  const { cpf } = req.params;

  const cpfLimpo = cpf.replace(/\D/g, "");

  if (cpfLimpo.length !== 11) {
    return errorResponse(res, "CPF inválido", 400);
  }

  let colaborador = await prisma.colaborador.findFirst({
    where: { cpf: cpfLimpo },
    include: {
      empresa: true,
      setor: true,
      cargo: true,
      turno: true,
      escala: true,
      lider: true,
    },
  });

  colaborador = aplicarStatusDinamico(colaborador);

  if (!colaborador) {
    return notFoundResponse(res, "Colaborador não encontrado");
  }

  return successResponse(res, colaborador);
};

/* ================= GET BY ID ================= */
const getColaboradorById = async (req, res) => {
  const { opsId } = req.params;
  const RESERVED = ["import", "create", "new"];

  if (RESERVED.includes(opsId)) {
    return errorResponse(res, "Rota inválida", 404);
  }

  try {
    let colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      include: {
        empresa: true,
        cargo: true,
        setor: true,
        turno: true,
        escala: true,
        lider: {
          select: {
            opsId: true,
            nomeCompleto: true,
          },
        },
        estacao: {
          include: {
            regional: true,
          },
        },
      },
    });

    // garante que dataInicioStatus/dataFimStatus estão disponíveis para o fallback
    // (aplicarStatusDinamico pode sobrescrever status mas mantém os outros campos)
    const statusOriginal = colaborador?.status;

    colaborador = aplicarStatusDinamico(colaborador);
    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    /* =====================================================
       INDICADORES — ATESTADOS (CORRETO + BR TIME)
    ===================================================== */

    // 📅 Hoje no padrão Brasil (sem UTC shift)
    const hoje = agoraBrasil();
    hoje.setHours(0, 0, 0, 0);

    const [totalAtestados, ativos, finalizados, listaAtestados, totalFaltas, listaFaltas, listaMDs, listaAusenciasStatus] = await Promise.all([
      prisma.atestadoMedico.count({
        where: { opsId },
      }),

      prisma.atestadoMedico.count({
        where: {
          opsId,
          status: "ATIVO",
          dataInicio: { lte: hoje },
          dataFim: { gte: hoje },
        },
      }),

      prisma.atestadoMedico.count({
        where: {
          opsId,
          status: "FINALIZADO",
        },
      }),

      prisma.atestadoMedico.findMany({
        where: { opsId },
        orderBy: { dataInicio: "desc" },
        select: {
          idAtestado: true,
          dataInicio: true,
          dataFim: true,
          diasAfastamento: true,
          cid: true,
          observacao: true,
          status: true,
          dataRegistro: true,
        },
      }),

      prisma.frequencia.count({
        where: {
          opsId,
          idTipoAusencia: { in: [3, 32] },
        },
      }),

      prisma.frequencia.findMany({
        where: {
          opsId,
          idTipoAusencia: { in: [3, 32] },
        },
        orderBy: { dataReferencia: "desc" },
        select: {
          idFrequencia: true,
          dataReferencia: true,
        },
      }),

      prisma.medidaDisciplinar.findMany({
        where: { opsId, status: "ASSINADO" },
        select: {
          dataOcorrencia: true,
          tipoMedida: true,
          status: true,
        },
      }),

      prisma.ausencia.findMany({
        where: {
          opsId,
          tipoAusencia: { codigo: { in: ['FE', 'AFA'] } },
        },
        include: { tipoAusencia: { select: { codigo: true, descricao: true } } },
        orderBy: { dataInicio: 'desc' },
      }),
    ]);

    /* =====================================================
      INDICADORES — TREINAMENTOS
    ===================================================== */

    const treinamentosParticipados =
      await prisma.treinamentoParticipante.findMany({
        where: {
          opsId,
          presente: true, // apenas quem realmente participou
        },
        include: {
          treinamento: {
            select: {
              tema: true,
              dataTreinamento: true,
            },
          },
        },
        orderBy: {
          treinamento: { dataTreinamento: "desc" },
        },
      });

    const treinamentosDTO = treinamentosParticipados.map((t) => ({
      tema: t.treinamento.tema,
      data: t.treinamento.dataTreinamento,
    }));

    /* =====================================================
       RESPOSTA FINAL (SEM QUEBRAR O FRONT)
    ===================================================== */
    return successResponse(res, {
      colaborador,

      vinculoOrganizacional: {
        empresa: colaborador.empresa?.razaoSocial || null,
        regional: colaborador.estacao?.regional?.nome || null,
        estacao: colaborador.estacao?.nomeEstacao || null,
        setor: colaborador.setor?.nomeSetor || null,
        turno: colaborador.turno?.nomeTurno || null,
        escala: colaborador.escala?.nomeEscala || null,
        cargo: colaborador.cargo?.nomeCargo || null,
        lider: colaborador.lider
          ? `${colaborador.lider.nomeCompleto} — ${colaborador.lider.opsId}`
          : null,
      },

      indicadores: {
        atestados: {
          total: totalAtestados,
          ativos,
          finalizados,
          itens: listaAtestados,
        },
        faltas: {
          total: totalFaltas,
          itens: listaFaltas.map((f) => {
            const dataFalta = new Date(f.dataReferencia).toDateString();
            const md = listaMDs.find(
              (m) => new Date(m.dataOcorrencia).toDateString() === dataFalta
            );
            return {
              idFrequencia: f.idFrequencia,
              data: f.dataReferencia,
              temMD: !!md,
              tipoMD: md?.tipoMedida || null,
              statusMD: md?.status || null,
            };
          }),
        },
        treinamentos: {
          total: treinamentosDTO.length,
          itens: treinamentosDTO,
        },
        ferias: {
          itens: (() => {
            const registros = listaAusenciasStatus
              .filter((a) => a.tipoAusencia.codigo === 'FE')
              .map((a) => ({ idAusencia: a.idAusencia, dataInicio: a.dataInicio, dataFim: a.dataFim, diasCorridos: a.diasCorridos, motivo: a.motivo, status: a.status }));
            // fallback: colaborador em FERIAS sem registro de ausência (usa statusOriginal pois aplicarStatusDinamico pode já ter virado ATIVO)
            if (statusOriginal === 'FERIAS' && colaborador.dataInicioStatus && colaborador.dataFimStatus) {
              const jaTemRegistro = registros.some(
                (r) => new Date(r.dataInicio).toDateString() === new Date(colaborador.dataInicioStatus).toDateString()
              );
              if (!jaTemRegistro) {
                const dias = Math.round((new Date(colaborador.dataFimStatus) - new Date(colaborador.dataInicioStatus)) / 86400000) + 1;
                registros.unshift({ idAusencia: 'status-atual', dataInicio: colaborador.dataInicioStatus, dataFim: colaborador.dataFimStatus, diasCorridos: dias, motivo: null, status: 'ATIVO' });
              }
            }
            return registros;
          })(),
        },
        afastamentos: {
          itens: (() => {
            const registros = listaAusenciasStatus
              .filter((a) => a.tipoAusencia.codigo === 'AFA')
              .map((a) => ({ idAusencia: a.idAusencia, dataInicio: a.dataInicio, dataFim: a.dataFim, diasCorridos: a.diasCorridos, motivo: a.motivo, status: a.status }));
            // fallback: colaborador em AFASTADO sem registro de ausência (usa statusOriginal pois aplicarStatusDinamico pode já ter virado ATIVO)
            if (statusOriginal === 'AFASTADO' && colaborador.dataInicioStatus && colaborador.dataFimStatus) {
              const jaTemRegistro = registros.some(
                (r) => new Date(r.dataInicio).toDateString() === new Date(colaborador.dataInicioStatus).toDateString()
              );
              if (!jaTemRegistro) {
                const dias = Math.round((new Date(colaborador.dataFimStatus) - new Date(colaborador.dataInicioStatus)) / 86400000) + 1;
                registros.unshift({ idAusencia: 'status-atual', dataInicio: colaborador.dataInicioStatus, dataFim: colaborador.dataFimStatus, diasCorridos: dias, motivo: null, status: 'ATIVO' });
              }
            }
            return registros;
          })(),
        },
      },
    });
  } catch (err) {
    console.error("❌ ERRO GET BY ID:", err);
    return errorResponse(res, "Erro ao buscar colaborador", 500, err);
  }
};


/* ================= LISTAR ESCALAS ================= */
const listarEscalas = async (req, res) => {
  try {
    const escalas = await prisma.escala.findMany({
      select: {
        idEscala: true,
        nomeEscala: true,
        descricao: true,
      },
      orderBy: {
        nomeEscala: "asc",
      },
    });

    return successResponse(res, escalas);
  } catch (err) {
    console.error("❌ ERRO LISTAR ESCALAS:", err);
    return errorResponse(res, "Erro ao listar escalas", 500);
  }
};

/* ================= CREATE ================= */
const createColaborador = async (req, res) => {
  try {
    const {
      opsId,
      nomeCompleto,
      cpf,
      telefone,
      email,
      genero,
      matricula,
      dataAdmissao,
      horarioInicioJornada,
      idEmpresa,
      idSetor,
      idCargo,
      idTurno,
      idEscala,
      status,
      contatoEmergenciaNome,
      contatoEmergenciaTelefone,
      idLider,
    } = req.body;

    /* ===============================
       VALIDAÇÕES BÁSICAS
    =============================== */

    if (!opsId || !nomeCompleto || !matricula || !dataAdmissao) {
      return errorResponse(
        res,
        "OPS ID, Nome, Matrícula e Data de Admissão são obrigatórios",
        400
      );
    }

    /* ===============================
       VERIFICAR OPS DUPLICADO
    =============================== */
    const opsExistente = await prisma.colaborador.findUnique({
      where: { opsId },
      select: { opsId: true, nomeCompleto: true },
    });

    if (opsExistente) {
      return errorResponse(
        res,
        `OPS inválido: o código "${opsId}" já está cadastrado para o colaborador "${opsExistente.nomeCompleto}"`,
        409
      );
    }

    if (!idEscala) {
      return errorResponse(res, "Escala é obrigatória", 400);
    }

    const escalaId = Number(idEscala);

    if (isNaN(escalaId)) {
      return errorResponse(res, "Escala inválida", 400);
    }

    /* ===============================
       DATA ADMISSÃO
    =============================== */

    let dataAdmissaoDate = null;

    if (dataAdmissao) {
      const dt = new Date(`${dataAdmissao}T00:00:00`);

      if (isNaN(dt.getTime())) {
        return errorResponse(res, "Data de admissão inválida", 400);
      }

      dataAdmissaoDate = dt;
    }

    /* ===============================
       HORÁRIO
    =============================== */

    let horario = null;

    if (horarioInicioJornada) {
      if (!/^\d{2}:\d{2}$/.test(horarioInicioJornada)) {
        return errorResponse(res, "Horário inválido. Use o formato HH:MM", 400);
      }

      horario = new Date(`1970-01-01T${horarioInicioJornada}:00Z`);
    } else {
      horario = new Date(`1970-01-01T05:25:00Z`);
    }

    /* ===============================
       CONTATO EMERGÊNCIA
    =============================== */

    const contatoEmergenciaNomeLimpo =
      contatoEmergenciaNome?.trim() || null;

    const contatoEmergenciaTelefoneLimpo =
      contatoEmergenciaTelefone?.trim() || null;

    /* ===============================
       DATA COLABORADOR
    =============================== */

    // Estação: usa a do dbContext (estação selecionada pelo ADMIN ou fixada para ALTA_GESTAO)
    const idEstacaoFinal = req.dbContext?.estacaoId ?? null;

    const data = {
      opsId,
      nomeCompleto,
      cpf: cpf || null,
      telefone: telefone || null,
      email: email || null,
      genero: genero || null,
      contatoEmergenciaNome: contatoEmergenciaNomeLimpo,
      contatoEmergenciaTelefone: contatoEmergenciaTelefoneLimpo,
      matricula,
      dataAdmissao: dataAdmissaoDate,
      horarioInicioJornada: horario,
      status: status || "ATIVO",

      ...(idEstacaoFinal
        ? { estacao: { connect: { idEstacao: idEstacaoFinal } } }
        : {}),

      ...(idEmpresa
        ? { empresa: { connect: { idEmpresa: Number(idEmpresa) } } }
        : {}),

      ...(idSetor
        ? { setor: { connect: { idSetor: Number(idSetor) } } }
        : {}),

      ...(idCargo
        ? { cargo: { connect: { idCargo: Number(idCargo) } } }
        : {}),

      ...(idTurno
        ? { turno: { connect: { idTurno: Number(idTurno) } } }
        : {}),

      ...(escalaId
        ? { escala: { connect: { idEscala: escalaId } } }
        : {}),

      ...(idLider
        ? { lider: { connect: { opsId: idLider } } }
        : {}),
    };

    /* ===============================
       TRANSACTION
    =============================== */

    let nomeEscalaCreate = null;
    let novoOpsId = null;

    const colaborador = await prisma.$transaction(async (tx) => {

      /* =========================
         CRIA COLABORADOR
      ========================= */
      const novo = await tx.colaborador.create({
        data,
      });

      /* =========================
         HISTÓRICO DE ESCALA
      ========================= */
      const hoje = startOfDayBR();

      await tx.colaboradorEscalaHistorico.create({
        data: {
          opsId: novo.opsId,
          idEscala: escalaId,
          dataInicio: hoje,
        },
      });

      /* =========================
         BUSCA ESCALA
      ========================= */
      const escalaCriada = await tx.escala.findUnique({
        where: { idEscala: escalaId },
        select: { nomeEscala: true },
      });

      /* =========================
         ONBOARDING (2 DIAS)
      ========================= */
      await gerarOnboardingColaborador({
        opsId: novo.opsId,
        dataAdmissao: dataAdmissaoDate || hoje,
        tx,
      });

      /* =========================
         NC PRÉ-ADMISSÃO
         Preenche os dias do mês antes da admissão com NC
      ========================= */
      await gerarNcPreAdmissao({
        opsId: novo.opsId,
        dataAdmissao: dataAdmissaoDate || hoje,
        tx,
      });

      nomeEscalaCreate = escalaCriada?.nomeEscala ?? null;
      novoOpsId = novo.opsId;

      return novo;
    }, { timeout: 30000 });

    /* =========================
       GERAR DSR FORA DA TRANSAÇÃO
       (evita timeout da tx para backfills longos)
    ========================= */
    if (nomeEscalaCreate && novoOpsId) {
      await gerarDSRBackfillColaborador({
        opsId: novoOpsId,
        nomeEscala: nomeEscalaCreate,
        dataInicio: dataAdmissaoDate,
        idEstacao: idEstacaoFinal,
      });
      await gerarDSRFuturoColaborador({
        opsId: novoOpsId,
        nomeEscala: nomeEscalaCreate,
        idEstacao: idEstacaoFinal,
      });
    }

    return createdResponse(
      res,
      colaborador,
      "Colaborador criado com sucesso"
    );

  } catch (err) {
    console.error("❌ ERRO CREATE:", err);

    if (err?.code === "P2002") {
      const campo = err?.meta?.target;
      const mensagens = {
        matricula: `Matrícula "${req.body?.matricula}" já está em uso por outro colaborador`,
        email: `E-mail "${req.body?.email}" já está em uso por outro colaborador`,
        ops_id: `OPS ID "${req.body?.opsId}" já está em uso`,
      };
      const campoChave = Array.isArray(campo) ? campo[0] : campo;
      const msg = mensagens[campoChave] ?? `Dado duplicado (${campoChave ?? "campo único"}): verifique matrícula, e-mail ou OPS ID`;
      return errorResponse(res, msg, 409);
    }

    return errorResponse(
      res,
      "Erro ao criar colaborador",
      500,
      err
    );
  }
};


const updateColaborador = async (req, res) => {
  const { opsId } = req.params;

  console.log("🔍 UPDATE COLABORADOR");
  console.log("opsId:", opsId);
  console.log("body:", req.body);

  if (!opsId || typeof opsId !== "string") {
    return errorResponse(res, "Ops ID inválido", 400);
  }

  try {
    // Isolamento por estação: ALTA_GESTAO só edita colaboradores da sua estação
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      const col = await prisma.colaborador.findUnique({
        where: { opsId },
        select: { idEstacao: true },
      });
      if (!col) return notFoundResponse(res, "Colaborador não encontrado");
      if (col.idEstacao !== req.dbContext.estacaoId) {
        return forbiddenResponse(res, "Colaborador não pertence à sua estação");
      }
    }
    const {
      nomeCompleto,
      cpf,
      email,
      telefone,
      genero,
      matricula,
      status,
      idEscala,
      idTurno,
      dataAdmissao,
      horarioInicioJornada,
      contatoEmergenciaNome,
      contatoEmergenciaTelefone,
      dataDesligamento,
      motivoDesligamento,
      tipoDesligamento,
      dataInicioStatus,
      dataFimStatus,
      idLider,
      cipa,
      gestante,
    } = req.body;

    const data = {};

    /* =============================
       CAMPOS SIMPLES
    ============================== */
    if (nomeCompleto !== undefined) data.nomeCompleto = nomeCompleto;
    if (cpf !== undefined) data.cpf = cpf || null;
    if (email !== undefined) data.email = email || null;
    if (telefone !== undefined) data.telefone = telefone || null;
    if (genero !== undefined) data.genero = genero || null;
    if (matricula !== undefined) data.matricula = matricula;
    if (status !== undefined) data.status = status;

    if (contatoEmergenciaNome !== undefined) {
      data.contatoEmergenciaNome = contatoEmergenciaNome?.trim() || null;
    }

    if (contatoEmergenciaTelefone !== undefined) {
      data.contatoEmergenciaTelefone =
        contatoEmergenciaTelefone?.trim() || null;
    }

    if (idLider !== undefined) {
      if (idLider) {
        data.lider = { connect: { opsId: idLider } };
      } else {
        data.lider = { disconnect: true };
      }
    }

    if (dataDesligamento !== undefined) data.dataDesligamento = dataDesligamento ? new Date(`${dataDesligamento}T00:00:00`) : null;
    if (motivoDesligamento !== undefined) data.motivoDesligamento = motivoDesligamento || null;
    if (tipoDesligamento !== undefined) data.tipoDesligamento = tipoDesligamento || null;
    if (dataInicioStatus !== undefined) data.dataInicioStatus = dataInicioStatus ? new Date(`${dataInicioStatus}T00:00:00`) : null;
    if (dataFimStatus !== undefined) data.dataFimStatus = dataFimStatus ? new Date(`${dataFimStatus}T00:00:00`) : null;
    if (cipa !== undefined) data.cipa = Boolean(cipa);
    if (gestante !== undefined) data.gestante = Boolean(gestante);

    if (dataAdmissao !== undefined) {
      data.dataAdmissao = dataAdmissao ? new Date(`${dataAdmissao}T00:00:00`) : undefined;
    }

    if (dataAdmissao !== undefined && dataAdmissao) {
      const dt = new Date(`${dataAdmissao}T00:00:00`);
      if (!isNaN(dt.getTime())) data.dataAdmissao = dt;
    }

    if (horarioInicioJornada !== undefined && horarioInicioJornada) {
      const parsed = new Date(`1970-01-01T${horarioInicioJornada}:00Z`);
      if (!isNaN(parsed.getTime())) {
        data.horarioInicioJornada = parsed;
      }
    }

    if (idTurno !== undefined) {
      if (idTurno) {
        data.turno = { connect: { idTurno: Number(idTurno) } };
      } else {
        data.turno = { disconnect: true };
      }
    }

    if (dataDesligamento !== undefined) {
      data.dataDesligamento = dataDesligamento
        ? new Date(`${dataDesligamento}T00:00:00`)
        : null;
    }

    if (motivoDesligamento !== undefined) {
      data.motivoDesligamento = motivoDesligamento || null;
    }

    if (tipoDesligamento !== undefined) {
      data.tipoDesligamento = tipoDesligamento || null;
    }

    if (dataInicioStatus !== undefined) {
      data.dataInicioStatus = dataInicioStatus
        ? new Date(`${dataInicioStatus}T00:00:00`)
        : null;
    }

    if (dataFimStatus !== undefined) {
      data.dataFimStatus = dataFimStatus
        ? new Date(`${dataFimStatus}T00:00:00`)
        : null;
    }

    /* =============================
       ESCALA
    ============================== */
    let novaEscalaId = null;

    if (idEscala !== undefined && idEscala !== "") {
      const parsed =
        idEscala === null || idEscala === "" ? null : Number(idEscala);

      if (parsed !== null && isNaN(parsed)) {
        return errorResponse(res, "Escala inválida", 400);
      }

      data.idEscala = parsed;
      novaEscalaId = parsed;
    }

    // Converte idEscala para connect/disconnect para o Prisma
    if (data.idEscala !== undefined) {
      const escalaVal = data.idEscala;
      delete data.idEscala;
      if (escalaVal) {
        data.escala = { connect: { idEscala: escalaVal } };
      } else {
        data.escala = { disconnect: true };
      }
    }

    console.log("📦 DATA FINAL:", data);

    let nomeEscalaParaDSR = null;
    let payloadDesligamento = null; // { dataDesligamento, tipoDesligamento }
    let payloadAfastamento  = null; // { dataInicio, dataFim }

    const colaborador = await prisma.$transaction(async (tx) => {
      const hoje = startOfDayBR();

      const atual = await tx.colaborador.findUnique({
        where: { opsId },
        select: {
          idEscala: true,
          idEmpresa: true,
          idEstacao: true,
          status: true,
          dataDesligamento: true,
          motivoDesligamento: true,
          tipoDesligamento: true,
        },
      });

      const atualizado = await tx.colaborador.update({
        where: { opsId },
        data,
      });

      /* =========================
         REGISTRAR DESLIGAMENTO
         Cria registro na tabela desligamento
         quando o status muda para INATIVO
      ========================= */
      const virouInativo =
        data.status === "INATIVO" && atual?.status !== "INATIVO";

      if (virouInativo) {
        const dataDesl = dataDesligamento
          ? new Date(dataDesligamento)
          : hoje;

        // Evita duplicidade: só cria se não existir registro para o mesmo opsId + data
        const jaExiste = await tx.desligamento.findFirst({
          where: { opsId, dataDesligamento: dataDesl },
        });

        if (!jaExiste) {
          await tx.desligamento.create({
            data: {
              opsId,
              idEmpresa: atual.idEmpresa ?? null,
              idEstacao: atual.idEstacao ?? null,
              dataDesligamento: dataDesl,
              tipo: tipoDesligamento ?? atual.tipoDesligamento ?? "NAO_INFORMADO",
              motivo: motivoDesligamento ?? atual.motivoDesligamento ?? "NAO_INFORMADO",
              observacao: null,
              registradoPor: req.user?.id ?? null,
            },
          });
        }

        payloadDesligamento = {
          dataDesligamento: dataDesl,
          tipoDesligamento: tipoDesligamento ?? atual.tipoDesligamento ?? "DP",
        };
      }

      /* =========================
         AUTO-CRIAR AUSÊNCIA DE FÉRIAS/AFASTAMENTO
         Garante que os dias apareçam no controle de presença
      ========================= */
      const virouFerias   = data.status === 'FERIAS'   && atual?.status !== 'FERIAS';
      const virouAfastado = data.status === 'AFASTADO' && atual?.status !== 'AFASTADO';

      if ((virouFerias || virouAfastado) && atualizado.dataInicioStatus && atualizado.dataFimStatus) {
        const codigoTipo = virouFerias ? 'FE' : 'AFA';
        const tipoAus = await tx.tipoAusencia.findFirst({
          where: { codigo: codigoTipo },
          select: { idTipoAusencia: true },
        });

        if (tipoAus) {
          const jaExiste = await tx.ausencia.findFirst({
            where: { opsId, idTipoAusencia: tipoAus.idTipoAusencia, dataInicio: atualizado.dataInicioStatus },
          });

          if (!jaExiste) {
            const inicio = new Date(atualizado.dataInicioStatus);
            const fim    = new Date(atualizado.dataFimStatus);
            const diasCorridos = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;

            await tx.ausencia.create({
              data: {
                opsId,
                idTipoAusencia: tipoAus.idTipoAusencia,
                dataInicio: atualizado.dataInicioStatus,
                dataFim:    atualizado.dataFimStatus,
                diasCorridos,
                status: 'ATIVO',
                registradoPor: req.user?.id ?? null,
              },
            });
          }
        }

        if (virouAfastado) {
          payloadAfastamento = {
            dataInicio: atualizado.dataInicioStatus,
            dataFim:    atualizado.dataFimStatus,
          };
        }
      }

      const escalaMudou =
        novaEscalaId !== null &&
        Number(novaEscalaId) !== Number(atual?.idEscala);

      if (escalaMudou) {
        const tipoDSR = await tx.tipoAusencia.findFirst({
          where: { codigo: "DSR" },
          select: { idTipoAusencia: true },
        });

        /* =========================
           FECHAR HISTÓRICO ATUAL
        ========================= */
        await tx.colaboradorEscalaHistorico.updateMany({
          where: {
            opsId,
            dataFim: null,
          },
          data: {
            dataFim: new Date(hoje.getTime() - 86400000),
          },
        });

        /* =========================
           CRIAR NOVO HISTÓRICO
        ========================= */
        const historicoHoje = await tx.colaboradorEscalaHistorico.findFirst({
          where: { opsId, dataInicio: hoje },
        });

        if (historicoHoje) {
          await tx.colaboradorEscalaHistorico.update({
            where: { id: historicoHoje.id },
            data: { idEscala: novaEscalaId, dataFim: null },
          });
        } else {
          await tx.colaboradorEscalaHistorico.create({
            data: { opsId, idEscala: novaEscalaId, dataInicio: hoje },
          });
        }

        /* =========================
           REMOVER DSR FUTURO ANTIGO
        ========================= */
        if (tipoDSR) {
          await tx.frequencia.deleteMany({
            where: {
              opsId,
              dataReferencia: { gte: hoje },
              idTipoAusencia: tipoDSR.idTipoAusencia,
              manual: false,
            },
          });
        }

        /* =========================
           BUSCAR NOVA ESCALA
        ========================= */
        const novaEscala = await tx.escala.findUnique({
          where: { idEscala: novaEscalaId },
          select: { nomeEscala: true },
        });

        nomeEscalaParaDSR = novaEscala?.nomeEscala ?? null;
      }

      return { atualizado, dataAdmissao: atualizado.dataAdmissao };
    }, { timeout: 30000 });

    /* =========================
       GERAR DSR FORA DA TRANSAÇÃO
       (evita timeout da tx para backfills longos)
    ========================= */
    if (nomeEscalaParaDSR) {
      const idEstacaoColab = colaborador.atualizado?.idEstacao ?? null;
      await gerarDSRFuturoColaborador({ opsId, nomeEscala: nomeEscalaParaDSR, idEstacao: idEstacaoColab });
      await gerarDSRBackfillColaborador({
        opsId,
        nomeEscala: nomeEscalaParaDSR,
        dataInicio: colaborador.dataAdmissao,
        idEstacao: idEstacaoColab,
      });
    }

    if (payloadDesligamento) {
      try {
        await gerarFrequenciaDesligamento({
          opsId,
          dataDesligamento: payloadDesligamento.dataDesligamento,
          tipoDesligamento:  payloadDesligamento.tipoDesligamento,
        });
        console.log(`✅ Frequência desligamento gerada para ${opsId}`);
      } catch (e) {
        console.error(`❌ Erro ao gerar frequência desligamento para ${opsId}:`, e.message);
      }
    }

    if (payloadAfastamento) {
      try {
        await gerarFrequenciaAfastamento({
          opsId,
          dataInicio: payloadAfastamento.dataInicio,
          dataFim:    payloadAfastamento.dataFim,
        });
        console.log(`✅ Frequência afastamento gerada para ${opsId}`);
      } catch (e) {
        console.error(`❌ Erro ao gerar frequência afastamento para ${opsId}:`, e.message);
      }
    }

    return successResponse(
      res,
      colaborador.atualizado,
      "Colaborador atualizado com sucesso"
    );
  } catch (err) {
    console.error("❌ ERRO UPDATE COLABORADOR:", err?.message || err);
    if (err?.name === "PrismaClientValidationError") {
      console.error("📋 Prisma validation detail:", err.message);
    }
    return errorResponse(res, "Erro ao atualizar colaborador", 400, { name: err?.name, message: err?.message, detail: err?.message?.split('\n').slice(0,10).join(' | ') });
  }
};


/* ================= DELETE ================= */
const deleteColaborador = async (req, res) => {
  const { opsId } = req.params;

  try {
    await prisma.colaborador.delete({ where: { opsId } });
    return deletedResponse(res, "Colaborador excluído com sucesso");
  } catch (err) {
    console.error("❌ ERRO DELETE:", err);
    return errorResponse(res, "Erro ao excluir colaborador", 500, err);
  }
};

const listarLideres = async (req, res) => {
  try {
    const estacaoFilter = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? { idEstacao: req.dbContext.estacaoId }
      : {};

    const lideres = await prisma.colaborador.findMany({
      where: {
        ...estacaoFilter,
        status: "ATIVO",
        OR: [
          // Quem já tem subordinados cadastrados
          { subordinados: { some: {} } },
          // Qualquer cargo que contenha "lider" ou "líder" ou "analista"
          { cargo: { nomeCargo: { contains: "lider", mode: "insensitive" } } },
          { cargo: { nomeCargo: { contains: "líder", mode: "insensitive" } } },
          { cargo: { nomeCargo: { contains: "analista", mode: "insensitive" } } },
          { cargo: { nomeCargo: { contains: "supervisor", mode: "insensitive" } } },
          { cargo: { nomeCargo: { contains: "coordenador", mode: "insensitive" } } },
          { cargo: { nomeCargo: { contains: "gerente", mode: "insensitive" } } },
        ],
      },
      select: {
        opsId: true,
        nomeCompleto: true,
        cargo: {
          select: { nomeCargo: true },
        },
      },
      orderBy: { nomeCompleto: "asc" },
    });

    return successResponse(res, lideres);
  } catch (err) {
    return errorResponse(res, "Erro ao listar líderes", 500);
  }
};

/* ================= MOVIMENTAR ================= */
const movimentarColaborador = async (req, res) => {
  const { opsId } = req.params;
  const {
    idEmpresa,
    idSetor,
    idCargo,
    idTurno,
    idLider,
    dataEfetivacao,
    motivo,
  } = req.body;

  if (!dataEfetivacao || !motivo) {
    return errorResponse(res, "Data e motivo são obrigatórios", 400);
  }

  const atual = await prisma.colaborador.findUnique({ where: { opsId } });
  if (!atual) return notFoundResponse(res, "Colaborador não encontrado");

  // Isolamento por estação: ALTA_GESTAO só movimenta colaboradores da sua estação
  if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
    if (atual.idEstacao !== req.dbContext.estacaoId) {
      return forbiddenResponse(res, "Colaborador não pertence à sua estação");
    }
  }

  await prisma.$transaction([
    prisma.historicoMovimentacao.create({
      data: {
        opsId,
        tipoMovimentacao: "ORGANIZACIONAL",
        setorAnterior: atual.idSetor,
        cargoAnterior: atual.idCargo,
        turnoAnterior: atual.idTurno,
        liderAnterior: atual.idLider,

        setorNovo: idSetor ? Number(idSetor) : null,
        cargoNovo: idCargo ? Number(idCargo) : null,
        turnoNovo: idTurno ? Number(idTurno) : null,
        liderNovo: idLider || null,

        dataEfetivacao: new Date(dataEfetivacao),
        motivo,
      },
    }),

    prisma.colaborador.update({
      where: { opsId },
      data: {
        // Usa nested connect/disconnect pra consistência
        ...(idEmpresa !== undefined ? { empresa: { connect: { idEmpresa: Number(idEmpresa) } } } : {}),
        ...(idSetor !== undefined ? { setor: { connect: { idSetor: Number(idSetor) } } } : {}),
        ...(idCargo !== undefined ? { cargo: { connect: { idCargo: Number(idCargo) } } } : {}),
        ...(idTurno !== undefined ? { turno: { connect: { idTurno: Number(idTurno) } } } : {}),
        ...(idLider !== undefined ? { lider: { connect: { opsId: idLider } } } : {}), // Assumindo opsId como unique
      },
    }),
  ]);

  return successResponse(res, null, "Movimentação realizada com sucesso");
};

let ultimoResultadoImport = null;
/* ================= IMPORT CSV (ASYNC) ================= */
const importColaboradores = async (req, res) => {
  if (!req.file) {
    return errorResponse(res, "Arquivo CSV não enviado", 400);
  }

  try {
    const isXlsx = req.file.originalname.toLowerCase().endsWith(".xlsx");
    let rows;

    if (isXlsx) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Converte para array de arrays para tratar headers manualmente
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Encontra a linha de header: primeira linha que contém "ops_id" (com ou sem espaços/asteriscos)
      const headerRowIdx = raw.findIndex((row) =>
        row.some((cell) => String(cell).replace(/[\s*]/g, "").toLowerCase() === "ops_id")
      );

      if (headerRowIdx === -1) {
        return errorResponse(res, "Cabeçalho não encontrado no arquivo. Certifique-se que a planilha contém a coluna ops_id.", 400);
      }

      // Sanitiza os headers: remove espaços e asteriscos
      const headers = raw[headerRowIdx].map((h) =>
        String(h).replace(/[\s*]/g, "").toLowerCase()
      );

      // Monta os objetos de dados
      rows = raw.slice(headerRowIdx + 1)
        .filter((row) => row.some((cell) => String(cell).trim() !== ""))
        .map((row) => {
          const obj = {};
          headers.forEach((h, i) => {
            if (h) obj[h] = row[i] !== undefined ? String(row[i]) : "";
          });
          return obj;
        });
    } else {
      const csvString = req.file.buffer.toString("utf-8");
      rows = await csv({ delimiter: "," }).fromString(csvString);
    }

    if (!rows.length) {
      return errorResponse(res, "CSV vazio", 400);
    }

    // Captura o contexto de estação antes de enviar a resposta (req pode ser destruído)
    const dbContextSnapshot = {
      isGlobal: req.dbContext?.isGlobal ?? false,
      estacaoId: req.dbContext?.estacaoId ?? null,
    };
    const userRoleSnapshot = req.user?.role ?? null;

    res.json({
      success: true,
      message: "Importação iniciada em segundo plano",
      totalLinhas: rows.length,
    });

    setImmediate(async () => {
      console.log(`🚀 Import CSV iniciado (${rows.length} linhas)`);

      let criados = 0;
      let atualizados = 0;
      let skipped = 0;
      const errors = [];
      const skippedDetails = [];

      const parseHorario = (v) => {
        if (!v) return null;
        const parts = String(v).trim().split(":");
        if (parts.length !== 2) return null;

        const hora = parts[0].padStart(2, "0");
        const min = parts[1].padStart(2, "0");

        return new Date(`1970-01-01T${hora}:${min}:00`);
      };

      const parseDate = (v) => {
        if (!v) return null;
        const s = String(v).trim();

        // Número serial do Excel (ex: 46479)
        if (/^\d{4,5}$/.test(s)) {
          const date = XLSX.SSF.parse_date_code(Number(s));
          if (date) return new Date(date.y, date.m - 1, date.d);
        }

        // Formato DD/MM/YYYY
        const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (brMatch) {
          const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T00:00:00`);
          return isNaN(d.getTime()) ? null : d;
        }

        // Formato YYYY-MM-DD (ISO)
        const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
          const d = new Date(`${s}T00:00:00`);
          return isNaN(d.getTime()) ? null : d;
        }

        // Fallback genérico
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        return d;
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
          const opsId = String(row["ops_id"] || "").trim();
          if (!opsId) {
            skipped++;
            skippedDetails.push({ linha: i + 1, ops_id: "N/A", motivo: "ops_id ausente" });
            continue;
          }

          const nomeCompleto = String(row["nome_completo"] || "").trim();
          const matricula = String(row["matricula"] || "").trim();
          const cpf = row["cpf"] ? String(row["cpf"]).trim() : "";
          const idLider = String(row["id_lider"] || "").trim();
          const idSetor = row["id_setor"] ? Number(row["id_setor"]) : null;
          const idCargo = row["id_cargo"] ? Number(row["id_cargo"]) : null;
          const idEmpresa = row["id_empresa"] ? Number(row["id_empresa"]) : null;
          const idTurno = row["id_turno"] ? Number(row["id_turno"]) : null;
          const idEscala = row["id_escala"] ? Number(row["id_escala"]) : null;
          const idEstacao = row["id_estacao"] ? Number(row["id_estacao"]) : null;

          // Validação de estação para ALTA_GESTAO (Admin não é bloqueado)
          if (userRoleSnapshot === "ALTA_GESTAO") {
            if (!idEstacao) {
              skipped++;
              skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: "Id_estação está vazio." });
              continue;
            }
            if (dbContextSnapshot.estacaoId && idEstacao !== dbContextSnapshot.estacaoId) {
              skipped++;
              skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: "A estação informada não condiz com a estação atual." });
              continue;
            }
          }

          // Validação de CPF - deve ter exatamente 11 dígitos
          const cpfLimpo = cpf.replace(/\D/g, "");
          if (cpfLimpo.length !== 11) {
            skipped++;
            skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: "CPF inválido - deve conter exatamente 11 dígitos" });
            continue;
          }

          if (!nomeCompleto || !matricula || !cpf || !idLider || !idSetor || !idCargo || !idEmpresa || !idTurno || !idEscala) {
            const faltando = [
              !nomeCompleto && "nome_completo",
              !matricula    && "matricula",
              !cpf          && "cpf",
              !idLider      && "id_lider",
              !idSetor      && "id_setor",
              !idCargo      && "id_cargo",
              !idEmpresa    && "id_empresa",
              !idTurno      && "id_turno",
              !idEscala     && "id_escala",
            ].filter(Boolean);
            skipped++;
            skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: `Campos obrigatórios ausentes: ${faltando.join(", ")}` });
            continue;
          }

          const dataAdmissao = parseDate(row["data_admissao"]);
          if (!dataAdmissao) {
            skipped++;
            skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: "data_admissao inválida ou ausente" });
            continue;
          }

          const horarioInicioJornada =
            parseHorario(row["hora_inicio_jornada"]) ||
            new Date("1970-01-01T05:25:00");

          const existing = await prisma.colaborador.findUnique({
            where: { opsId },
            select: { opsId: true, idEscala: true },
          });

          const data = {
            opsId,
            nomeCompleto,
            genero: row["genero"] || null,
            matricula,
            dataAdmissao,
            horarioInicioJornada,
            status: "ATIVO",
            cpf: row["cpf"] ? String(row["cpf"]) : null,
            dataNascimento: parseDate(row["data_nascimento"]),
            email: row["email"] || null,
            telefone: row["telefone"] ? String(row["telefone"]) : null,
            contatoEmergenciaNome: row["contato_emergencia_nome"] ? String(row["contato_emergencia_nome"]).trim() : null,
            contatoEmergenciaTelefone: row["contato_emergencia_telefone"] ? String(row["contato_emergencia_telefone"]).trim() : null,
            idSetor: idSetor,
            idCargo: idCargo,
            idEmpresa: idEmpresa,
            idEstacao: idEstacao,
            idTurno: idTurno,
            idEscala: idEscala,
            idLider: idLider || null,
          };

          const colab = await prisma.colaborador.upsert({
            where: { opsId },
            update: data,
            create: data,
          });

          /* =========================
             SE NOVO OU ESCALA MUDOU
          ========================= */
          const escalaMudou =
            data.idEscala &&
            (!existing || Number(existing.idEscala) !== Number(data.idEscala));

          if (escalaMudou) {
            const hoje = startOfDayBR();

            /* FECHAR HISTÓRICO ANTERIOR */
            await prisma.colaboradorEscalaHistorico.updateMany({
              where: {
                opsId: colab.opsId,
                dataFim: null,
              },
              data: {
                dataFim: new Date(hoje.getTime() - 86400000),
              },
            });

            /* CRIAR NOVO HISTÓRICO */
            const historicoHoje = await prisma.colaboradorEscalaHistorico.findFirst({
              where: { opsId: colab.opsId, dataInicio: hoje },
            });

            if (historicoHoje) {
              await prisma.colaboradorEscalaHistorico.update({
                where: { id: historicoHoje.id },
                data: { idEscala: data.idEscala, dataFim: null },
              });
            } else {
              await prisma.colaboradorEscalaHistorico.create({
                data: {
                  opsId: colab.opsId,
                  idEscala: data.idEscala,
                  dataInicio: hoje,
                },
              });
            }

            /* ESCALA */
            const escala = await prisma.escala.findUnique({
              where: { idEscala: data.idEscala },
              select: { nomeEscala: true, idEstacao: true },
            });

            const nomeEscala = escala?.nomeEscala;
            const idEstacaoEscala = escala?.idEstacao ?? null;

            /* BACKFILL */
            await gerarDSRBackfillColaborador({
              opsId: colab.opsId,
              nomeEscala,
              dataInicio: hoje,
              idEstacao: idEstacaoEscala,
            });

            /* FUTURO */
            await gerarDSRFuturoColaborador({
              opsId: colab.opsId,
              nomeEscala,
              idEstacao: idEstacaoEscala,
            });
          }

          existing ? atualizados++ : criados++;

          // Onboarding: gera se ainda não existir registro para o dia de admissão
          try {
            const dia1 = new Date(`${dataAdmissao.toISOString().slice(0, 10)}T00:00:00.000Z`);
            const jaTemOnboarding = await prisma.frequencia.findFirst({
              where: { opsId: colab.opsId, dataReferencia: dia1 },
              select: { idFrequencia: true },
            });
            if (!jaTemOnboarding) {
              await gerarOnboardingColaborador({ opsId: colab.opsId, dataAdmissao });
              console.log(`✅ Onboarding gerado para ${colab.opsId} (admissão: ${dataAdmissao.toISOString().slice(0, 10)})`);
            }
          } catch (onboardErr) {
            console.error(`❌ Onboarding falhou para ${colab.opsId}: ${onboardErr.message}`);
          }

        } catch (err) {
          skipped++;
          const opsId = String(row["ops_id"] || "N/A").trim();
          const msg = `Linha ${i + 1} (Ops ${opsId}): ${err.message}`;
          errors.push(msg);
          skippedDetails.push({ linha: i + 1, ops_id: opsId, motivo: `Erro: ${err.message}` });
        }
      }

      const resultado = {
        total: rows.length,
        criados,
        atualizados,
        skipped,
        erros: errors.length,
        skippedDetails,
        finalizado: true,
        data: new Date(),
      };

      ultimoResultadoImport = resultado;

      console.log("✅ Import CSV finalizado", resultado);

      if (errors.length) {
        console.log("⚠ ERROS CSV:");
        errors.slice(0, 20).forEach((e) => console.log(e));
      }
    });

  } catch (err) {
    console.error("❌ ERRO IMPORT CSV:", err);

    return errorResponse(res, "Erro ao iniciar importação", 500, err);
  }
};

const getStatusImport = async (req, res) => {
  if (!ultimoResultadoImport) {
    return res.json({
      status: "processing"
    });
  }

  return res.json({
    status: "completed",
    ...ultimoResultadoImport
  });
};

/* ================= GET BY OPS ID (DUPLICADO - MANTER SE NECESSÁRIO) ================= */
const getByOpsId = async (req, res) => {
  // ✅ Delega para getColaboradorById se for o mesmo
  return getColaboradorById(req, res);
};

/* ================= STATS E HISTORICO (ASSUMINDO QUE EXISTEM) ================= */
const getColaboradorStats = async (req, res) => {
  // Implemente se necessário (ex.: stats de frequência, ausências)
  return successResponse(res, { message: "Stats pendentes" });
};

const getColaboradorHistorico = async (req, res) => {
  // Implemente se necessário (ex.: historico de movimentações)
  return successResponse(res, { message: "Historico pendente" });
};

/* ================= BACKFILL DSR TODOS ================= */
const backfillDSRTodos = async (req, res) => {
  // Responde imediatamente e processa em background para não travar a conexão
  res.json({ sucesso: true, mensagem: "Backfill DSR iniciado em background. Verifique os logs do servidor." });

  try {
    const colaboradores = await prisma.colaborador.findMany({
      where: { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] } },
      select: { opsId: true, dataAdmissao: true, idEstacao: true, escala: { select: { nomeEscala: true } } },
    });

    // Limita a 90 dias atrás para não sobrecarregar — corrige o período relevante
    const dataInicio90d = new Date();
    dataInicio90d.setDate(dataInicio90d.getDate() - 90);

    let totalCriados = 0;
    let processados = 0;
    const erros = [];

    for (const c of colaboradores) {
      try {
        const nomeEscala = c.escala?.nomeEscala;
        if (!nomeEscala) continue;

        const dataInicio = c.dataAdmissao && new Date(c.dataAdmissao) > dataInicio90d
          ? c.dataAdmissao
          : dataInicio90d;

        const { criados } = await gerarDSRBackfillColaborador({
          opsId: c.opsId,
          nomeEscala,
          dataInicio,
          idEstacao: c.idEstacao ?? null,
        });

        totalCriados += criados;
        processados++;
        if (processados % 20 === 0) {
          console.log(`⏳ [BACKFILL DSR] ${processados}/${colaboradores.length} processados, ${totalCriados} registros até agora...`);
        }
      } catch (e) {
        erros.push({ opsId: c.opsId, erro: e.message });
      }
    }

    console.log(`✅ [BACKFILL DSR] Concluído: ${processados} colaboradores, ${totalCriados} registros criados/corrigidos, ${erros.length} erros`);
    if (erros.length) console.error("❌ Erros backfill DSR:", erros.slice(0, 10));
  } catch (err) {
    console.error("❌ BACKFILL DSR:", err);
  }
};

/* ================= BACKFILL NC PRÉ-ADMISSÃO (MÊS ATUAL) ================= */
const backfillNcPreAdmissao = async (req, res) => {
  const agora = new Date();
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth(); // 0-based

  const inicioMes = new Date(Date.UTC(anoAtual, mesAtual, 1));
  const fimMes    = new Date(Date.UTC(anoAtual, mesAtual + 1, 0, 23, 59, 59, 999));

  res.json({ sucesso: true, mensagem: "Backfill NC pré-admissão iniciado em background. Verifique os logs do servidor." });

  try {
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        dataAdmissao: { gte: inicioMes, lte: fimMes },
      },
      select: { opsId: true, dataAdmissao: true, nomeCompleto: true },
    });

    console.log(`[backfillNcPreAdmissao] ${colaboradores.length} colaborador(es) com admissão no mês atual`);

    let processados = 0;
    const erros = [];

    for (const c of colaboradores) {
      try {
        await gerarNcPreAdmissao({ opsId: c.opsId, dataAdmissao: c.dataAdmissao });
        processados++;
        console.log(`✅ NC pré-admissão gerado para ${c.opsId} (${c.nomeCompleto}) — admissão: ${new Date(c.dataAdmissao).toISOString().slice(0, 10)}`);
      } catch (err) {
        erros.push({ opsId: c.opsId, erro: err.message });
        console.error(`❌ Falhou para ${c.opsId}:`, err.message);
      }
    }

    console.log(`[backfillNcPreAdmissao] Concluído. Processados: ${processados}, Erros: ${erros.length}`);
    if (erros.length) console.log("Erros:", erros);
  } catch (err) {
    console.error("❌ ERRO backfillNcPreAdmissao:", err);
  }
};

/* ================= FILTROS DA ESTAÇÃO ================= */
const listarFiltrosEstacao = async (req, res) => {
  try {
    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId
      : null;

    const whereColab = estacaoId ? { idEstacao: estacaoId } : {};

    const [escalas, turnos, setores, cargos] = await Promise.all([
      prisma.escala.findMany({
        where: estacaoId
          ? { colaboradores: { some: whereColab } }
          : undefined,
        select: { idEscala: true, nomeEscala: true },
        orderBy: { nomeEscala: "asc" },
      }),
      prisma.turno.findMany({
        where: estacaoId
          ? { colaboradores: { some: whereColab } }
          : undefined,
        select: { idTurno: true, nomeTurno: true },
        orderBy: { nomeTurno: "asc" },
      }),
      prisma.setor.findMany({
        where: estacaoId
          ? { colaboradores: { some: whereColab } }
          : undefined,
        select: { idSetor: true, nomeSetor: true },
        orderBy: { nomeSetor: "asc" },
      }),
      prisma.cargo.findMany({
        where: estacaoId
          ? { colaboradores: { some: whereColab } }
          : undefined,
        select: { idCargo: true, nomeCargo: true },
        orderBy: { nomeCargo: "asc" },
      }),
    ]);

    return successResponse(res, { escalas, turnos, setores, cargos });
  } catch (err) {
    console.error("❌ ERRO FILTROS ESTACAO:", err);
    return errorResponse(res, "Erro ao carregar filtros", 500);
  }
};

/* ================= LISTAR SETORES ================= */
const listarSetores = async (req, res) => {
  try {
    const where = {};
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      where.idEstacao = req.dbContext.estacaoId;
    }

    const setores = await prisma.setor.findMany({
      where: Object.keys(where).length
        ? { colaboradores: { some: where } }
        : undefined,
      select: { idSetor: true, nomeSetor: true },
      orderBy: { nomeSetor: "asc" },
    });

    return successResponse(res, setores);
  } catch (err) {
    console.error("❌ ERRO LISTAR SETORES:", err);
    return errorResponse(res, "Erro ao listar setores", 500);
  }
};

/* ================= EXPORTAR CSV ================= */
function buildWhere(query, dbContext) {
  const {
    search, status, idSetor, idCargo, idEmpresa, idLider, escala, turno,
  } = query;

  const where = {};

  if (!dbContext?.isGlobal && dbContext?.estacaoId) {
    where.idEstacao = dbContext.estacaoId;
  }
  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: "insensitive" } },
      { matricula:    { contains: search, mode: "insensitive" } },
      { opsId:        { contains: search, mode: "insensitive" } },
      { cpf:          { contains: search, mode: "insensitive" } },
    ];
  }
  if (status)   where.status   = status;
  if (idSetor)  where.idSetor  = Number(idSetor);
  if (idCargo)  where.idCargo  = Number(idCargo);
  if (idEmpresa) where.idEmpresa = Number(idEmpresa);
  if (idLider)  where.idLider  = idLider;
  if (escala)   where.escala   = { nomeEscala: escala };
  if (turno)    where.turno    = { nomeTurno: turno };

  return where;
}

const exportarCsvColaboradores = async (req, res) => {
  try {
    const where = buildWhere(req.query, req.dbContext);

    const data = await prisma.colaborador.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      include: {
        empresa: true,
        cargo: true,
        setor: true,
        turno: true,
        escala: { select: { nomeEscala: true } },
        lider: { select: { nomeCompleto: true } },
      },
    });

    const rows = data.map(aplicarStatusDinamico).map((c) => [
      c.nomeCompleto || "",
      c.empresa?.razaoSocial || "",
      c.setor?.nomeSetor || "",
      c.turno?.nomeTurno || "",
      c.escala?.nomeEscala || "",
      c.cargo?.nomeCargo || "",
      c.status || "",
      c.dataAdmissao ? new Date(c.dataAdmissao).toLocaleDateString("pt-BR") : "",
      c.lider?.nomeCompleto || "",
    ]);

    const header = ["Nome", "Empresa", "Setor", "Turno", "Escala", "Cargo", "Status", "Admissão", "Liderança"];
    const csvLines = [header, ...rows].map((r) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );

    // BOM UTF-8 para Excel reconhecer acentos
    const bom = "﻿";
    const csv = bom + csvLines.join("\r\n");

    const hoje = new Date().toISOString().slice(0, 10);
    const filename = `colaboradores_${hoje}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error("❌ ERRO EXPORT CSV:", err);
    return errorResponse(res, "Erro ao exportar CSV", 500);
  }
};

module.exports = {
  getAllColaboradores,
  getColaboradorByCpf,
  getColaboradorById,
  getByOpsId,
  getColaboradorStats,
  getColaboradorHistorico,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  movimentarColaborador,
  importColaboradores,
  getStatusImport,
  listarLideres,
  listarEscalas,
  listarSetores,
  listarFiltrosEstacao,
  exportarCsvColaboradores,
  backfillDSRTodos,
  backfillNcPreAdmissao,
};