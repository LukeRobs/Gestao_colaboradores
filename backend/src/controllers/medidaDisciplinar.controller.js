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

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getR2Client } = require("../services/r2");
const { sendMedidaDisciplinarEmail } = require("../reports/email");

const BUCKET = process.env.R2_BUCKET_NAME;

/* =====================================================
   DATAS — BRASIL
===================================================== */

function dateOnlyBrasil(dateStr) {

  if (!dateStr) return null;

  const [y, m, d] = dateStr.split("-").map(Number);

  return new Date(y, m - 1, d, 12, 0, 0);

}

/* =====================================================
   PRESIGN UPLOAD CARTA (PDF GERADO PELO FRONTEND)
===================================================== */

const presignUpload = async (req, res) => {

  try {

    const { id } = req.params;

    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) }
    });

    if (!medida) {
      return notFoundResponse(res, "Medida disciplinar não encontrada");
    }

    if (medida.status !== "PENDENTE_ASSINATURA") {
      return errorResponse(res, "Medida já finalizada", 400);
    }

    const key = `medidas-disciplinares/${id}/carta-advertencia.pdf`;

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
   PRESIGN DOWNLOAD DOCUMENTO ASSINADO
===================================================== */

const presignDownload = async (req, res) => {

  try {

    const { id } = req.params;

    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) },
    });

    if (!medida || !medida.documentoAssinadoUrl) {
      return notFoundResponse(res, "Documento não encontrado");
    }

    const r2 = getR2Client();

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: medida.documentoAssinadoUrl,
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
   CREATE MEDIDA DISCIPLINAR
===================================================== */

const createMedida = async (req, res) => {

  try {

    const {
      cpf,
      nivelViolacao,
      violacao,
      tipoMedida,
      diasSuspensao,
      motivo,
      dataOcorrencia,
      dataAplicacao,
      idMatriz
    } = req.body;

    if (!cpf || !nivelViolacao || !violacao || !tipoMedida || !motivo || !dataAplicacao) {
      return errorResponse(res, "Campos obrigatórios não informados", 400);
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf: cpfLimpo },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const dataOc = dateOnlyBrasil(dataOcorrencia);

    /* ======================================
       EVITAR DUPLICIDADE
    ====================================== */

    const jaExiste = await prisma.medidaDisciplinar.findFirst({
      where: {
        opsId: colaborador.opsId,
        violacao,
        status: { in: ["PENDENTE_ASSINATURA", "ASSINADO"] },
      },
    });

    if (jaExiste) {
      return errorResponse(
        res,
        `Já existe uma medida disciplinar ativa para esta violação (${jaExiste.origem === "MANUAL" ? "criada manualmente" : "gerada pelo sistema"} em ${new Date(jaExiste.dataOcorrencia).toLocaleDateString("pt-BR")})`,
        400
      );
    }

    /* ======================================
       VERIFICAR SUGESTÃO AUTOMÁTICA PENDENTE
       Se existir e não veio forcarCriacao,
       retorna 409 para o frontend confirmar.
    ====================================== */

    const { forcarCriacao } = req.body;

    if (!forcarCriacao) {

      const sugestaoConflito = await prisma.sugestaoMedidaDisciplinar.findFirst({
        where: {
          opsId: colaborador.opsId,
          violacao,
          status: "PENDENTE",
        },
        select: {
          idSugestao: true,
          violacao: true,
          dataReferencia: true,
          consequencia: true,
        },
      });

      if (sugestaoConflito) {
        return res.status(409).json({
          success: false,
          conflito: true,
          message: "Já existe uma sugestão automática pendente para esta violação.",
          sugestao: sugestaoConflito,
        });
      }

    }

    const medida = await prisma.medidaDisciplinar.create({

      data: {

        opsId: colaborador.opsId,

        nivelViolacao,

        violacao,

        tipoMedida,

        diasSuspensao,

        motivo,

        dataOcorrencia: dataOc,

        dataAplicacao: dateOnlyBrasil(dataAplicacao),

        origem: "MANUAL",

        status: "PENDENTE_ASSINATURA",

        idMatriz: idMatriz || null,

        registradoPor: req.user?.opsId || "SISTEMA",

      },

      include: {

        colaborador: {
          select: {
            nomeCompleto: true,
            matricula: true,
          },
        },

        matriz: true,

      },

    });

    /* ======================================
       REJEITAR SUGESTÕES AUTOMÁTICAS
       Se existe MD manual para o mesmo
       colaborador/violação/data, rejeita
       sugestões pendentes automaticamente.
    ====================================== */

    await prisma.sugestaoMedidaDisciplinar.updateMany({
      where: {
        opsId: colaborador.opsId,
        violacao,
        status: "PENDENTE",
      },
      data: {
        status: "REJEITADA",
        aprovadoPor: "SISTEMA",
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
   FINALIZAR MEDIDA (SALVAR PDF)
===================================================== */

const finalizarMedida = async (req, res) => {

  try {

    const { id } = req.params;
    const { documentoKey } = req.body;

    if (!documentoKey) {
      return errorResponse(res, "Documento assinado é obrigatório", 400);
    }

    const medidaAtual = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) }
    });

    if (!medidaAtual) {
      return notFoundResponse(res, "Medida disciplinar não encontrada");
    }

    if (medidaAtual.status !== "PENDENTE_ASSINATURA") {
      return errorResponse(res, "Medida já finalizada", 400);
    }

    const medida = await prisma.medidaDisciplinar.update({

      where: { idMedida: Number(id) },

      data: {

        documentoAssinadoUrl: documentoKey,

        status: "ASSINADO",

        dataAssinatura: new Date(),

        dataAtualizacao: new Date(),

      },

    });

    return successResponse(res, medida, "Medida disciplinar finalizada");

  } catch (err) {

    console.error("❌ FINALIZAR MD:", err);
    return errorResponse(res, "Erro ao finalizar medida", 500);

  }

};


/* =====================================================
   LISTAR MEDIDAS
===================================================== */

const getAllMedidas = async (req, res) => {

  try {

    const { cpf, opsId, data, nome, turno, lider } = req.query;

    const where = {};

    // Filtro de estação via colaborador
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      where.colaborador = { is: { idEstacao: req.dbContext.estacaoId } };
    }

    if (data) {
      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59`);
      where.dataAplicacao = { gte: inicio, lte: fim };
    }

    // Filtros que operam sobre o colaborador são mesclados para não sobrescrever uns aos outros
    const colaboradorFilter = where.colaborador?.is || {};

    if (nome) {
      colaboradorFilter.nomeCompleto = { contains: nome, mode: "insensitive" };
    }

    if (turno) {
      colaboradorFilter.turno = {
        is: { nomeTurno: { contains: turno, mode: "insensitive" } },
      };
    }

    if (lider) {
      colaboradorFilter.lider = {
        is: { nomeCompleto: { contains: lider, mode: "insensitive" } },
      };
    }

    if (Object.keys(colaboradorFilter).length > 0) {
      where.colaborador = { is: colaboradorFilter };
    }

    if (cpf) {

      const cpfLimpo = cpf.replace(/\D/g, "");

      const colab = await prisma.colaborador.findFirst({
        where: { cpf: cpfLimpo },
      });

      if (!colab) return successResponse(res, []);

      where.opsId = colab.opsId;

    } else if (opsId) {

      where.opsId = opsId;
      where.status = "ASSINADO"; // perfil: oculta pendentes

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
            turno: { select: { nomeTurno: true } },
            lider: { select: { nomeCompleto: true } },
          },
        },

        matriz: true,

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

      include: {
        colaborador: {
          include: {
            empresa: true,
            estacao: { select: { nomeEstacao: true, localizacao: true } },
          }
        },
        matriz: true
      },

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

/* =====================================================
   ENVIAR EVIDÊNCIA POR E-MAIL
===================================================== */

const enviarEmailEvidencia = async (req, res) => {

  try {

    const { id } = req.params;

    // 1. Buscar medida com colaborador e estação
    const medida = await prisma.medidaDisciplinar.findUnique({
      where: { idMedida: Number(id) },
      include: {
        colaborador: {
          select: {
            nomeCompleto: true,
            matricula: true,
            idEstacao: true,
          },
        },
      },
    });

    if (!medida) {
      return notFoundResponse(res, "Medida disciplinar não encontrada");
    }

    if (medida.status !== "ASSINADO") {
      return errorResponse(res, "Apenas medidas assinadas podem ter a evidência enviada por e-mail", 400);
    }

    if (!medida.documentoAssinadoUrl) {
      return errorResponse(res, "Documento assinado não encontrado", 400);
    }

    // 2. Verificar RH configurado na estação via raw SQL (Prisma client pode estar desatualizado)
    const idEstacao = medida.colaborador?.idEstacao;

    if (!idEstacao) {
      return errorResponse(res, "Colaborador sem estação vinculada", 400);
    }

    const rawEstacao = await prisma.$queryRaw`
      SELECT email_rh, nome_estacao FROM estacao WHERE id_estacao = ${idEstacao}
    `;
    const emailRhArray = rawEstacao[0]?.email_rh ?? [];

    if (!emailRhArray || emailRhArray.length === 0) {
      return res.status(422).json({
        success: false,
        semRh: true,
        message: "RH local não configurado. Por favor, entrar em contato com um administrador.",
      });
    }

    // 3. Baixar PDF do R2
    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: medida.documentoAssinadoUrl,
    });

    const s3Response = await r2.send(command);

    // Converter stream para buffer
    const chunks = [];
    for await (const chunk of s3Response.Body) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // 4. Enviar e-mail (falha silenciosa não bloqueia resposta)
    await sendMedidaDisciplinarEmail({
      emailRh: emailRhArray, // array — Nodemailer aceita array no campo `to`
      nomeColaborador: medida.colaborador.nomeCompleto,
      matricula: medida.colaborador.matricula,
      tipoMedida: medida.tipoMedida,
      violacao: medida.violacao,
      dataAplicacao: medida.dataAplicacao,
      idMedida: medida.idMedida,
      pdfBuffer,
    });

    return successResponse(res, { emailRh: emailRhArray }, "Evidência enviada por e-mail com sucesso");

  } catch (err) {

    console.error("❌ ENVIAR EMAIL MD:", err);
    return errorResponse(res, "Erro ao enviar evidência por e-mail", 500);

  }

};

module.exports = {
  presignUpload,
  presignDownload,
  createMedida,
  finalizarMedida,
  getAllMedidas,
  getMedidaById,
  enviarEmailEvidencia,
};