/**
 * Controller de Colaborador
 * Gerencia operações CRUD e lógica de negócio dos colaboradores
 */

const { prisma } = require('../config/database');
const {
  successResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
  errorResponse,
} = require('../utils/response');

/**
 * Lista todos os colaboradores com filtros avançados
 * GET /api/colaboradores
 */
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
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { matricula: { contains: search, mode: 'insensitive' } },
      { opsId: { startsWith: search, mode: 'insensitive' } },
    ];
  }

  if (status) where.status = status;
  if (idSetor) where.idSetor = Number(idSetor);
  if (idCargo) where.idCargo = Number(idCargo);
  if (idEmpresa) where.idEmpresa = Number(idEmpresa);
  if (idLider) where.idLider = idLider;

  try {
    const [colaboradores, total] = await Promise.all([
      prisma.colaborador.findMany({
        where,
        skip,
        take,
        orderBy: { nomeCompleto: "asc" },
        include: {
          empresa: true,
          cargo: true,
          setor: true,
          lider: { select: { opsId: true, nomeCompleto: true } },
        },
      }),

      prisma.colaborador.count({ where }),
    ]);

    return paginatedResponse(res, colaboradores, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });

  } catch (err) {
    console.error("🔥 ERRO COMPLETO NO getAllColaboradores:", err);
    return errorResponse(res, 500, "Erro ao buscar colaboradores", err);
  }
};

/**
 * Buscar colaborador por ID
 */
const getColaboradorById = async (req, res) => {
  const { opsId } = req.params;

  const colaborador = await prisma.colaborador.findUnique({
    where: { opsId },
    include: {
      setor: true,
      cargo: true,
      empresa: true,
      contrato: true,
      estacao: true,
      turno: true,
      escala: true,
      lider: {
        select: { opsId: true, nomeCompleto: true, matricula: true },
      },
      subordinados: {
        select: {
          opsId: true,
          nomeCompleto: true,
          matricula: true,
          cargo: { select: { nomeCargo: true } },
          status: true,
        },
      },
      _count: {
        select: { subordinados: true, frequencias: true, ausencias: true },
      },
    },
  });

  if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");

  return successResponse(res, colaborador);
};

/**
 * Criar colaborador
 */
const createColaborador = async (req, res) => {
  try {
    const {
      opsId,
      nomeCompleto,
      cpf,
      telefone,
      dataNascimento,
      email,
      genero,
      matricula,
      dataAdmissao,
      horarioInicioJornada,

      empresaNome,
      cargoNome,

      idSetor,
      idLider,
      idEstacao,
      idContrato,
      idEscala,
      idTurno,
      status,
    } = req.body;

    // Buscar empresa pelo nome
    let empresa = null;
    if (empresaNome) {
      empresa = await prisma.empresa.findFirst({ where: { razaoSocial: empresaNome } });
      if (!empresa) return errorResponse(res, 400, `Empresa '${empresaNome}' não encontrada.`);
    }

    // Buscar cargo pelo nome
    let cargo = null;
    if (cargoNome) {
      cargo = await prisma.cargo.findFirst({ where: { nomeCargo: cargoNome } });
      if (!cargo) return errorResponse(res, 400, `Cargo '${cargoNome}' não encontrado.`);
    }

    // Horário
    let horario = null;
    if (horarioInicioJornada && horarioInicioJornada.trim() !== "") {
      const dt = new Date(`1970-01-01T${horarioInicioJornada}:00Z`);
      horario = isNaN(dt.getTime()) ? null : dt;
    }

    const colaborador = await prisma.colaborador.create({
      data: {
        opsId,
        nomeCompleto,
        cpf,
        telefone,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
        email,
        genero,
        matricula,
        dataAdmissao: new Date(dataAdmissao),
        horarioInicioJornada: horario,

        idEmpresa: empresa?.idEmpresa ?? null,
        idCargo: cargo?.idCargo ?? null,

        idSetor: idSetor ? Number(idSetor) : null,
        idLider: idLider || null,
        idEstacao: idEstacao ? Number(idEstacao) : null,
        idContrato: idContrato ? Number(idContrato) : null,
        idEscala: idEscala ? Number(idEscala) : null,
        idTurno: idTurno ? Number(idTurno) : null,

        status: status || "ATIVO",
      },
    });

    return createdResponse(res, colaborador, "Colaborador criado com sucesso");

  } catch (error) {
    console.error("❌ ERRO CREATE:", error);
    return errorResponse(res, 500, "Erro ao criar colaborador", error);
  }
};

/**
 * Atualizar colaborador
 */
const updateColaborador = async (req, res) => {
  const { opsId } = req.params;
  const updateData = { ...req.body };

  const HORARIOS_PERMITIDOS = ["05:25", "13:20", "21:00"];

  // Datas
  if (updateData.dataAdmissao)
    updateData.dataAdmissao = new Date(updateData.dataAdmissao);

  if (updateData.dataDesligamento)
    updateData.dataDesligamento = new Date(updateData.dataDesligamento);

  // Horário validado
  if (updateData.horarioInicioJornada) {
    const hora = updateData.horarioInicioJornada.trim();

    if (!HORARIOS_PERMITIDOS.includes(hora)) {
      return errorResponse(
        res,
        `Horário inválido. Permitidos: ${HORARIOS_PERMITIDOS.join(", ")}`,
        400
      );
    }

    updateData.horarioInicioJornada = new Date(`1970-01-01T${hora}:00Z`);
  }

  // Inteiros + conversão de "" → null
  [
    "idSetor",
    "idCargo",
    "idEstacao",
    "idEmpresa",
    "idContrato",
    "idEscala",
    "idTurno",
  ].forEach((field) => {
    if (updateData[field] === "" || updateData[field] === undefined) {
      updateData[field] = null;
    } else {
      updateData[field] = Number(updateData[field]);
    }
  });

  // Remover campos que NÃO existem no banco
  delete updateData.empresaNome;
  delete updateData.cargoNome;

  const colaborador = await prisma.colaborador.update({
    where: { opsId },
    data: updateData,
    include: {
      setor: true,
      cargo: true,
      empresa: true,
      lider: { select: { opsId: true, nomeCompleto: true } },
    },
  });

  return successResponse(res, colaborador, "Colaborador atualizado com sucesso");
};

/**
 * Deletar colaborador
 */
const deleteColaborador = async (req, res) => {
  const { opsId } = req.params;
  await prisma.colaborador.delete({ where: { opsId } });
  return deletedResponse(res, "Colaborador excluído com sucesso");
};

module.exports = {
  getAllColaboradores,
  getColaboradorById,
  createColaborador,
  updateColaborador,
  deleteColaborador,
};
