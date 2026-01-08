/**
 * Controller de Acidentes de Trabalho
 */

const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");

const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getR2Client } = require("../services/r2");

const BUCKET = process.env.R2_BUCKET_NAME;

/* ================= UTIL ================= */

// Data somente (Brasil safe)
function normalizeDateOnly(dateStr) {
  if (!dateStr) return null;

  const [y, m, d] = dateStr.split("-").map(Number);

  // ⛔ nunca usar meia-noite
  // ✅ meio-dia evita qualquer problema de timezone
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Hora somente (sem risco de timezone)
function normalizeTimeOnly(timeStr) {
  if (!timeStr) return null;
  return new Date(`1970-01-01T${timeStr}:00`);
}


/* ================= PRESIGN UPLOAD ================= */
const presignUpload = async (req, res) => {
  try {
    const { cpf, files } = req.body;

    if (!cpf) {
      return errorResponse(res, "CPF não informado", 400);
    }

    if (!Array.isArray(files) || files.length === 0) {
      return errorResponse(res, "Nenhum arquivo informado", 400);
    }

    if (files.length > 5) {
      return errorResponse(res, "Máximo de 5 fotos permitido", 400);
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return errorResponse(res, 400, "CPF inválido");
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const opsId = colaborador.opsId;
    const r2 = getR2Client();

    const uploads = await Promise.all(
      files.map(async ({ filename, contentType, size }) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (!allowed.includes(contentType)) {
          throw new Error("Formato de imagem não permitido");
        }

        if (size > 5 * 1024 * 1024) {
          throw new Error("Imagem excede 5MB");
        }

        const id = crypto.randomUUID();
        const key = `acidentes/${opsId}/${id}-${filename}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

        return { key, uploadUrl };
      })
    );

    return successResponse(res, uploads);
  } catch (err) {
    console.error("❌ PRESIGN UPLOAD ACIDENTE:", err);
    return errorResponse(res, err.message || "Erro no upload", 500);
  }
};


/* ================= PRESIGN DOWNLOAD ================= */
const presignDownload = async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return errorResponse(res, "Chave não informada", 400);

    const r2 = getR2Client();

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 600 });

    return successResponse(res, { url });
  } catch (err) {
    console.error("❌ DOWNLOAD ACIDENTE:", err);
    return errorResponse(res, "Erro ao gerar download", 500);
  }
};

/* ================= CREATE ================= */
const createAcidente = async (req, res) => {
  try {
    const {
      cpf,
      nomeRegistrante,
      setor,
      cargo,
      participouIntegracao,
      tipoOcorrencia,
      dataOcorrencia,
      horarioOcorrencia,
      dataComunicacaoHSE,
      localOcorrencia,
      situacaoGeradora,
      agenteCausador,
      parteCorpoAtingida,
      lateralidade,
      tipoLesao,
      acoesImediatas,
      evidencias = [],
    } = req.body;

    if (!cpf || !nomeRegistrante || !dataOcorrencia || !tipoOcorrencia) {
      return errorResponse(res, "Campos obrigatórios não preenchidos", 400);
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return errorResponse(res, 400, "CPF inválido");
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const acidente = await prisma.acidenteTrabalho.create({
      data: {
        opsIdColaborador: colaborador.opsId,
        registradoPor: nomeRegistrante,
        setor,
        cargo,
        participouIntegracao,
        tipoOcorrencia,
        dataOcorrencia: normalizeDateOnly(dataOcorrencia),
        horarioOcorrencia: normalizeTimeOnly(horarioOcorrencia),
        dataComunicacaoHSE: dataComunicacaoHSE
          ? normalizeDateOnly(dataComunicacaoHSE)
          : null,
        localOcorrencia,
        situacaoGeradora,
        agenteCausador,
        parteCorpoAtingida,
        lateralidade,
        tipoLesao,
        acoesImediatas,
        evidencias: {
          create: evidencias.map((key) => ({
            arquivoUrl: key,
          })),
        },
      },
    });

    return createdResponse(res, acidente, "Acidente registrado com sucesso");
  } catch (err) {
    console.error("❌ CREATE ACIDENTE:", err);
    return errorResponse(res, "Erro ao registrar acidente", 500);
  }
};


/* ================= GET ALL ================= */
const getAllAcidentes = async (req, res) => {
  try {
    const { opsId, cpf } = req.query;
    let where = {};

    if (opsId) {
      where.opsIdColaborador = opsId;
    }

    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      if (cpfLimpo.length !== 11) {
        return errorResponse(res, 400, "CPF inválido");
      }

      const colab = await prisma.colaborador.findFirst({
        where: { cpf: cpfLimpo },
      });

      if (!colab) return successResponse(res, []);
      where.opsIdColaborador = colab.opsId;
    }

    const acidentes = await prisma.acidenteTrabalho.findMany({
      where,
      orderBy: { dataOcorrencia: "desc" },
      include: {
        evidencias: true,
      },
    });

    return successResponse(res, acidentes);
  } catch (err) {
    console.error("❌ GET ACIDENTES:", err);
    return errorResponse(res, "Erro ao buscar acidentes", 500);
  }
};


/* ================= GET BY ID ================= */
const getAcidenteById = async (req, res) => {
  try {
    const { id } = req.params;

    const acidente = await prisma.acidenteTrabalho.findUnique({
      where: { idAcidente: Number(id) },
      include: {
        colaborador: true,
        evidencias: true,
      },
    });

    if (!acidente) {
      return notFoundResponse(res, "Acidente não encontrado");
    }

    return successResponse(res, acidente);
  } catch (err) {
    return errorResponse(res, "Erro ao buscar acidente", 500);
  }
};

/* ================= GET ACIDENTES POR COLABORADOR ================= */
const getAcidentesByColaborador = async (req, res) => {
  try {
    const { id } = req.params; // pode ser OPS ID ou CPF

    if (!id) {
      return successResponse(res, []); // não quebra o perfil
    }

    const idStr = String(id);
    const cpfLimpo = idStr.replace(/\D/g, "");

    let colaborador = null;

    // 🔹 Se for CPF válido
    if (cpfLimpo.length === 11) {
      colaborador = await prisma.colaborador.findFirst({
        where: { cpf: cpfLimpo },
      });
    } 
    // 🔹 Senão, tenta OPS ID
    else {
      colaborador = await prisma.colaborador.findUnique({
        where: { opsId: idStr },
      });
    }

    // 🔹 Se não achou colaborador → retorna array vazio
    if (!colaborador) {
      return successResponse(res, []);
    }

    const acidentes = await prisma.acidenteTrabalho.findMany({
      where: {
        opsIdColaborador: colaborador.opsId,
      },
      orderBy: {
        dataOcorrencia: "desc",
      },
      include: {
        evidencias: true,
      },
    });

    return successResponse(res, acidentes);
  } catch (error) {
    console.error("❌ GET ACIDENTES POR COLABORADOR:", error);
    return successResponse(res, []); // 🔑 NUNCA quebrar perfil
  }
};



module.exports = {
  presignUpload,
  presignDownload,
  createAcidente,
  getAllAcidentes,
  getAcidenteById,
  getAcidentesByColaborador,
};