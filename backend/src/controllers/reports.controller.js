const { sendReportEmail } = require("../reports/email")
const { sendImageToGroup } = require("../services/seatalk.service")

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

async function sendReportToSeatalk(req, res, next) {
  try {
    console.log("📥 [SEATALK] Requisição recebida")
    console.log("📥 [SEATALK] User:", req.user?.email || "não autenticado")
    console.log("📥 [SEATALK] Body keys:", Object.keys(req.body))
    
    const { image, periodo, turno, reportType } = req.body

    if (!image) {
      console.error("❌ [SEATALK] Imagem não enviada")
      return res.status(400).json({
        success: false,
        message: "Imagem do relatório não enviada",
      })
    }

    // Validar formato da imagem
    if (!image.startsWith('data:image/')) {
      console.error("❌ [SEATALK] Formato de imagem inválido")
      return res.status(400).json({
        success: false,
        message: "Formato de imagem inválido. Esperado: data:image/...",
      })
    }

    // Determinar o grupo baseado no tipo de relatório
    let groupId;
    if (reportType === "gestaoOperacional") {
      groupId = process.env.SEATALK_GROUP_ID_GESTAO
      console.log("📊 [SEATALK] Tipo: Gestão Operacional")
    } else if (reportType === "operacional") {
      groupId = process.env.SEATALK_GROUP_ID
      console.log("📊 [SEATALK] Tipo: Relatório Operacional")
    } else {
      // Fallback para compatibilidade com versões antigas
      groupId = process.env.SEATALK_GROUP_ID_GESTAO || process.env.SEATALK_GROUP_ID
      console.log("📊 [SEATALK] Tipo: Não especificado (usando fallback)")
    }

    if (!groupId) {
      console.error("❌ [SEATALK] Group ID não configurado")
      console.error("❌ [SEATALK] Variáveis disponíveis:")
      console.error("   - SEATALK_GROUP_ID:", process.env.SEATALK_GROUP_ID ? "✅" : "❌")
      console.error("   - SEATALK_GROUP_ID_GESTAO:", process.env.SEATALK_GROUP_ID_GESTAO ? "✅" : "❌")
      return res.status(500).json({
        success: false,
        message: "Group ID não configurado no servidor. Configure SEATALK_GROUP_ID e SEATALK_GROUP_ID_GESTAO no .env",
      })
    }

    console.log("📤 [SEATALK] Enviando via API REST")
    console.log("📍 [SEATALK] Group ID:", groupId)
    console.log("📏 [SEATALK] Tamanho da imagem:", Math.round(image.length / 1024), "KB")
    console.log("📅 [SEATALK] Período:", periodo)
    console.log("🕐 [SEATALK] Turno:", turno)
    console.log("📊 [SEATALK] Tipo de relatório:", reportType || "não especificado")

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
    
    // Retornar erro mais descritivo
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
}
