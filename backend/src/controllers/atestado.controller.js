/**
 * Controller de Atestado Médico
 * Upload via Cloudflare Worker
 * Datas normalizadas para o fuso do Brasil
 */

const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");

const crypto = require("crypto");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getR2Client } = require("../services/r2");

const BUCKET = process.env.R2_BUCKET_NAME;

/* =====================================================
   DATAS — BRASIL (FIX DEFINITIVO)
===================================================== */

function dateOnlyBrasil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function calcDias(dataInicio, dataFim) {
  const ini = dateOnlyBrasil(dataInicio);
  const fim = dateOnlyBrasil(dataFim);

  const diffMs = fim.getTime() - ini.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDias + 1;
}
const getAtestadoById = async (req, res) => {
  try {
    const { id } = req.params;

    const atestado = await prisma.atestadoMedico.findUnique({
      where: { idAtestado: Number(id) },
      include: {
        colaborador: {
          select: {
            opsId: true,
            nomeCompleto: true,
            matricula: true,
          },
        },
      },
    });

    if (!atestado) {
      return notFoundResponse(res, "Atestado não encontrado");
    }

    return successResponse(res, atestado);
  } catch (err) {
    console.error("❌ GET ATESTADO BY ID:", err);
    return errorResponse(res, "Erro ao buscar atestado", 500);
  }
};

/* =====================================================
   UPLOAD (via Cloudflare Worker)
===================================================== */
const presignUpload = async (req, res) => {
  try {
    const { opsId } = req.body;

    if (!opsId) {
      return errorResponse(res, "opsId é obrigatório", 400);
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    if (!process.env.R2_WORKER_UPLOAD_URL) {
      return errorResponse(
        res,
        "R2_WORKER_UPLOAD_URL não configurado",
        500
      );
    }

    const key = `atestados/${opsId}/${crypto.randomUUID()}.pdf`;

    return successResponse(res, {
      key,
      uploadUrl: `${process.env.R2_WORKER_UPLOAD_URL}/${key}`,
    });
  } catch (err) {
    console.error("❌ presignUpload:", err);
    return errorResponse(res, "Erro ao gerar URL de upload", 500);
  }
};

/* =====================================================
   DOWNLOAD (Presigned GET)
===================================================== */
const presignDownload = async (req, res) => {
  try {
    const { id } = req.params;

    if (!BUCKET) {
      return errorResponse(res, "R2_BUCKET_NAME não configurado", 500);
    }

    const atestado = await prisma.atestadoMedico.findUnique({
      where: { idAtestado: Number(id) },
    });

    if (!atestado || !atestado.documentoAnexo) {
      return notFoundResponse(res, "Documento não encontrado");
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: atestado.documentoAnexo,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="atestado-${id}.pdf"`,
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 600 });

    return successResponse(res, { url, expiresIn: 600 });
  } catch (err) {
    console.error("❌ presignDownload:", err);
    return errorResponse(res, "Erro ao gerar URL de download", 500);
  }
};

/* =====================================================
   CREATE
===================================================== */
const createAtestado = async (req, res) => {
  try {
    const {
      opsId,
      dataInicio,
      dataFim,
      cid,
      observacao,
      documentoKey,
      diasAfastamento,
    } = req.body;

    if (!opsId || !dataInicio || !dataFim || !documentoKey) {
      return errorResponse(
        res,
        "opsId, datas e documento PDF são obrigatórios",
        400
      );
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const dias =
      diasAfastamento && Number(diasAfastamento) > 0
        ? Number(diasAfastamento)
        : calcDias(dataInicio, dataFim);

    const atestado = await prisma.atestadoMedico.create({
      data: {
        opsId,
        dataInicio: dateOnlyBrasil(dataInicio),
        dataFim: dateOnlyBrasil(dataFim),
        diasAfastamento: dias,
        cid: cid || null,
        observacao: observacao || null,
        documentoAnexo: documentoKey,
        status: "ATIVO",
      },
    });

    return createdResponse(res, atestado, "Atestado criado com sucesso");
  } catch (err) {
    console.error("❌ CREATE ATESTADO:", err);
    return errorResponse(res, "Erro ao criar atestado", 500);
  }
};

/* =====================================================
   GET ALL
===================================================== */
const getAllAtestados = async (req, res) => {
  try {
    const { opsId } = req.query;

    const atestados = await prisma.atestadoMedico.findMany({
      where: opsId ? { opsId } : {},
      orderBy: { dataInicio: "desc" },
      include: {
        colaborador: {
          select: {
            opsId: true,
            nomeCompleto: true,
            matricula: true,
          },
        },
      },
    });

    return successResponse(res, atestados);
  } catch (err) {
    console.error("❌ GET ATESTADOS:", err);
    return errorResponse(res, "Erro ao buscar atestados", 500);
  }
};

/* =====================================================
   UPDATE / FINALIZAR / CANCELAR
===================================================== */
const updateAtestado = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.dataInicio) data.dataInicio = dateOnlyBrasil(data.dataInicio);
    if (data.dataFim) data.dataFim = dateOnlyBrasil(data.dataFim);

    if (data.documentoKey) {
      data.documentoAnexo = data.documentoKey;
      delete data.documentoKey;
    }

    const atestado = await prisma.atestadoMedico.update({
      where: { idAtestado: Number(id) },
      data,
    });

    return successResponse(res, atestado, "Atestado atualizado com sucesso");
  } catch (err) {
    console.error("❌ UPDATE ATESTADO:", err);
    return errorResponse(res, "Erro ao atualizar atestado", 500);
  }
};

const finalizarAtestado = async (req, res) => {
  const { id } = req.params;
  const atestado = await prisma.atestadoMedico.update({
    where: { idAtestado: Number(id) },
    data: { status: "FINALIZADO" },
  });
  return successResponse(res, atestado, "Atestado finalizado");
};

const cancelarAtestado = async (req, res) => {
  const { id } = req.params;
  const atestado = await prisma.atestadoMedico.update({
    where: { idAtestado: Number(id) },
    data: { status: "CANCELADO" },
  });
  return successResponse(res, atestado, "Atestado cancelado");
};

module.exports = {
  presignUpload,
  presignDownload,
  createAtestado,
  getAllAtestados,
  getAtestadoById,
  updateAtestado,
  finalizarAtestado,
  cancelarAtestado,
};
