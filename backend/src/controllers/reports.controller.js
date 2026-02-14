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
    
    const { image, periodo, turno } = req.body

    if (!image) {
      console.error("❌ [SEATALK] Imagem não enviada")
      return res.status(400).json({
        success: false,
        message: "Imagem do relatório não enviada",
      })
    }

    const groupId = process.env.SEATALK_GROUP_ID || "iNCIam_zTSaCzvN8qLp0pg"

    //console.log("📤 [SEATALK] Enviando via API REST")
    //console.log("📍 [SEATALK] Group ID:", groupId)
    //console.log("📏 [SEATALK] Tamanho da imagem:", Math.round(image.length / 1024), "KB")
    //console.log("📅 [SEATALK] Período:", periodo)
    //console.log("🕐 [SEATALK] Turno:", turno)

    const result = await sendImageToGroup(image, groupId, { periodo, turno })

    console.log("✅ [SEATALK] Enviado com sucesso!")

    return res.json({
      success: true,
      message: "Relatório enviado para o Seatalk com sucesso",
      data: result.data,
    })
  } catch (err) {
    console.error("❌ [SEATALK] Erro:", err.message)
    next(err)
  }
}

module.exports = {
  sendReportByEmail,
  sendReportToSeatalk,
}
