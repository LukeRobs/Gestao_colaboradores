/**
 * Controller de Ausência
 * Gerencia ausências prolongadas (férias, afastamentos, etc)
 */

const { prisma } = require('../config/database');
const { successResponse, createdResponse, deletedResponse, notFoundResponse, paginatedResponse } = require('../utils/response');

const getAllAusencias = async (req, res) => {
  const { page = 1, limit = 10, opsId, status, idTipoAusencia } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) ? req.dbContext.estacaoId : null;

  const where = {};
  if (opsId) where.opsId = opsId;
  if (status) where.status = status;
  if (idTipoAusencia) where.idTipoAusencia = parseInt(idTipoAusencia);
  if (estacaoId) where.colaborador = { is: { idEstacao: estacaoId } };

  const [ausencias, total] = await Promise.all([
    prisma.ausencia.findMany({
      where,
      skip,
      take,
      orderBy: { dataInicio: 'desc' },
      include: {
        colaborador: { select: { opsId: true, nomeCompleto: true, matricula: true, setor: true, cargo: true } },
        tipoAusencia: true,
      },
    }),
    prisma.ausencia.count({ where }),
  ]);

  return paginatedResponse(res, ausencias, { page: parseInt(page), limit: parseInt(limit), total });
};

const getAusenciaById = async (req, res) => {
  const { id } = req.params;

  const ausencia = await prisma.ausencia.findUnique({
    where: { idAusencia: parseInt(id) },
    include: {
      colaborador: { select: { opsId: true, nomeCompleto: true, matricula: true, setor: true, cargo: true } },
      tipoAusencia: true,
    },
  });

  if (!ausencia) return notFoundResponse(res, 'Ausência não encontrada');
  return successResponse(res, ausencia);
};

const createAusencia = async (req, res) => {
  const { opsId, idTipoAusencia, dataInicio, dataFim, dataPrevistaRetorno, diasCorridos, diasUteis, motivo, documentoAnexo, numeroProtocolo, status } = req.body;

  const novaInicio = new Date(dataInicio);
  const novaFim = new Date(dataFim);

  // Desativa ausências ativas do mesmo tipo que se sobrepõem com o novo período
  await prisma.ausencia.updateMany({
    where: {
      opsId,
      idTipoAusencia: parseInt(idTipoAusencia),
      status: 'ATIVO',
      dataInicio: { lte: novaFim },
      dataFim: { gte: novaInicio },
    },
    data: { status: 'CANCELADO' },
  });

  const ausencia = await prisma.ausencia.create({
    data: {
      opsId,
      idTipoAusencia: parseInt(idTipoAusencia),
      dataInicio: novaInicio,
      dataFim: novaFim,
      dataPrevistaRetorno: dataPrevistaRetorno ? new Date(dataPrevistaRetorno) : null,
      diasCorridos: diasCorridos ? parseInt(diasCorridos) : null,
      diasUteis: diasUteis ? parseInt(diasUteis) : null,
      motivo,
      documentoAnexo,
      numeroProtocolo,
      status: status || 'ATIVO',
      registradoPor: req.user?.id || 'sistema',
    },
    include: { colaborador: true, tipoAusencia: true },
  });

  return createdResponse(res, ausencia, 'Ausência registrada com sucesso');
};

const updateAusencia = async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  if (updateData.dataInicio) updateData.dataInicio = new Date(updateData.dataInicio);
  if (updateData.dataFim) updateData.dataFim = new Date(updateData.dataFim);
  if (updateData.dataPrevistaRetorno) updateData.dataPrevistaRetorno = new Date(updateData.dataPrevistaRetorno);
  if (updateData.idTipoAusencia) updateData.idTipoAusencia = parseInt(updateData.idTipoAusencia);
  if (updateData.diasCorridos) updateData.diasCorridos = parseInt(updateData.diasCorridos);
  if (updateData.diasUteis) updateData.diasUteis = parseInt(updateData.diasUteis);

  const ausencia = await prisma.ausencia.update({
    where: { idAusencia: parseInt(id) },
    data: updateData,
    include: { colaborador: true, tipoAusencia: true },
  });

  return successResponse(res, ausencia, 'Ausência atualizada com sucesso');
};

const deleteAusencia = async (req, res) => {
  const { id } = req.params;
  await prisma.ausencia.delete({ where: { idAusencia: parseInt(id) } });
  return deletedResponse(res, 'Ausência excluída com sucesso');
};

const finalizarAusencia = async (req, res) => {
  const { id } = req.params;

  const ausencia = await prisma.ausencia.update({
    where: { idAusencia: parseInt(id) },
    data: { status: 'FINALIZADO' },
  });

  return successResponse(res, ausencia, 'Ausência finalizada com sucesso');
};

const getAusenciasAtivas = async (req, res) => {
  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) ? req.dbContext.estacaoId : null;

  const ausencias = await prisma.ausencia.findMany({
    where: {
      status: 'ATIVO',
      dataInicio: { lte: new Date() },
      dataFim: { gte: new Date() },
      ...(estacaoId && { colaborador: { is: { idEstacao: estacaoId } } }),
    },
    include: {
      colaborador: { select: { opsId: true, nomeCompleto: true, matricula: true, setor: true, cargo: true } },
      tipoAusencia: true,
    },
    orderBy: { dataInicio: 'desc' },
  });

  return successResponse(res, ausencias, 'Ausências ativas recuperadas com sucesso');
};

module.exports = {
  getAllAusencias,
  getAusenciaById,
  createAusencia,
  updateAusencia,
  deleteAusencia,
  finalizarAusencia,
  getAusenciasAtivas,
};
