const { prisma } = require('../config/database');
const { successResponse, createdResponse, deletedResponse, notFoundResponse, paginatedResponse } = require('../utils/response');

const getAllTurnos = async (req, res) => {
  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? req.dbContext.estacaoId
    : null;

  const colaboradoresWhere = {
    status: 'ATIVO',
    ...(estacaoId ? { idEstacao: estacaoId } : {}),
  };

  const turnos = await prisma.turno.findMany({
    orderBy: { nomeTurno: 'asc' },
    include: {
      _count: {
        select: {
          colaboradores: { where: colaboradoresWhere },
        },
      },
    },
  });
  return successResponse(res, turnos);
};

const getTurnoById = async (req, res) => {
  const turno = await prisma.turno.findUnique({ where: { idTurno: parseInt(req.params.id) } });
  if (!turno) return notFoundResponse(res, 'Turno não encontrado');
  return successResponse(res, turno);
};

const createTurno = async (req, res) => {
  const { nomeTurno, horarioInicio, horarioFim } = req.body;
  const turno = await prisma.turno.create({
    data: {
      nomeTurno,
      horarioInicio: new Date(`1970-01-01T${horarioInicio}:00.000Z`),
      horarioFim: new Date(`1970-01-01T${horarioFim}:00.000Z`),
    },
  });
  return createdResponse(res, turno);
};

const updateTurno = async (req, res) => {
  const updateData = {};
  if (req.body.nomeTurno) updateData.nomeTurno = req.body.nomeTurno;
  if (req.body.horarioInicio) updateData.horarioInicio = new Date(`1970-01-01T${req.body.horarioInicio}:00.000Z`);
  if (req.body.horarioFim) updateData.horarioFim = new Date(`1970-01-01T${req.body.horarioFim}:00.000Z`);
  if (req.body.ativo !== undefined) updateData.ativo = req.body.ativo;

  const turno = await prisma.turno.update({ where: { idTurno: parseInt(req.params.id) }, data: updateData });
  return successResponse(res, turno);
};

const deleteTurno = async (req, res) => {
  const total = await prisma.colaborador.count({ where: { idTurno: parseInt(req.params.id) } });
  if (total > 0) {
    return res.status(409).json({
      success: false,
      message: `Não é possível excluir este turno pois ele possui ${total} colaborador(es) vinculado(s).`,
    });
  }
  await prisma.turno.delete({ where: { idTurno: parseInt(req.params.id) } });
  return deletedResponse(res);
};

module.exports = { getAllTurnos, getTurnoById, createTurno, updateTurno, deleteTurno };
