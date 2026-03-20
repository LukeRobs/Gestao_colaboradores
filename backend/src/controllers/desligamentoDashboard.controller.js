const { getDesligamentosDashboard } = require("../services/desligamentoDashboard.service");
const { buildDesligamentoDashboard } = require("../utils/buildDesligamentoDashboard");

const dashboardDesligamento = async (req, res) => {
  try {
    let {
      inicio,
      fim,
      empresa,
      turno,
      setor,
      lider,
    } = req.query;

    /* =====================================================
       VALIDAÇÃO DE DATAS
    ===================================================== */
    if (!inicio || !fim) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'inicio' e 'fim' são obrigatórios",
      });
    }

    /* =====================================================
       NORMALIZAÇÃO DOS FILTROS
    ===================================================== */
    const filtros = {
      inicio,
      fim,
      empresa: empresa || undefined,
      setor: setor || undefined,
      lider: lider || undefined,
      turno:
        !turno || turno === "ALL" ? undefined : turno,
    };

    /* =====================================================
       FETCH DATA
    ===================================================== */
    const data = await getDesligamentosDashboard(filtros);

    /* =====================================================
       BUILD DASHBOARD
    ===================================================== */
    const resumo = buildDesligamentoDashboard(data);

    /* =====================================================
       RESPONSE
    ===================================================== */
    return res.json({
      success: true,
      periodo: {
        inicio,
        fim,
      },
      filtros: {
        ...filtros,
        turno: turno || "ALL",
      },
      data: resumo,
    });

  } catch (error) {
    console.error("❌ Erro dashboard desligamento:", error);

    return res.status(500).json({
      success: false,
      error: "Erro ao carregar dashboard de desligamento",
    });
  }
};

module.exports = {
  dashboardDesligamento,
};