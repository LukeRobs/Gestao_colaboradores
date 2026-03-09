/**
 * Controller de Colaborador
 */

const { prisma } = require("../config/database");
const csv = require("csvtojson");
const {
  successResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/response");

/* ================= CONSTANTES ================= */
const HORARIOS_PERMITIDOS = ["05:25", "13:20", "21:00"];

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

  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: "insensitive" } },
      { matricula: { contains: search, mode: "insensitive" } },
      { opsId: { contains: search, mode: "insensitive" } },
      { cpf: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status !== undefined && status !== "") {
    if (status === "ATIVO") {
        where.status = { in: ["ATIVO", "FERIAS", "AFASTADO"] };
      } else {
        where.status = status;
      }
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
        estacao: {
          include: {
            regional: true,
          },
        },
      },
    });

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

    const [totalAtestados, ativos, finalizados] = await Promise.all([
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
      },

      indicadores: {
        atestados: {
          total: totalAtestados,
          ativos,
          finalizados,
        },
        treinamentos: {
          total: treinamentosDTO.length,
          itens: treinamentosDTO,
        },
      },
    });
  } catch (err) {
    console.error("❌ ERRO GET BY ID:", err);
    return errorResponse(res, "Erro ao buscar colaborador", 500, err);
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
      if (!HORARIOS_PERMITIDOS.includes(horarioInicioJornada)) {
        return errorResponse(
          res,
          `Horário inválido. Permitidos: ${HORARIOS_PERMITIDOS.join(", ")}`,
          400
        );
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
    };

    /* ===============================
       TRANSACTION
    =============================== */

    const colaborador = await prisma.$transaction(async (tx) => {

      /* CRIA COLABORADOR */

      const novo = await tx.colaborador.create({
        data,
      });

      /* CRIA HISTÓRICO DE ESCALA INICIAL */

      await tx.colaboradorEscalaHistorico.create({
        data: {
          opsId: novo.opsId,
          idEscala: escalaId,
          dataInicio: startOfDayBR(),
        },
      });

      return novo;
    });

    /* ===============================
       RESPONSE
    =============================== */

    return createdResponse(
      res,
      colaborador,
      "Colaborador criado com sucesso"
    );

  } catch (err) {

    console.error("❌ ERRO CREATE:", err);

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
    const {
      nomeCompleto,
      cpf,
      email,
      telefone,
      genero,
      matricula,
      status,
      idEscala,
      dataAdmissao,
      horarioInicioJornada,
      contatoEmergenciaNome,
      contatoEmergenciaTelefone,

      dataDesligamento,
      motivoDesligamento,
      dataInicioStatus,
      dataFimStatus,
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

    /* =============================
       VALIDAÇÕES POR STATUS
    ============================== */
    if (status !== undefined) {
      // 🔴 INATIVO → obrigatória dataDesligamento
    if (status === "INATIVO") {
      if (!dataDesligamento) {
        return errorResponse(
          res,
          "Data de desligamento é obrigatória para INATIVO",
          400
        );
      }

      if (!motivoDesligamento) {
        return errorResponse(
          res,
          "Motivo do desligamento é obrigatório para INATIVO",
          400
        );
      }

      // 🔒 VALIDA ENUM
      const MOTIVOS_VALIDOS = [
        "SEGURANCA",
        "ALTO_INDICE_ABS",
        "ABANDONADO",
        "DESEMPENHO_BAIXO",
        "DESVIO_COMPORTAMENTAL",
        "TERMINO_CONTRATO",
        "SEM_EXIBICAO",
        "DECLINIO",
        "CONFORMIDADE",
        "PEDIDO_DEMISSAO",
        "DESLIGAMENTO_AUTOMATICO",
        "REDUCAO_QUADRO",
        "VOLUNTARIO",
        "INVOLUNTARIO",
      ];

      if (!MOTIVOS_VALIDOS.includes(motivoDesligamento)) {
        return errorResponse(
          res,
          "Motivo de desligamento inválido",
          400
        );
      }

      const dt = new Date(dataDesligamento);
      if (isNaN(dt.getTime())) {
        return errorResponse(res, "Data de desligamento inválida", 400);
      }

      data.dataDesligamento = dt;
      data.motivoDesligamento = motivoDesligamento;

      // limpa status temporário
      data.dataInicioStatus = null;
      data.dataFimStatus = null;
    }

      // 🟡 FERIAS ou AFASTADO
      if (status === "FERIAS" || status === "AFASTADO") {
        if (!dataInicioStatus || !dataFimStatus) {
          return errorResponse(
            res,
            "Data início e data fim são obrigatórias para FÉRIAS ou AFASTADO",
            400
          );
        }

        const inicio = new Date(dataInicioStatus);
        const fim = new Date(dataFimStatus);

        if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
          return errorResponse(res, "Datas inválidas", 400);
        }

        if (fim < inicio) {
          return errorResponse(
            res,
            "Data final não pode ser menor que data inicial",
            400
          );
        }

        data.dataInicioStatus = inicio;
        data.dataFimStatus = fim;

        // limpa demissão
        data.dataDesligamento = null;
        data.motivoDesligamento = null;
      }

      // 🟢 ATIVO → limpa todos os campos de status temporário
      if (status === "ATIVO") {
        data.dataDesligamento = null;
        data.motivoDesligamento = null;
        data.dataInicioStatus = null;
        data.dataFimStatus = null;
      }
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

    /* =============================
       DATA ADMISSÃO
    ============================== */
    if (dataAdmissao !== undefined) {
      let dt = null;

      if (dataAdmissao) {
        dt = new Date(dataAdmissao);
        if (isNaN(dt.getTime())) {
          return errorResponse(res, "Data de admissão inválida", 400);
        }
      }

      data.dataAdmissao = dt;
    }

    /* =============================
       HORÁRIO
    ============================== */
    if (horarioInicioJornada !== undefined) {
      let time = null;

      if (horarioInicioJornada) {
        if (horarioInicioJornada.includes("T")) {
          const d = new Date(horarioInicioJornada);
          if (isNaN(d.getTime())) {
            return errorResponse(res, "Horário inválido", 400);
          }
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          time = new Date(`1970-01-01T${hh}:${mm}:00`);
        } else {
          time = new Date(`1970-01-01T${horarioInicioJornada}:00`);
          if (isNaN(time.getTime())) {
            return errorResponse(res, "Horário inválido", 400);
          }
        }
      }

      data.horarioInicioJornada = time;
    }

    console.log("📦 DATA FINAL:", data);

    const colaborador = await prisma.$transaction(async (tx) => {

    const atual = await tx.colaborador.findUnique({
      where: { opsId },
      select: { idEscala: true }
    });

    const atualizado = await tx.colaborador.update({
      where: { opsId },
      data,
    });

    const tipoDSR = await tx.tipoAusencia.findFirst({
      where: { codigo: "DSR" },
      select: { idTipoAusencia: true }
    });

    const escalaMudou =
      novaEscalaId !== null &&
      Number(novaEscalaId) !== Number(atual?.idEscala);

    if (escalaMudou) {

      const hoje = startOfDayBR();

      /* FECHAR HISTORICO ATUAL */

      await tx.colaboradorEscalaHistorico.updateMany({
        where: {
          opsId,
          dataFim: null,
        },
        data: {
          dataFim: new Date(hoje.getTime() - 86400000),
        },
      });

      /* CRIAR NOVO HISTORICO */

      await tx.colaboradorEscalaHistorico.create({
        data: {
          opsId,
          idEscala: novaEscalaId,
          dataInicio: hoje,
        },
      });

      await tx.frequencia.deleteMany({
        where: {
          opsId,
          dataReferencia: {
            gte: hoje
          },
          idTipoAusencia: tipoDSR.idTipoAusencia,
          manual: false
        }
      });

      const novaEscala = await tx.escala.findUnique({
        where: { idEscala: novaEscalaId },
        select: { nomeEscala: true },
      });

      if (novaEscala?.nomeEscala) {
        await gerarDSRFuturo({
          opsId,
          escala: novaEscala.nomeEscala,
          dataInicio: hoje,
        });
      }

    }

    return atualizado;
  });

    return successResponse(
      res,
      colaborador,
      "Colaborador atualizado com sucesso"
    );
  } catch (err) {
    console.error("❌ ERRO UPDATE COLABORADOR:", err);
    return errorResponse(res, "Erro ao atualizar colaborador", 400, err);
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
    const lideres = await prisma.colaborador.findMany({
      where: {
        status: "ATIVO",
        OR: [
          {
            // Líderes (que têm subordinados)
            subordinados: {
              some: {}, // tem pelo menos 1 subordinado
            },
          },
          {
            // Analistas de Logística JR (específico)
            cargo: {
              nomeCargo: {
                contains: "Analista De Logística JR",
                mode: "insensitive",
              },
            },
          },
          {
            // Outras variações de Analista de Logística
            cargo: {
              nomeCargo: {
                contains: "Analista de Logística",
                mode: "insensitive",
              },
            },
          },
        ],
      },
      select: {
        opsId: true,
        nomeCompleto: true,
        cargo: {
          select: {
            nomeCargo: true,
          },
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
    const csvString = req.file.buffer.toString("utf-8");
    const rows = await csv({ delimiter: "," }).fromString(csvString);

    if (!rows.length) {
      return errorResponse(res, "CSV vazio", 400);
    }

    res.json({
      success: true,
      message: "Importação iniciada em segundo plano",
      totalLinhas: rows.length,
    });

    /* ================= PROCESSAMENTO BACKGROUND ================= */
    setImmediate(async () => {

      console.log(`🚀 Import CSV iniciado (${rows.length} linhas)`);

      let criados = 0;
      let atualizados = 0;
      let skipped = 0;
      const errors = [];

      const parseHorario = (v) => {
        if (!v) return null;

        const h = String(v).trim();

        const parts = h.split(":");

        if (parts.length !== 2) return null;

        const hora = parts[0].padStart(2, "0");
        const min = parts[1].padStart(2, "0");

        return new Date(`1970-01-01T${hora}:${min}:00`);
      };

      const parseDate = (v) => {
        if (!v) return null;

        const d = new Date(v);

        if (isNaN(d.getTime())) return null;

        return d;
      };

      /* ================= LOOP CSV ================= */
      for (let i = 0; i < rows.length; i++) {

        const row = rows[i];

        try {

          const opsId = String(row["ops_id"] || "").trim();

          if (!opsId) {
            skipped++;
            continue;
          }

          const nomeCompleto = String(row["nome_completo"] || "").trim();
          const matricula = String(row["matricula"] || "").trim();

          if (!nomeCompleto || !matricula) {
            skipped++;
            continue;
          }

          const dataAdmissao = parseDate(row["data_admissao"]);

          if (!dataAdmissao) {
            skipped++;
            continue;
          }

          const horarioInicioJornada =
            parseHorario(row["hora_inicio_jornada"]) ||
            new Date("1970-01-01T05:25:00");

          const existing = await prisma.colaborador.findUnique({
            where: { opsId },
            select: { opsId: true },
          });

          const data = {

            opsId,

            nomeCompleto,

            genero: row["genero"] || null,

            matricula,

            dataAdmissao,

            horarioInicioJornada,

            status: row["status"] || "ATIVO",

            cpf: row["cpf"] ? String(row["cpf"]) : null,

            dataNascimento: parseDate(row["data_nascimento"]),

            email: row["email"] || null,

            telefone: row["telefone"] ? String(row["telefone"]) : null,

            idSetor: row["id_setor"] ? Number(row["id_setor"]) : null,

            idCargo: row["id_cargo"] ? Number(row["id_cargo"]) : null,

            idEmpresa: row["id_empresa"] ? Number(row["id_empresa"]) : null,

            idTurno: row["id_turno"] ? Number(row["id_turno"]) : null,

            idEscala: row["id_escala"] ? Number(row["id_escala"]) : null,

            idLider: row["id_lider"] || null,

          };

          const colab = await prisma.colaborador.upsert({
              where: { opsId },
              update: data,
              create: data,
            });

            if (!existing && data.idEscala) {
              await prisma.colaboradorEscalaHistorico.create({
                data: {
                  opsId: colab.opsId,
                  idEscala: data.idEscala,
                  dataInicio: startOfDayBR(),
                },
              });
            }

          existing ? atualizados++ : criados++;

        } catch (err) {

          skipped++;

          errors.push(
            `Linha ${i + 1} (Ops ${row["ops_id"] || "N/A"}): ${err.message}`
          );
        }
      }

      const resultado = {
        total: rows.length,
        criados,
        atualizados,
        skipped,
        erros: errors.length,
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
};