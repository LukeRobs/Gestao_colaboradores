/**
 * Controller de Frequência
 * Gerencia registro de ponto e frequência diária (ADMIN / MANUAL)
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

/* =====================================================
   HELPERS
===================================================== */
function parseDataReferencia(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const data = new Date(y, m - 1, d);
  data.setHours(0, 0, 0, 0);
  return data;
}

function toTimeOnly(timeStr) {
  return new Date(`1970-01-01T${timeStr}`);
}

/* =====================================================
   GET ALL
===================================================== */
const getAllFrequencias = async (req, res) => {
  const { page = 1, limit = 10, opsId, dataInicio, dataFim, idTipoAusencia } =
    req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (opsId) where.opsId = opsId;
  if (idTipoAusencia) where.idTipoAusencia = parseInt(idTipoAusencia);

  if (dataInicio || dataFim) {
    where.dataReferencia = {};
    if (dataInicio) where.dataReferencia.gte = parseDataReferencia(dataInicio);
    if (dataFim) where.dataReferencia.lte = parseDataReferencia(dataFim);
  }

  const [frequencias, total] = await Promise.all([
    prisma.frequencia.findMany({
      where,
      skip,
      take,
      orderBy: { dataReferencia: 'desc' },
      include: {
        colaborador: {
          select: {
            opsId: true,
            nomeCompleto: true,
            matricula: true,
            status: true,
            dataDesligamento: true,
          },
        },
        tipoAusencia: true,
      },
    }),
    prisma.frequencia.count({ where }),
  ]);

  return paginatedResponse(res, frequencias, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
  });
};

/* =====================================================
   GET BY ID
===================================================== */
const getFrequenciaById = async (req, res) => {
  const { id } = req.params;

  const frequencia = await prisma.frequencia.findUnique({
    where: { idFrequencia: parseInt(id) },
    include: {
      colaborador: {
        select: {
          opsId: true,
          nomeCompleto: true,
          matricula: true,
          setor: true,
          cargo: true,
        },
      },
      tipoAusencia: true,
    },
  });

  if (!frequencia)
    return notFoundResponse(res, 'Registro de frequência não encontrado');

  return successResponse(res, frequencia);
};

/* =====================================================
   CREATE (MANUAL / ADMIN)
===================================================== */
const createFrequencia = async (req, res) => {
  const {
    opsId,
    dataReferencia,
    idTipoAusencia,
    horaEntrada,
    horaSaida,
    horasTrabalhadas,
    observacao,
    justificativa,
    documentoAnexo,
  } = req.body;

  if (!opsId || !dataReferencia) {
    return errorResponse(res, 'opsId e dataReferencia são obrigatórios', 400);
  }

  // 🔒 valida colaborador
  const colaborador = await prisma.colaborador.findFirst({
    where: {
      opsId,
      status: 'ATIVO',
      dataDesligamento: null,
    },
  });

  if (!colaborador) {
    return notFoundResponse(res, 'Colaborador não ativo ou desligado');
  }

  // 🔒 valida jornada
  if (horaSaida && !horaEntrada) {
    return errorResponse(
      res,
      'Hora de saída não pode existir sem hora de entrada',
      400
    );
  }

  const dataRef = parseDataReferencia(dataReferencia);

  const frequencia = await prisma.frequencia.create({
    data: {
      opsId,
      dataReferencia: dataRef,
      idTipoAusencia: idTipoAusencia
        ? parseInt(idTipoAusencia)
        : null,
      horaEntrada: horaEntrada ? toTimeOnly(horaEntrada) : null,
      horaSaida: horaSaida ? toTimeOnly(horaSaida) : null,
      horasTrabalhadas: horasTrabalhadas
        ? parseFloat(horasTrabalhadas)
        : null,
      observacao,
      justificativa,
      documentoAnexo,
      manual: true,
      registradoPor: req.user?.id || 'GESTAO',
    },
    include: {
      colaborador: { select: { nomeCompleto: true } },
      tipoAusencia: true,
    },
  });

  return createdResponse(
    res,
    frequencia,
    'Frequência manual registrada com sucesso'
  );
};

/* =====================================================
   UPDATE
===================================================== */
const updateFrequencia = async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  if (updateData.dataReferencia) {
    updateData.dataReferencia = parseDataReferencia(
      updateData.dataReferencia
    );
  }

  if (updateData.horaEntrada) {
    updateData.horaEntrada = toTimeOnly(updateData.horaEntrada);
  }

  if (updateData.horaSaida) {
    if (!updateData.horaEntrada) {
      return errorResponse(
        res,
        'Hora de saída não pode existir sem hora de entrada',
        400
      );
    }
    updateData.horaSaida = toTimeOnly(updateData.horaSaida);
  }

  if (updateData.horasTrabalhadas) {
    updateData.horasTrabalhadas = parseFloat(
      updateData.horasTrabalhadas
    );
  }

  if (updateData.idTipoAusencia) {
    updateData.idTipoAusencia = parseInt(updateData.idTipoAusencia);
  }

  const frequencia = await prisma.frequencia.update({
    where: { idFrequencia: parseInt(id) },
    data: updateData,
    include: { colaborador: true, tipoAusencia: true },
  });

  return successResponse(
    res,
    frequencia,
    'Frequência atualizada com sucesso'
  );
};

/* =====================================================
   DELETE
===================================================== */
const deleteFrequencia = async (req, res) => {
  const { id } = req.params;
  await prisma.frequencia.delete({
    where: { idFrequencia: parseInt(id) },
  });
  return deletedResponse(res, 'Frequência excluída com sucesso');
};

/* =====================================================
   VALIDAR
===================================================== */
const validarFrequencia = async (req, res) => {
  const { id } = req.params;

  const frequencia = await prisma.frequencia.update({
    where: { idFrequencia: parseInt(id) },
    data: {
      validado: true,
      validadoPor: req.user?.id || 'admin',
      dataValidacao: new Date(),
    },
  });

  return successResponse(res, frequencia, 'Frequência validada com sucesso');
};

module.exports = {
  getAllFrequencias,
  getFrequenciaById,
  createFrequencia,
  updateFrequencia,
  deleteFrequencia,
  validarFrequencia,
};
