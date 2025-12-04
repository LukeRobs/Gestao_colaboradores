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
      { opsId: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) where.status = status;
  if (idSetor) where.idSetor = parseInt(idSetor);
  if (idCargo) where.idCargo = parseInt(idCargo);
  if (idEmpresa) where.idEmpresa = parseInt(idEmpresa);
  if (idLider) where.idLider = idLider;

  const [colaboradores, total] = await Promise.all([
    prisma.colaborador.findMany({
      where,
      skip,
      take,
      orderBy: { nomeCompleto: 'asc' },
      include: {
        setor: { select: { idSetor: true, nomeSetor: true } },
        cargo: { select: { idCargo: true, nomeCargo: true, nivel: true } },
        empresa: { select: { idEmpresa: true, razaoSocial: true } },
        lider: { select: { opsId: true, nomeCompleto: true, matricula: true } },
        estacao: { select: { idEstacao: true, nomeEstacao: true } },
        turno: { select: { idTurno: true, nomeTurno: true } },
        escala: { select: { idEscala: true, nomeEscala: true, tipoEscala: true } },
      },
    }),
    prisma.colaborador.count({ where }),
  ]);

  return paginatedResponse(
    res,
    colaboradores,
    { page: parseInt(page), limit: parseInt(limit), total }
  );
};

/**
 * Busca um colaborador por ID (ops_id)
 * GET /api/colaboradores/:opsId
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
        select: { opsId: true, nomeCompleto: true, matricula: true, cargo: true },
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
        select: {
          subordinados: true,
          frequencias: true,
          ausencias: true,
        },
      },
    },
  });

  if (!colaborador) {
    return notFoundResponse(res, 'Colaborador não encontrado');
  }

  return successResponse(res, colaborador);
};

/**
 * Cria um novo colaborador
 * POST /api/colaboradores
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

      empresaNome, // vem do front
      cargoNome,   // vem do front

      idSetor,
      idLider,
      idEstacao,
      idContrato,
      idEscala,
      idTurno,
      status,
    } = req.body;

    // ------------------------------
    //  BUSCAR EMPRESA PELO NOME
    // ------------------------------
    let empresa = null;
    if (empresaNome) {
      empresa = await prisma.empresa.findFirst({
        where: { razaoSocial: empresaNome },
      });

      if (!empresa) {
        return errorResponse(res, 400, `Empresa '${empresaNome}' não encontrada.`);
      }
    }

    // ------------------------------
    //  BUSCAR CARGO PELO NOME
    // ------------------------------
    let cargo = null;
    if (cargoNome) {
      cargo = await prisma.cargo.findFirst({
        where: { nomeCargo: cargoNome },
      });

      if (!cargo) {
        return errorResponse(res, 400, `Cargo '${cargoNome}' não encontrado.`);
      }
    }

    // ------------------------------
    //  CRIAÇÃO DO COLABORADOR
    // ------------------------------
    const colaborador = await prisma.colaborador.create({
      data: {
        opsId,
        nomeCompleto,
        cpf,
        telefone,
        dataNascimento,
        email,
        genero,
        matricula,
        dataAdmissao: new Date(dataAdmissao),
        horarioInicioJornada: new Date(`1970-01-01T${horarioInicioJornada}`),

        idEmpresa: empresa ? empresa.idEmpresa : null,
        idCargo: cargo ? cargo.idCargo : null,

        idSetor: idSetor ? parseInt(idSetor) : null,
        idLider: idLider || null,
        idEstacao: idEstacao ? parseInt(idEstacao) : null,
        idContrato: idContrato ? parseInt(idContrato) : null,
        idEscala: idEscala ? parseInt(idEscala) : null,
        idTurno: idTurno ? parseInt(idTurno) : null,
        status: status || 'ATIVO',
      },
      include: {
        setor: true,
        cargo: true,
        empresa: true,
        lider: { select: { opsId: true, nomeCompleto: true } },
      },
    });

    return createdResponse(res, colaborador, 'Colaborador criado com sucesso');
  } catch (error) {
    return errorResponse(res, 500, 'Erro ao criar colaborador', error);
  }
};

/**
 * Atualiza um colaborador
 * PUT /api/colaboradores/:opsId
 */
const updateColaborador = async (req, res) => {
  const { opsId } = req.params;
  const updateData = { ...req.body };

  if (updateData.dataAdmissao) {
    updateData.dataAdmissao = new Date(updateData.dataAdmissao);
  }
  if (updateData.dataDesligamento) {
    updateData.dataDesligamento = new Date(updateData.dataDesligamento);
  }
  if (updateData.horarioInicioJornada) {
    updateData.horarioInicioJornada = new Date(`1970-01-01T${updateData.horarioInicioJornada}`);
  }

  ['idSetor', 'idCargo', 'idEstacao', 'idEmpresa', 'idContrato', 'idEscala', 'idTurno'].forEach(field => {
    if (updateData[field]) {
      updateData[field] = parseInt(updateData[field]);
    }
  });

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

  return successResponse(res, colaborador, 'Colaborador atualizado com sucesso');
};

/**
 * Deleta um colaborador
 * DELETE /api/colaboradores/:opsId
 */
const deleteColaborador = async (req, res) => {
  const { opsId } = req.params;

  await prisma.colaborador.delete({
    where: { opsId },
  });

  return deletedResponse(res, 'Colaborador excluído com sucesso');
};

/**
 * Estatísticas de um colaborador
 * GET /api/colaboradores/:opsId/stats
 */
const getColaboradorStats = async (req, res) => {
  const { opsId } = req.params;
  const { startDate, endDate } = req.query;

  const colaborador = await prisma.colaborador.findUnique({
    where: { opsId },
    select: { opsId: true, nomeCompleto: true, matricula: true },
  });

  if (!colaborador) return notFoundResponse(res, 'Colaborador não encontrado');

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const [frequencias, ausencias, subordinados] = await Promise.all([
    prisma.frequencia.findMany({
      where: {
        opsId,
        ...(Object.keys(dateFilter).length > 0 && { dataReferencia: dateFilter }),
      },
      include: { tipoAusencia: true },
    }),
    prisma.ausencia.findMany({
      where: {
        opsId,
        ...(Object.keys(dateFilter).length > 0 && { dataInicio: dateFilter }),
      },
      include: { tipoAusencia: true },
    }),
    prisma.colaborador.count({
      where: { idLider: opsId, status: 'ATIVO' },
    }),
  ]);

  const diasPresentes = frequencias.filter(
    f => f.tipoAusencia?.codigo === 'P'
  ).length;
  const diasAusentes = frequencias.filter(
    f => f.tipoAusencia?.impactaAbsenteismo
  ).length;
  const totalDias = frequencias.length;
  const percentualAbsenteismo =
    totalDias > 0 ? ((diasAusentes / totalDias) * 100).toFixed(2) : 0;

  return successResponse(res, {
    colaborador,
    periodo: { startDate, endDate },
    frequencia: {
      totalRegistros: totalDias,
      diasPresentes,
      diasAusentes,
      percentualAbsenteismo: parseFloat(percentualAbsenteismo),
    },
    ausencias: {
      total: ausencias.length,
      ativas: ausencias.filter(a => a.status === 'ATIVO').length,
      finalizadas: ausencias.filter(a => a.status === 'FINALIZADO').length,
    },
    lideranca: { subordinados },
  });
};

/**
 * Histórico de movimentações do colaborador
 * GET /api/colaboradores/:opsId/historico
 */
const getColaboradorHistorico = async (req, res) => {
  const { opsId } = req.params;

  const historico = await prisma.historicoMovimentacao.findMany({
    where: { opsId },
    orderBy: { dataEfetivacao: 'desc' },
    include: {
      setorAnt: { select: { nomeSetor: true } },
      setorNov: { select: { nomeSetor: true } },
      cargoAnt: { select: { nomeCargo: true } },
      cargoNov: { select: { nomeCargo: true } },
      estacaoAnt: { select: { nomeEstacao: true } },
      estacaoNov: { select: { nomeEstacao: true } },
      turnoAnt: { select: { nomeTurno: true } },
      turnoNov: { select: { nomeTurno: true } },
      liderAnt: { select: { nomeCompleto: true } },
      liderNov: { select: { nomeCompleto: true } },
    },
  });

  return successResponse(res, historico);
};

module.exports = {
  getAllColaboradores,
  getColaboradorById,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  getColaboradorStats,
  getColaboradorHistorico,
};
