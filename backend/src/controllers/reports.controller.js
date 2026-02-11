const { sendReportEmail } = require("../reports/email")

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
      user: req.user, // opcional (auth)
    })

    return res.json({
      success: true,
      message: "Relatório enviado com sucesso",
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  sendReportByEmail,
}
