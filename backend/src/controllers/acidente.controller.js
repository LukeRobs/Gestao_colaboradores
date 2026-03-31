/**
 * Controller de Acidentes de Trabalho - VERSÃO MELHORADA
 * Retorna URLs presignadas automaticamente nas listagens
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
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Hora somente (sem risco de timezone)
function normalizeTimeOnly(timeStr) {
  if (!timeStr) return null;
  return new Date(`1970-01-01T${timeStr}:00`);
}

/* ================= GERAR URL PRESIGNADA ================= */
async function gerarUrlPresignada(key) {
  try {
    if (!key) return null;
    
    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 hora
    return url;
  } catch (error) {
    console.error(`❌ Erro ao gerar URL presignada para ${key}:`, error);
    return null;
  }
}

/* ================= ENRIQUECER EVIDÊNCIAS COM URLs ================= */
async function enriquecerEvidencias(evidencias) {
  if (!Array.isArray(evidencias) || evidencias.length === 0) {
    return [];
  }

  const evidenciasComUrl = await Promise.all(
    evidencias.map(async (evidencia) => {
      const urlImagem = await gerarUrlPresignada(evidencia.arquivoUrl);
      return {
        ...evidencia,
        urlImagem, // Adiciona URL presignada
      };
    })
  );

  return evidenciasComUrl;
}

/* ================= PRESIGN UPLOAD ================= */
const presignUpload = async (req, res) => {
  try {
    const { cpf, files } = req.body;

    /* ================= VALIDAÇÕES INICIAIS ================= */
    if (!cpf) {
      return errorResponse(res, "CPF não informado", 400);
    }
    if (!Array.isArray(files) || files.length === 0) {
      return errorResponse(res, "Nenhum arquivo informado", 400);
    }
    if (files.length > 5) {
      return errorResponse(res, "Máximo de 5 imagens permitido", 400);
    }
    if (!process.env.R2_WORKER_UPLOAD_URL) {
      return errorResponse(
        res,
        "R2_WORKER_UPLOAD_URL não configurado",
        500
      );
    }

    /* ================= CPF ================= */
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

    const opsId = colaborador.opsId;

    /* ================= VALIDAÇÃO DE ARQUIVOS ================= */
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf",
    ];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    const uploads = files.map(({ filename, contentType, size }) => {
      if (!filename || !contentType) {
        throw new Error("Arquivo inválido");
      }
      if (!allowedTypes.includes(contentType)) {
        throw new Error(
          `Formato não permitido (${filename}). Apenas JPG, PNG ou WEBP`
        );
      }
      if (size && Number(size) > MAX_SIZE) {
        throw new Error(
          `Arquivo ${filename} excede o limite de 5MB`
        );
      }

      // 🔒 Sanitiza nome do arquivo
      const safeName = filename
        .replace(/\s+/g, "-")
        .replace(/[^\w.\-]/g, "")
        .toLowerCase();
      const id = crypto.randomUUID();
      const key = `acidentes/${opsId}/${id}-${safeName}`;

      return {
        key,
        uploadUrl: `${process.env.R2_WORKER_UPLOAD_URL}/${key}`,
      };
    });

    return successResponse(res, uploads);
  } catch (err) {
    console.error("❌ PRESIGN UPLOAD ACIDENTE:", err);
    return errorResponse(
      res,
      err.message || "Erro ao gerar URL de upload",
      500
    );
  }
};

/* ================= PRESIGN DOWNLOAD ================= */
const presignDownload = async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return errorResponse(res, "Chave não informada", 400);

    const url = await gerarUrlPresignada(key);
    
    if (!url) {
      return errorResponse(res, "Erro ao gerar URL de download", 500);
    }

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
      return errorResponse(res, "CPF inválido", 400);
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    if (!dataComunicacaoHSE) {
      return errorResponse(res, "Data de comunicação HSE é obrigatória", 400);
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
        dataComunicacaoHSE: normalizeDateOnly(dataComunicacaoHSE),
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
      include: {
        evidencias: true,
      },
    });

    // 🔥 ENRIQUECER COM URLs PRESIGNADAS
    const evidenciasComUrl = await enriquecerEvidencias(acidente.evidencias);

    return createdResponse(
      res,
      { ...acidente, evidencias: evidenciasComUrl },
      "Acidente registrado com sucesso"
    );
  } catch (err) {
    console.error("❌ CREATE ACIDENTE:", err);
    return errorResponse(res, err?.message || "Erro ao registrar acidente", 500);
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
        return errorResponse(res, "CPF inválido", 400);
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
        colaborador: true,
        evidencias: true,
      },
    });

    // 🔥 ENRIQUECER TODOS COM URLs PRESIGNADAS
    const acidentesEnriquecidos = await Promise.all(
      acidentes.map(async (acidente) => {
        const evidenciasComUrl = await enriquecerEvidencias(acidente.evidencias);
        return {
          ...acidente,
          evidencias: evidenciasComUrl,
        };
      })
    );

    return successResponse(res, acidentesEnriquecidos);
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

    // 🔥 ENRIQUECER COM URLs PRESIGNADAS
    const evidenciasComUrl = await enriquecerEvidencias(acidente.evidencias);

    return successResponse(res, {
      ...acidente,
      evidencias: evidenciasComUrl,
    });
  } catch (err) {
    console.error("❌ GET ACIDENTE BY ID:", err);
    return errorResponse(res, "Erro ao buscar acidente", 500);
  }
};

/* ================= GET ACIDENTES POR COLABORADOR ================= */
const getAcidentesByColaborador = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return successResponse(res, []);
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
        colaborador: true,
        evidencias: true,
      },
    });

    // 🔥 ENRIQUECER TODOS COM URLs PRESIGNADAS
    const acidentesEnriquecidos = await Promise.all(
      acidentes.map(async (acidente) => {
        const evidenciasComUrl = await enriquecerEvidencias(acidente.evidencias);
        return {
          ...acidente,
          evidencias: evidenciasComUrl,
        };
      })
    );

    return successResponse(res, acidentesEnriquecidos);
  } catch (error) {
    console.error("❌ GET ACIDENTES POR COLABORADOR:", error);
    return successResponse(res, []);
  }
};

/* ================= CANCELAR ACIDENTE ================= */
const cancelarAcidente = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: "Motivo do cancelamento é obrigatório" });
    }

    const acidente = await prisma.acidenteTrabalho.findUnique({
      where: { idAcidente: Number(id) },
    });

    if (!acidente) {
      return res.status(404).json({ success: false, message: "Acidente não encontrado" });
    }

    if (acidente.status === "CANCELADO") {
      return res.status(400).json({ success: false, message: "Acidente já está cancelado" });
    }

    const updated = await prisma.acidenteTrabalho.update({
      where: { idAcidente: Number(id) },
      data: {
        status: "CANCELADO",
        motivoCancelamento: motivo.trim(),
        canceladoEm: new Date(),
        canceladoPor: req.user?.id || null,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ CANCELAR ACIDENTE:", err);
    return res.status(500).json({ success: false, message: "Erro ao cancelar acidente" });
  }
};

module.exports = {
  presignUpload,
  presignDownload,
  createAcidente,
  getAllAcidentes,
  getAcidenteById,
  getAcidentesByColaborador,
  cancelarAcidente,
};