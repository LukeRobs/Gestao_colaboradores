const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const listarRegionais = async (req, res) => {
  try {
    const regionais = await prisma.regional.findMany({
      orderBy: { nome: "asc" },
      include: {
        estacoes: {
          select: { idEstacao: true, nomeEstacao: true },
          orderBy: { nomeEstacao: "asc" },
        },
      },
    });
    return res.json({ success: true, data: regionais });
  } catch (error) {
    console.error("❌ ERRO LISTAR REGIONAIS:", error);
    return res.status(500).json({ success: false, message: "Erro ao listar regionais" });
  }
};

const criarRegional = async (req, res) => {
  try {
    const { nome, nomeRegional } = req.body;
    const nomeValue = nome || nomeRegional;

    if (!nomeValue) {
      return res.status(400).json({ success: false, message: "Nome da regional é obrigatório" });
    }

    const existente = await prisma.regional.findUnique({ where: { nome: nomeValue } });
    if (existente) {
      return res.status(409).json({ success: false, message: "Regional já cadastrada" });
    }

    const regional = await prisma.regional.create({ data: { nome: nomeValue } });
    return res.json({ success: true, data: regional });
  } catch (error) {
    console.error("❌ ERRO CRIAR REGIONAL:", error);
    return res.status(500).json({ success: false, message: "Erro ao criar regional" });
  }
};

const atualizarRegional = async (req, res) => {
  try {
    const { idRegional } = req.params;
    const { nome, nomeRegional, ativo } = req.body;
    const nomeValue = nome || nomeRegional;

    const regional = await prisma.regional.update({
      where: { idRegional: Number(idRegional) },
      data: {
        ...(nomeValue !== undefined && { nome: nomeValue }),
        ...(ativo !== undefined && { ativo }),
      },
    });
    return res.json({ success: true, data: regional });
  } catch (error) {
    console.error("❌ ERRO ATUALIZAR REGIONAL:", error);
    return res.status(500).json({ success: false, message: "Erro ao atualizar regional" });
  }
};

const excluirRegional = async (req, res) => {
  try {
    const { idRegional } = req.params;

    const total = await prisma.estacao.count({ where: { idRegional: Number(idRegional) } });
    if (total > 0) {
      return res.status(409).json({
        success: false,
        message: `Não é possível excluir esta regional pois ela possui ${total} estação(ões) vinculada(s).`,
      });
    }

    await prisma.regional.delete({ where: { idRegional: Number(idRegional) } });
    return res.json({ success: true, message: "Regional excluída com sucesso" });
  } catch (error) {
    console.error("❌ ERRO EXCLUIR REGIONAL:", error);
    return res.status(500).json({ success: false, message: "Erro ao excluir regional" });
  }
};

module.exports = { listarRegionais, criarRegional, atualizarRegional, excluirRegional };
