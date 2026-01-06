/**
 * Controller de Atestado Médico
 * Upload via Cloudflare Worker
 * Download via Presigned GET (R2)
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
   UTIL
===================================================== */

function normalizeDateOnly(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function calcDias(dataInicio, dataFim) {
  const ini = normalizeDateOnly(dataInicio);
  const fim = normalizeDateOnly(dataFim);
  const diff =
    Math.floor((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff;
}

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
      include: {
        colaborador: {
          select: { opsId: true, nomeCompleto: true },
        },
      },
    });

    if (!atestado) {
      return notFoundResponse(res, "Atestado não encontrado");
    }

    if (!atestado.documentoAnexo) {
      return errorResponse(res, "Atestado não possui documento", 400);
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: atestado.documentoAnexo,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="atestado-${atestado.idAtestado}.pdf"`,
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
        dataInicio: normalizeDateOnly(dataInicio),
        dataFim: normalizeDateOnly(dataFim),
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
   GET BY ID
===================================================== */
const getAtestadoById = async (req, res) => {
  try {
    const { id } = req.params;

    const atestado = await prisma.atestadoMedico.findUnique({
      where: { idAtestado: Number(id) },
      include: { colaborador: true },
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
   UPDATE
===================================================== */
const updateAtestado = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.dataInicio) data.dataInicio = normalizeDateOnly(data.dataInicio);
    if (data.dataFim) data.dataFim = normalizeDateOnly(data.dataFim);

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

/* =====================================================
   FINALIZAR / CANCELAR
===================================================== */
const finalizarAtestado = async (req, res) => {
  try {
    const { id } = req.params;

    const atestado = await prisma.atestadoMedico.update({
      where: { idAtestado: Number(id) },
      data: { status: "FINALIZADO" },
    });

    return successResponse(res, atestado, "Atestado finalizado");
  } catch (err) {
    console.error("❌ FINALIZAR ATESTADO:", err);
    return errorResponse(res, "Erro ao finalizar atestado", 500);
  }
};

const cancelarAtestado = async (req, res) => {
  try {
    const { id } = req.params;

    const atestado = await prisma.atestadoMedico.update({
      where: { idAtestado: Number(id) },
      data: { status: "CANCELADO" },
    });

    return successResponse(res, atestado, "Atestado cancelado");
  } catch (err) {
    console.error("❌ CANCELAR ATESTADO:", err);
    return errorResponse(res, "Erro ao cancelar atestado", 500);
  }
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
