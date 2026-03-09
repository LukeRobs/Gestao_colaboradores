/**
 * Controller de Medida Disciplinar
 * Cloudflare R2 + Presigned URLs
 * CPF como entrada (padrão definitivo)
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

/* =====================================================
   DATAS — BRASIL (FIX DEFINITIVO)
===================================================== */
function dateOnlyBrasil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // meio-dia
}

/* =====================================================
   PRESIGN UPLOAD
===================================================== */
const presignUpload = async (req, res) => {
  try {
    const { cpf } = req.body;

    if (!cpf) {
      return errorResponse(res, "CPF é obrigatório", 400);
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      return errorResponse(res, "CPF inválido", 400);
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
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

    const key = `medidas-disciplinares/${colaborador.opsId}/${crypto.randomUUID()}.pdf`;

    return successResponse(res, {
      key,
      uploadUrl: `${process.env.R2_WORKER_UPLOAD_URL}/${key}`,
    });
  } catch (err) {
    console.error("❌ presignUpload MD:", err);
    return errorResponse(res, "Erro ao gerar URL de upload", 500);
  }
};

/* =====================================================
   PRESIGN DOWNLOAD
===================================================== */
const presignDownload = async (req, res) => {
  try {
    const { id } = req.params;

    if (!BUCKET) {
      return errorResponse(res, "R2_BUCKET_NAME não configurado", 500);
    }

    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) },
    });

    if (!medida || !medida.documentoAnexo) {
      return notFoundResponse(res, "Documento não encontrado");
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: medida.documentoAnexo,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="medida-${id}.pdf"`,
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 600 });

    return successResponse(res, { url, expiresIn: 600 });
  } catch (err) {
    console.error("❌ PRESIGN DOWNLOAD MD:", err);
    return errorResponse(res, "Erro ao gerar URL de download", 500);
  }
};

/* =====================================================
   CREATE
===================================================== */
const createMedida = async (req, res) => {
  try {
    const { cpf, dataAplicacao, tipoMedida, motivo, documentoKey } = req.body;

    if (!cpf || !dataAplicacao || !tipoMedida || !motivo || !documentoKey) {
      return errorResponse(
        res,
        "CPF, dataAplicacao, tipoMedida, motivo e documento são obrigatórios",
        400
      );
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return errorResponse(res, "CPF inválido", 400);
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const medida = await prisma.medidaDisciplinar.create({
      data: {
        opsId: colaborador.opsId,
        dataAplicacao: dateOnlyBrasil(dataAplicacao),
        tipoMedida,
        motivo,
        documentoAnexo: documentoKey,
      },
    });

    return createdResponse(
      res,
      medida,
      "Medida disciplinar registrada com sucesso"
    );
  } catch (err) {
    console.error("❌ CREATE MD:", err);
    return errorResponse(res, "Erro ao criar medida disciplinar", 500);
  }
};

/* =====================================================
   GET ALL
===================================================== */
const getAllMedidas = async (req, res) => {
  try {
    const { cpf, opsId, data, nome } = req.query;
    const where = {};

    if (data) {

      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59`);

      where.dataAplicacao = {
        gte: inicio,
        lte: fim
      };
    }

    if (nome) {
      where.colaborador = {
        is: {
          nomeCompleto: {
            contains: nome,
            mode: "insensitive",
          },
        },
      };
    }
    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      if (cpfLimpo.length !== 11) {
        return errorResponse(res, "CPF inválido", 400);
      }

      const colab = await prisma.colaborador.findFirst({
        where: { cpf: cpfLimpo },
      });

      if (!colab) return successResponse(res, []);
      where.opsId = colab.opsId;
    } else if (opsId) {
      where.opsId = opsId;
    }

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
    return errorResponse(res, "Erro ao buscar medidas disciplinares", 500);
  }
};

/* =====================================================
   GET BY ID
===================================================== */
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
    return errorResponse(res, "Erro ao buscar medida disciplinar", 500);
  }
};

module.exports = {
  presignUpload,
  presignDownload,
  createMedida,
  getAllMedidas,
  getMedidaById,
};
