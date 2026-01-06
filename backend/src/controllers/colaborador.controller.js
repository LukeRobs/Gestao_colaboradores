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

  if (status) where.status = status;
  if (idSetor) where.idSetor = Number(idSetor);
  if (idCargo) where.idCargo = Number(idCargo);
  if (idEmpresa) where.idEmpresa = Number(idEmpresa);
  if (idLider) where.idLider = idLider;
  if (escala) { where.escala = { nomeEscala: escala};} // A | B | C


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

    return paginatedResponse(res, data, {
      page: Number(page),
      limit: Number(limit),
      total,
    });
  } catch (err) {
    console.error("❌ ERRO GET ALL:", err);
    return errorResponse(res, "Erro ao buscar colaboradores", 500, err);
  }
};

/* ================= GET BY ID ================= */
const getColaboradorById = async (req, res) => {
  const { opsId } = req.params;
  const RESERVED = ["import", "create", "new"];

  if (RESERVED.includes(opsId)) {
    return errorResponse(res, "Rota inválida", 404);
  }

  try {
    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      include: {
        empresa: true,
        cargo: true,
        setor: true,
        turno: true,
        escala: true,
        estacao: {
          include: {
            regional: true, // ✅ REGIONAL VEM DA ESTAÇÃO
          },
        },
      },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    /* =====================================================
       INDICADORES — ATESTADOS
    ===================================================== */
function startOfDaySafe(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const hoje = startOfDaySafe();

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
    where: { opsId, status: "FINALIZADO" },
  }),
]);


    /* =====================================================
       RESPOSTA FINAL (SEM QUEBRAR O FRONT)
    ===================================================== */
  return successResponse(res, {
    colaborador, // 👈 mantém o objeto inteiro SEM espalhar

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
    } = req.body;

    /* ===== VALIDAÇÕES BÁSICAS ===== */
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


    /* ===== DATA ADMISSÃO ===== */
    let dataAdmissaoDate = null;
    if (dataAdmissao) {
      const dt = new Date(`${dataAdmissao}T00:00:00`);
      if (isNaN(dt.getTime())) {
        return errorResponse(res, "Data de admissão inválida", 400);
      }
      dataAdmissaoDate = dt;
    }

    /* ===== HORÁRIO ===== */
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
      // Default se não fornecido (baseado em schema required)
      horario = new Date(`1970-01-01T05:25:00Z`); // Primeiro horário permitido
    }

    const data = {
      opsId,
      nomeCompleto,
      cpf: cpf || null,
      telefone: telefone || null,
      email: email || null,
      genero: genero || null,
      matricula,
      dataAdmissao: dataAdmissaoDate,
      horarioInicioJornada: horario,
      status: status || "ATIVO",
      // Relações nested: connect se ID existe
      ...(idEmpresa ? { empresa: { connect: { idEmpresa: Number(idEmpresa) } } } : {}),
      ...(idSetor ? { setor: { connect: { idSetor: Number(idSetor) } } } : {}),
      ...(idCargo ? { cargo: { connect: { idCargo: Number(idCargo) } } } : {}),
      ...(idTurno ? { turno: { connect: { idTurno: Number(idTurno) } } } : {}),
      ...(idEscala ? { escala: { connect: { idEscala: Number(idEscala) } } } : {}),

    };

    const colaborador = await prisma.colaborador.create({
      data,
    });

    return createdResponse(res, colaborador, "Colaborador criado com sucesso");
  } catch (err) {
    console.error("❌ ERRO CREATE:", err);
    return errorResponse(res, "Erro ao criar colaborador", 500, err);
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
    } = req.body;

    const data = {};

    /* ===== CAMPOS SIMPLES ===== */
    if (nomeCompleto !== undefined) data.nomeCompleto = nomeCompleto;
    if (cpf !== undefined) data.cpf = cpf || null;
    if (email !== undefined) data.email = email || null;
    if (telefone !== undefined) data.telefone = telefone || null;
    if (genero !== undefined) data.genero = genero || null;
    if (matricula !== undefined) data.matricula = matricula;
    if (status !== undefined) data.status = status;

    /* ===== ESCALA ===== */
    if (idEscala !== undefined) {
      const parsed = idEscala === null || idEscala === "" ? null : Number(idEscala);
      if (parsed !== null && isNaN(parsed)) {
        return errorResponse(res, "Escala inválida", 400);
      }
      data.idEscala = parsed;
    }

    /* ===== DATA ADMISSÃO (ACEITA ISO OU YYYY-MM-DD) ===== */
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

    /* ===== HORÁRIO (ACEITA ISO OU HH:mm) ===== */
    if (horarioInicioJornada !== undefined) {
      let time = null;

      if (horarioInicioJornada) {
        if (horarioInicioJornada.includes("T")) {
          // ISO → extrai HH:mm
          const d = new Date(horarioInicioJornada);
          if (isNaN(d.getTime())) {
            return errorResponse(res, "Horário inválido", 400);
          }
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          time = new Date(`1970-01-01T${hh}:${mm}:00`);
        } else {
          // HH:mm
          time = new Date(`1970-01-01T${horarioInicioJornada}:00`);
          if (isNaN(time.getTime())) {
            return errorResponse(res, "Horário inválido", 400);
          }
        }
      }

      data.horarioInicioJornada = time;
    }

    console.log("📦 DATA FINAL:", data);

    const colaborador = await prisma.colaborador.update({
      where: { opsId },
      data,
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

    // ✅ RESPONDE IMEDIATAMENTE
    res.json({
      success: true,
      message: "Importação iniciada em segundo plano",
      totalLinhas: rows.length,
    });

    /* ================= PROCESSAMENTO EM BACKGROUND ================= */
    setImmediate(async () => {
      console.log(`🚀 Import CSV iniciado (${rows.length} linhas)`);

      let criados = 0;
      let atualizados = 0;
      let skipped = 0;
      const errors = [];

      const cache = {
        empresa: new Map(),
        setor: new Map(),
        cargo: new Map(),
        turno: new Map(),
        escala: new Map(),
        estacao: new Map(),
      };

      /* ================= HELPERS ================= */

      const parseDateBR = (v) => {
        if (!v) return null;
        const [d, m, y] = String(v).trim().split("/");
        if (!d || !m || !y) return null;
        const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
        return isNaN(date.getTime()) ? null : date;
      };

      const parseHorario = (v) => {
        if (!v) return null;
        const h = String(v).trim();
        if (!/^\d{2}:\d{2}$/.test(h)) return null;
        return new Date(`1970-01-01T${h}:00`);
      };

      const getOrCreate = async (model, uniqueField, value, createData, idField, cacheMap) => {
        const key = value?.trim();
        if (!key) return null;

        if (cacheMap.has(key)) return cacheMap.get(key);

        const found = await prisma[model].findUnique({
          where: { [uniqueField]: key },
          select: { [idField]: true },
        });

        if (found) {
          cacheMap.set(key, found);
          return found;
        }

        const created = await prisma[model].create({
          data: createData,
          select: { [idField]: true },
        });

        cacheMap.set(key, created);
        return created;
      };

      const getOnly = async (model, uniqueField, value, idField, cacheMap) => {
        const key = value?.trim();
        if (!key) return null;

        if (cacheMap.has(key)) return cacheMap.get(key);

        const found = await prisma[model].findUnique({
          where: { [uniqueField]: key },
          select: { [idField]: true },
        });

        cacheMap.set(key, found || null);
        return found;
      };

      /* ================= LOOP CSV ================= */
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let opsId = null;

        try {
          opsId = String(row["Ops ID"] || "").trim();
          if (!opsId) {
            skipped++;
            continue;
          }

          const nomeCompleto = String(
            row["Nome do Funcionário"] || row["Nome"] || ""
          ).trim();

          const matricula = String(
            row["Matrícula"] || row["Matricula"] || ""
          ).trim();

          if (!nomeCompleto || !matricula) {
            skipped++;
            continue;
          }

          const dataAdmissao = parseDateBR(row["Data de admissão"]);
          if (!dataAdmissao) {
            skipped++;
            continue;
          }

          /* ================= ORGANIZAÇÃO ================= */

          const empresa = await getOrCreate(
            "empresa",
            "razaoSocial",
            row["Empresa"],
            { razaoSocial: row["Empresa"], ativo: true },
            "idEmpresa",
            cache.empresa
          );

          const setor = await getOrCreate(
            "setor",
            "nomeSetor",
            row["Setor"],
            { nomeSetor: row["Setor"], ativo: true },
            "idSetor",
            cache.setor
          );

          const cargo = await getOrCreate(
            "cargo",
            "nomeCargo",
            row["Cargo"],
            { nomeCargo: row["Cargo"], ativo: true },
            "idCargo",
            cache.cargo
          );

          // ❗ NÃO CRIA TURNO
          const turno = await getOnly(
            "turno",
            "nomeTurno",
            row["Turno"],
            "idTurno",
            cache.turno
          );

          // ❗ NÃO CRIA ESCALA
          const escala = await getOnly(
            "escala",
            "nomeEscala",
            row["Escala de trabalho"],
            "idEscala",
            cache.escala
          );

          // ❗ NÃO CRIA ESTAÇÃO
          const estacao = await getOnly(
            "estacao",
            "nomeEstacao",
            row["Estação"],
            "idEstacao",
            cache.estacao
          );

          const horarioInicioJornada =
            parseHorario(row["Início da jornada"]) ||
            new Date("1970-01-01T05:25:00");

          const existing = await prisma.colaborador.findUnique({
            where: { opsId },
            select: { opsId: true },
          });

          /* ================= DATA SAFE ================= */
          const data = {
            opsId,
            nomeCompleto,
            matricula,
            dataAdmissao,
            horarioInicioJornada,
            status: "ATIVO",

            ...(empresa && { idEmpresa: empresa.idEmpresa }),
            ...(setor && { idSetor: setor.idSetor }),
            ...(cargo && { idCargo: cargo.idCargo }),
            ...(turno && { idTurno: turno.idTurno }),
            ...(escala && { idEscala: escala.idEscala }),
            ...(estacao && { idEstacao: estacao.idEstacao }),
          };

          await prisma.colaborador.upsert({
            where: { opsId },
            update: data,
            create: data,
          });

          existing ? atualizados++ : criados++;
        } catch (err) {
          skipped++;
          errors.push(`Linha ${i + 1} (Ops ${opsId || "N/A"}): ${err.message}`);
        }
      }

      console.log("✅ Import CSV finalizado", {
        total: rows.length,
        criados,
        atualizados,
        skipped,
        erros: errors.length,
      });
    });
  } catch (err) {
    console.error("❌ ERRO IMPORT CSV:", err);
    return errorResponse(res, "Erro ao iniciar importação", 500, err);
  }
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
  getColaboradorById,
  getByOpsId,
  getColaboradorStats,
  getColaboradorHistorico,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  movimentarColaborador,
  importColaboradores,
};