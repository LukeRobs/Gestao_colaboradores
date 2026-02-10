const nodemailer = require("nodemailer")

async function sendReportEmail({
  image,
  assunto,
  periodo,
  turno,
  user,
}) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color:#FA4C00;">Relatório Operacional</h2>

      <p><strong>Período:</strong> ${periodo}</p>
      <p><strong>Turno:</strong> ${turno}</p>

      <hr style="margin:16px 0;border:1px solid #eee;" />

      <img
        src="cid:reportImage"
        style="max-width:100%;border-radius:8px;"
      />
    </div>
  `

  await transporter.sendMail({
    from: `"Relatórios Operacionais" <${process.env.GMAIL_USER}>`,
    to: [
      "thiago.feitoza@shopee.com",
      "thaian.braga@shopee.com",
      "alysson.nascimento@shopee.com",
      "kleverson.pereira@shopee.com",
      "sheyla.karyne@shopee.com",
      "gabriel.apereira@shopee.com",
      "marcio.oliveira@shopee.com",
      "diego.alves@shopee.com",
      "lucicleide.inacio@shopee.com",
      "felipe.cavalcanti@shopee.com",
      "camilla.msilva@shopee.com",
      "joao.maciel@shopee.com",
      "luiz.semiano@shopee.com",
      "nieli.souza@shopee.com",
    ],
    subject: `${assunto} • ${periodo} • Turno ${turno}`,
    html,
    attachments: [
      {
        filename: "relatorio-operacional.png",
        content: image.replace(/^data:image\/png;base64,/, ""),
        encoding: "base64",
        cid: "reportImage",
      },
    ],
  })
}

module.exports = {
  sendReportEmail,
}
