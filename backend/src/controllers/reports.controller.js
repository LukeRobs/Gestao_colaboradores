const { sendReportEmail } = require("../reports/email")
const { sendImageToGroup } = require("../services/seatalk.service")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function getEstacaoGroupId(req) {
  const estacaoId = req.user?.idEstacao || (req.query?.estacaoId ? Number(req.query.estacaoId) : null);
  if (!estacaoId) return null;

  const rows = await prisma.$queryRaw`
    SELECT seatalk_group_id FROM estacao WHERE id_estacao = ${estacaoId}
  `;
  return rows[0]?.seatalk_group_id ?? null;
}

async function sendReportByEmail(req, res, next) {
  try {
    const { image, assunto, periodo, turno } = req.body

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Imagem do relatório não enviada",
      })
    }

    await sendReportEmail({
      image,
      assunto,
      periodo,
      turno,
      user: req.user,
    })

    return res.json({
      success: true,
      message: "Relatório enviado com sucesso",
    })
  } catch (err) {
    next(err)
  }
}

async function checkSeatalkConfig(req, res, next) {
  try {
    const groupId = await getEstacaoGroupId(req);
    return res.json({ success: true, configured: !!groupId });
  } catch (err) {
    next(err);
  }
}

async function sendReportToSeatalk(req, res, next) {
  try {
    console.log("📥 [SEATALK] Requisição recebida")
    console.log("📥 [SEATALK] User:", req.user?.email || "não autenticado")
    console.log("📥 [SEATALK] Body keys:", Object.keys(req.body))

    const { image, periodo, turno } = req.body

    if (!image) {
      console.error("❌ [SEATALK] Imagem não enviada")
      return res.status(400).json({
        success: false,
        message: "Imagem do relatório não enviada",
      })
    }

    if (!image.startsWith('data:image/')) {
      console.error("❌ [SEATALK] Formato de imagem inválido")
      return res.status(400).json({
        success: false,
        message: "Formato de imagem inválido. Esperado: data:image/...",
      })
    }

    const groupId = await getEstacaoGroupId(req);

    if (!groupId) {
      console.error("❌ [SEATALK] Group ID não configurado para esta estação")
      return res.status(422).json({
        success: false,
        code: "GROUP_NOT_CONFIGURED",
        message: "Grupo Seatalk não configurado para esta estação.",
      })
    }

    console.log("📤 [SEATALK] Enviando via API REST")
    console.log("📍 [SEATALK] Group ID:", groupId)
    console.log("📏 [SEATALK] Tamanho da imagem:", Math.round(image.length / 1024), "KB")
    console.log("📅 [SEATALK] Período:", periodo)
    console.log("🕐 [SEATALK] Turno:", turno)

    const result = await sendImageToGroup(image, groupId, { periodo, turno })

    console.log("✅ [SEATALK] Enviado com sucesso!")

    return res.json({
      success: true,
      message: "Relatório enviado para o Seatalk com sucesso",
      data: result.data,
    })
  } catch (err) {
    console.error("❌ [SEATALK] Erro capturado no controller:", err.message)
    console.error("❌ [SEATALK] Stack:", err.stack)

    return res.status(500).json({
      success: false,
      message: err.message || "Erro ao enviar relatório para o Seatalk",
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
  }
}

module.exports = {
  sendReportByEmail,
  sendReportToSeatalk,
  checkSeatalkConfig,
}
