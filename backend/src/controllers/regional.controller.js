const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* =====================================================
   LISTAR REGIONAIS
===================================================== */
const listarRegionais = async (req, res) => {
  try {
    const regionais = await prisma.regional.findMany({
      orderBy: { nome: "asc" },
    });

    return res.json({ success: true, data: regionais });
  } catch (error) {
    console.error("❌ ERRO LISTAR REGIONAIS:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao listar regionais",
    });
  }
};

/* =====================================================
   CRIAR REGIONAL
===================================================== */
const criarRegional = async (req, res) => {
  try {
    const { nomeRegional } = req.body;

    if (!nomeRegional) {
      return res.status(400).json({
        success: false,
        message: "Nome da regional é obrigatório",
      });
    }

    const existente = await prisma.regional.findUnique({
      where: { nomeRegional },
    });

    if (existente) {
      return res.status(409).json({
        success: false,
        message: "Regional já cadastrada",
      });
    }

    const regional = await prisma.regional.create({
      data: { nomeRegional },
    });

    return res.json({ success: true, data: regional });
  } catch (error) {
    console.error("❌ ERRO CRIAR REGIONAL:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar regional",
    });
  }
};

/* =====================================================
   ATUALIZAR REGIONAL
===================================================== */
const atualizarRegional = async (req, res) => {
  try {
    const { idRegional } = req.params;
    const { nomeRegional, ativo } = req.body;

    const regional = await prisma.regional.update({
      where: { idRegional: Number(idRegional) },
      data: {
        ...(nomeRegional !== undefined && { nomeRegional }),
        ...(ativo !== undefined && { ativo }),
      },
    });

    return res.json({ success: true, data: regional });
  } catch (error) {
    console.error("❌ ERRO ATUALIZAR REGIONAL:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar regional",
    });
  }
};

module.exports = {
  listarRegionais,
  criarRegional,
  atualizarRegional,
};
