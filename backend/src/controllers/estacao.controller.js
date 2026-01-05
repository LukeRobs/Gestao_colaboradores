const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* =====================================================
   LISTAR ESTAÇÕES
===================================================== */
const listarEstacoes = async (req, res) => {
  try {
    const estacoes = await prisma.estacao.findMany({
      include: {
        regional: true,
      },
      orderBy: { nomeEstacao: "asc" },
    });

    return res.json({ success: true, data: estacoes });
  } catch (error) {
    console.error("❌ ERRO LISTAR ESTAÇÕES:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao listar estações",
    });
  }
};

/* =====================================================
   CRIAR ESTAÇÃO
===================================================== */
const criarEstacao = async (req, res) => {
  try {
    const { nomeEstacao, idRegional, localizacao, capacidade } = req.body;

    if (!nomeEstacao) {
      return res.status(400).json({
        success: false,
        message: "Nome da estação é obrigatório",
      });
    }

    const existente = await prisma.estacao.findUnique({
      where: { nomeEstacao },
    });

    if (existente) {
      return res.status(409).json({
        success: false,
        message: "Estação já cadastrada",
      });
    }

    const estacao = await prisma.estacao.create({
      data: {
        nomeEstacao,
        idRegional,
        localizacao,
        capacidade,
      },
    });

    return res.json({ success: true, data: estacao });
  } catch (error) {
    console.error("❌ ERRO CRIAR ESTAÇÃO:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar estação",
    });
  }
};

/* =====================================================
   ATUALIZAR ESTAÇÃO
===================================================== */
const atualizarEstacao = async (req, res) => {
  try {
    const { idEstacao } = req.params;
    const { nomeEstacao, idRegional, localizacao, capacidade, ativo } = req.body;

    const estacao = await prisma.estacao.update({
      where: {
        idEstacao: Number(idEstacao),
      },
      data: {
        ...(nomeEstacao && { nomeEstacao }),
        ...(idRegional !== undefined && {
          idRegional: Number(idRegional),
        }),
        ...(localizacao !== undefined && { localizacao }),
        ...(capacidade !== undefined && {
          capacidade: capacidade !== null ? Number(capacidade) : null,
        }),
        ...(ativo !== undefined && { ativo: Boolean(ativo) }),
      },
    });


    return res.json({ success: true, data: estacao });
  } catch (error) {
    console.error("❌ ERRO ATUALIZAR ESTAÇÃO:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar estação",
    });
  }
};

module.exports = {
  listarEstacoes,
  criarEstacao,
  atualizarEstacao,
};
