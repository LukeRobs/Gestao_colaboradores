const { sendReportEmail } = require("../reports/email")
const { sendImageToGroup } = require("../services/seatalk.service")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

// Estação efetiva da requisição: respeita a troca pra estação "irmã" feita no
// seletor da tela (req.dbContext, calculado pelo middleware injectDbContext) —
// nunca usar req.user.idEstacao direto, que é sempre a estação-mãe do usuário
// e ignoraria a troca.
function getEstacaoEfetivaId(req) {
  return req.dbContext?.estacaoId ?? req.user?.idEstacao ?? null;
}

async function getEstacaoGroupId(req, reportType) {
  const estacaoId = getEstacaoEfetivaId(req);
  if (!estacaoId) return null;

  const coluna = reportType === "gestaoOperacional" ? "seatalk_group_id_packing" : "seatalk_group_id";

  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${coluna} AS group_id FROM estacao WHERE id_estacao = $1`,
    estacaoId
  );
  return rows[0]?.group_id ?? null;
}

async function getEstacaoEmails(req) {
  const estacaoId = getEstacaoEfetivaId(req);
  if (!estacaoId) return [];

  const rows = await prisma.$queryRaw`
    SELECT email_rh FROM estacao WHERE id_estacao = ${estacaoId}
  `;
  const emails = rows[0]?.email_rh ?? [];
  return Array.isArray(emails) ? emails.filter(Boolean) : [];
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

    const destinatarios = await getEstacaoEmails(req);

    if (!destinatarios.length) {
      return res.status(422).json({
        success: false,
        code: "NO_EMAILS_CONFIGURED",
        message: "Nenhum e-mail configurado para esta estação. Adicione destinatários em Configurações → Estações.",
      });
    }

    await sendReportEmail({
      to: destinatarios,
      image,
      assunto,
      periodo,
      turno,
      user: req.user,
    })

    return res.json({
      success: true,
      message: `Relatório enviado para ${destinatarios.length} destinatário(s)`,
    })
  } catch (err) {
    next(err)
  }
}

async function checkSeatalkConfig(req, res, next) {
  try {
    const reportType = req.query?.reportType;
    const groupId = await getEstacaoGroupId(req, reportType);

    console.log(
      `🔍 [SEATALK-CHECK] user=${req.user?.email} homeEstacao=${req.user?.idEstacao} ` +
      `dbContextEstacaoId=${req.dbContext?.estacaoId} reportType=${reportType || "(default)"} ` +
      `groupId=${groupId || "(não configurado)"}`
    );

    return res.json({
      success: true,
      configured: !!groupId,
      // Só pra debug — não expõe nada sensível, o id do grupo já é visível em Organização > Estações
      debug: {
        homeEstacaoId: req.user?.idEstacao ?? null,
        estacaoIdUsada: req.dbContext?.estacaoId ?? null,
        reportType: reportType || null,
        groupId: groupId || null,
      },
    });
  } catch (err) {
    next(err);
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

    if (!image.startsWith('data:image/')) {
      console.error("❌ [SEATALK] Formato de imagem inválido")
      return res.status(400).json({
        success: false,
        message: "Formato de imagem inválido. Esperado: data:image/...",
      })
    }

    const groupId = await getEstacaoGroupId(req, reportType);

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
