/**
 * Controller de Medida Disciplinar
 * Cloudflare R2 + Presigned URLs
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
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getR2Client } = require("../services/r2");

const BUCKET = process.env.R2_BUCKET_NAME;

/* ================= UTIL ================= */

function normalizeDateOnly(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

/* ================= PRESIGN UPLOAD =================
POST /api/medidas-disciplinares/presign-upload
body: { opsId, filename, contentType, size }
*/
const presignUpload = async (req, res) => {
  try {
    const { opsId, filename, contentType, size } = req.body;

    if (!BUCKET) {
      return errorResponse(res, 500, "R2_BUCKET_NAME não configurado");
    }

    if (!opsId || !filename || !contentType) {
      return errorResponse(res, 400, "opsId, filename e contentType são obrigatórios");
    }

    if (contentType !== "application/pdf") {
      return errorResponse(res, 400, "Apenas arquivos PDF são permitidos");
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (size && Number(size) > maxBytes) {
      return errorResponse(res, 400, "O PDF excede o limite de 5MB");
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const id = crypto.randomUUID();
    const key = `medidas-disciplinares/${opsId}/${id}.pdf`;

    const r2 = getR2Client();

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: "application/pdf",
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 60 * 5, // 5 minutos
    });

    return successResponse(res, {
      key,
      uploadUrl,
      expiresIn: 300,
    });
  } catch (err) {
    console.error("❌ PRESIGN UPLOAD MD:", err);
    return errorResponse(res, 500, "Erro ao gerar URL de upload", err);
  }
};

/* ================= PRESIGN DOWNLOAD =================
GET /api/medidas-disciplinares/:id/presign-download
*/
const presignDownload = async (req, res) => {
  try {
    const { id } = req.params;

    if (!BUCKET) {
      return errorResponse(res, 500, "R2_BUCKET_NAME não configurado");
    }

    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) },
    });

    if (!medida) {
      return notFoundResponse(res, "Medida disciplinar não encontrada");
    }

    if (!medida.documentoAnexo) {
      return errorResponse(res, 400, "Documento não encontrado para esta medida");
    }

    const r2 = getR2Client();

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: medida.documentoAnexo,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="md-${id}.pdf"`,
    });

    const url = await getSignedUrl(r2, command, {
      expiresIn: 60 * 10, // 10 minutos
    });

    return successResponse(res, {
      url,
      expiresIn: 600,
    });
  } catch (err) {
    console.error("❌ PRESIGN DOWNLOAD MD:", err);
    return errorResponse(res, 500, "Erro ao gerar URL de download", err);
  }
};

/* ================= CREATE =================
POST /api/medidas-disciplinares
body: { opsId, dataAplicacao, tipoMedida, motivo, documentoKey }
*/
const createMedida = async (req, res) => {
  try {
    const {
      opsId,
      dataAplicacao,
      tipoMedida,
      motivo,
      documentoKey,
    } = req.body;

    if (!opsId || !dataAplicacao || !tipoMedida || !motivo || !documentoKey) {
      return errorResponse(
        res,
        400,
        "Campos obrigatórios: opsId, dataAplicacao, tipoMedida, motivo e documentoKey"
      );
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const medida = await prisma.medidaDisciplinar.create({
      data: {
        opsId,
        dataAplicacao: normalizeDateOnly(dataAplicacao),
        tipoMedida,
        motivo,
        documentoAnexo: documentoKey,
      },
    });

    return createdResponse(res, medida, "Medida disciplinar registrada com sucesso");
  } catch (err) {
    console.error("❌ CREATE MD:", err);
    return errorResponse(res, 500, "Erro ao criar medida disciplinar", err);
  }
};

/* ================= GET ALL ================= */
const getAllMedidas = async (req, res) => {
  try {
    const { opsId } = req.query;
    const where = opsId ? { opsId } : {};

    const medidas = await prisma.medidaDisciplinar.findMany({
      where,
      orderBy: { dataAplicacao: "desc" },
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

    return successResponse(res, medidas);
  } catch (err) {
    console.error("❌ GET MD:", err);
    return errorResponse(res, 500, "Erro ao buscar medidas disciplinares", err);
  }
};

/* ================= GET BY ID ================= */
const getMedidaById = async (req, res) => {
  try {
    const { id } = req.params;

    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) },
      include: { colaborador: true },
    });

    if (!medida) {
      return notFoundResponse(res, "Medida disciplinar não encontrada");
    }

    return successResponse(res, medida);
  } catch (err) {
    console.error("❌ GET MD BY ID:", err);
    return errorResponse(res, 500, "Erro ao buscar medida disciplinar", err);
  }
};

module.exports = {
  presignUpload,
  presignDownload,
  createMedida,
  getAllMedidas,
  getMedidaById,
};
