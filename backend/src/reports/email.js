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

/* =====================================================
   ENVIO DE EVIDÊNCIA — MEDIDA DISCIPLINAR
===================================================== */

async function sendMedidaDisciplinarEmail({
  emailRh,
  nomeColaborador,
  matricula,
  tipoMedida,
  violacao,
  dataAplicacao,
  idMedida,
  pdfBuffer,
}) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  const dataFormatada = new Date(dataAplicacao).toLocaleDateString("pt-BR")

  const tipoLabel = {
    ADVERTENCIA: "Advertência",
    SUSPENSAO: "Suspensão",
    DEMISSAO: "Demissão por Justa Causa",
  }[tipoMedida] || tipoMedida

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color:#FA4C00;">Evidência de Medida Disciplinar</h2>
      <p>Segue em anexo a evidência da medida disciplinar aplicada e assinada.</p>
      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr style="background:#f5f5f5;">
          <td style="padding:8px 12px; font-weight:bold; width:40%;">Colaborador</td>
          <td style="padding:8px 12px;">${nomeColaborador}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; font-weight:bold;">Matrícula</td>
          <td style="padding:8px 12px;">${matricula || "—"}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px 12px; font-weight:bold;">Tipo de Medida</td>
          <td style="padding:8px 12px;">${tipoLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; font-weight:bold;">Violação</td>
          <td style="padding:8px 12px;">${violacao}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px 12px; font-weight:bold;">Data de Aplicação</td>
          <td style="padding:8px 12px;">${dataFormatada}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; font-weight:bold;">Nº da Medida</td>
          <td style="padding:8px 12px;">#${idMedida}</td>
        </tr>
      </table>
      <p style="color:#888; font-size:12px;">
        Este e-mail foi gerado automaticamente pelo sistema de Gestão de Colaboradores.
      </p>
    </div>
  `

  await transporter.sendMail({
    from: `"Gestão de Colaboradores" <${process.env.GMAIL_USER}>`,
    to: emailRh,
    subject: `[MD #${idMedida}] Evidência — ${tipoLabel} — ${nomeColaborador}`,
    html,
    attachments: [
      {
        filename: `medida-disciplinar-${idMedida}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  })
}

module.exports = {
  sendReportEmail,
  sendMedidaDisciplinarEmail,
}
