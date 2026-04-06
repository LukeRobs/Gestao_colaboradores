const {
  gerarFolgaDominical,
  listarFolgaDominical,
  deletarFolgaDominical,
  previewFolgaDominical,
} = require("../services/folgaDominical.service");

/* =====================================================
   HELPER VALIDAÇÃO
===================================================== */
function validarAnoMes(ano, mes) {
  const anoNum = Number(ano);
  const mesNum = Number(mes);

  if (
    Number.isNaN(anoNum) ||
    Number.isNaN(mesNum) ||
    mesNum < 1 ||
    mesNum > 12
  ) {
    return null;
  }

  return { anoNum, mesNum };
}

/* =====================================================
   POST /folga-dominical
===================================================== */
async function gerar(req, res) {
  try {
    const { ano, mes } = req.body;

    if (!ano || !mes) {
      return res.status(400).json({
        success: false,
        error: "Ano e mês são obrigatórios.",
      });
    }

    const parsed = validarAnoMes(ano, mes);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Ano ou mês inválidos.",
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado.",
      });
    }

    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? req.dbContext.estacaoId
      : null;

    const resultado = await gerarFolgaDominical({
      ano: parsed.anoNum,
      mes: parsed.mesNum,
      userId,
      estacaoId,
    });

    return res.status(200).json({
      success: true,
      message: "Folga dominical gerada com sucesso.",
      data: resultado,
    });

  } catch (error) {
    console.error("❌ Erro ao gerar folga dominical:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?.id,
    });

    const message = error.message || "";

    if (
      message.includes("mínimo por turno") ||
      message.includes("Não foi possível gerar")
    ) {
      return res.status(409).json({
        success: false,
        type: "CAPACIDADE_INSUFICIENTE",
        error: message,
      });
    }

    if (message.includes("Já existe planejamento")) {
      return res.status(409).json({
        success: false,
        type: "PLANEJAMENTO_EXISTENTE",
        error: message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno ao gerar folga dominical.",
    });
  }
}

/* =====================================================
   GET /folga-dominical
===================================================== */
async function listar(req, res) {
  try {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
      return res.status(400).json({
        success: false,
        error: "Ano e mês são obrigatórios.",
      });
    }

    const parsed = validarAnoMes(ano, mes);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Ano ou mês inválidos.",
      });
    }

    const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) ? req.dbContext.estacaoId : null;

    const resultado = await listarFolgaDominical({
      ano: parsed.anoNum,
      mes: parsed.mesNum,
      estacaoId,
    });

    if (!resultado) {
      return res.status(404).json({
        success: false,
        error: "Nenhum planejamento encontrado para este mês.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Planejamento carregado com sucesso.",
      data: resultado,
    });

  } catch (error) {
    console.error("❌ Erro ao listar folga dominical:", {
      message: error.message,
      stack: error.stack,
      query: req.query,
    });

    return res.status(500).json({
      success: false,
      error: "Erro interno ao listar planejamento.",
    });
  }
}

/* =====================================================
   DELETE /folga-dominical
===================================================== */
async function deletar(req, res) {
  try {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
      return res.status(400).json({
        success: false,
        error: "Ano e mês são obrigatórios.",
      });
    }

    const parsed = validarAnoMes(ano, mes);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Ano ou mês inválidos.",
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado.",
      });
    }

    const resultado = await deletarFolgaDominical({
      ano: parsed.anoNum,
      mes: parsed.mesNum,
      estacaoId: (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
        ? req.dbContext.estacaoId
        : null,
    });

    return res.status(200).json({
      success: true,
      message: "Planejamento removido com sucesso.",
      data: resultado,
    });

  } catch (error) {
    console.error("❌ Erro ao deletar folga dominical:", {
      message: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?.id,
    });

    const message = error?.message || "";

    if (message.includes("Nenhum planejamento")) {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno ao deletar planejamento.",
    });
  }
}

/* =====================================================
   POST /folga-dominical/preview
===================================================== */
async function preview(req, res) {
  try {
    const { ano, mes } = req.body;

    if (!ano || !mes) {
      return res.status(400).json({
        success: false,
        error: "Ano e mês são obrigatórios.",
      });
    }

    const parsed = validarAnoMes(ano, mes);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Ano ou mês inválidos.",
      });
    }

    const resultado = await previewFolgaDominical({
      ano: parsed.anoNum,
      mes: parsed.mesNum,
      estacaoId: (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
        ? req.dbContext.estacaoId
        : null,
    });

    return res.status(200).json({
      success: true,
      message: "Preview gerado com sucesso.",
      data: resultado,
    });

  } catch (error) {
    console.error("❌ Erro no preview folga dominical:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    const message = error.message || "";

    if (
      message.includes("mínimo por turno") ||
      message.includes("Não foi possível")
    ) {
      return res.status(409).json({
        success: false,
        type: "CAPACIDADE_INSUFICIENTE",
        error: message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno ao gerar preview.",
    });
  }
}

module.exports = {
  gerar,
  listar,
  deletar,
  preview,
};