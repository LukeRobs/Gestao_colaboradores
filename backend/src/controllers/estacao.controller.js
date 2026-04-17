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

    // Injeta emailRh via raw pois o Prisma client pode estar desatualizado
    const rawEmails = await prisma.$queryRaw`
      SELECT id_estacao, email_rh FROM estacao
    `;
    const emailMap = Object.fromEntries(rawEmails.map((r) => [r.id_estacao, r.email_rh ?? []]));
    for (const e of estacoes) {
      e.emailRh = emailMap[e.idEstacao] ?? [];
    }

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
   BUSCAR ESTAÇÃO POR ID
===================================================== */
const buscarEstacaoPorId = async (req, res) => {
  try {
    const { idEstacao } = req.params;

    const estacao = await prisma.estacao.findUnique({
      where: { idEstacao: Number(idEstacao) },
      include: { regional: true },
    });

    if (!estacao) {
      return res.status(404).json({ success: false, message: "Estação não encontrada" });
    }

    // Busca emailRh via raw pois o Prisma client pode estar desatualizado
    const raw = await prisma.$queryRaw`
      SELECT email_rh FROM estacao WHERE id_estacao = ${Number(idEstacao)}
    `;
    estacao.emailRh = raw[0]?.email_rh ?? [];

    return res.json({ success: true, data: estacao });
  } catch (error) {
    console.error("❌ ERRO BUSCAR ESTAÇÃO:", error);
    return res.status(500).json({ success: false, message: "Erro ao buscar estação" });
  }
};

/* =====================================================
   CRIAR ESTAÇÃO
===================================================== */
const criarEstacao = async (req, res) => {
  try {
    const { nomeEstacao, idRegional, localizacao, capacidade, sheetsMetaProducaoId, sheetsPresencaId, emailRh } = req.body;

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
        sheetsMetaProducaoId: sheetsMetaProducaoId || null,
        sheetsPresencaId: sheetsPresencaId || null,
        emailRh: Array.isArray(emailRh) ? emailRh : (emailRh ? [emailRh] : []),
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
    const { nomeEstacao, idRegional, localizacao, capacidade, ativo, sheetsMetaProducaoId, sheetsPresencaId, emailRh } = req.body;

    // Atualiza emailRh via raw SQL (Prisma client pode estar desatualizado para campo array)
    if (emailRh !== undefined) {
      const emails = Array.isArray(emailRh) ? emailRh : (emailRh ? [emailRh] : []);
      await prisma.$executeRaw`
        UPDATE estacao SET email_rh = ${emails}::text[] WHERE id_estacao = ${Number(idEstacao)}
      `;
    }

    // Atualiza demais campos via Prisma (apenas se enviados)
    const outrosCampos = { nomeEstacao, idRegional, localizacao, capacidade, ativo, sheetsMetaProducaoId, sheetsPresencaId };
    const temOutrosCampos = Object.values(outrosCampos).some((v) => v !== undefined);

    if (temOutrosCampos) {
      await prisma.estacao.update({
        where: { idEstacao: Number(idEstacao) },
        data: {
          ...(nomeEstacao && { nomeEstacao }),
          ...(idRegional !== undefined && { idRegional: Number(idRegional) }),
          ...(localizacao !== undefined && { localizacao }),
          ...(capacidade !== undefined && { capacidade: capacidade !== null ? Number(capacidade) : null }),
          ...(ativo !== undefined && { ativo: Boolean(ativo) }),
          ...(sheetsMetaProducaoId !== undefined && { sheetsMetaProducaoId: sheetsMetaProducaoId || null }),
          ...(sheetsPresencaId !== undefined && { sheetsPresencaId: sheetsPresencaId || null }),
        },
      });
    }

    const estacao = await prisma.estacao.findUnique({ where: { idEstacao: Number(idEstacao) } });

    // Injeta emailRh via raw pois o Prisma client pode não conhecer o campo
    const raw = await prisma.$queryRaw`SELECT email_rh FROM estacao WHERE id_estacao = ${Number(idEstacao)}`;
    estacao.emailRh = raw[0]?.email_rh ?? [];

    return res.json({ success: true, data: estacao });
  } catch (error) {
    console.error("❌ ERRO ATUALIZAR ESTAÇÃO:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar estação",
    });
  }
};

/* =====================================================
   EXCLUIR ESTAÇÃO
===================================================== */
const excluirEstacao = async (req, res) => {
  try {
    const { idEstacao } = req.params;

    const total = await prisma.colaborador.count({ where: { idEstacao: Number(idEstacao) } });
    if (total > 0) {
      return res.status(409).json({
        success: false,
        message: `Não é possível excluir esta estação pois ela possui ${total} colaborador(es) vinculado(s).`,
      });
    }

    await prisma.estacao.delete({ where: { idEstacao: Number(idEstacao) } });
    return res.json({ success: true, message: "Estação excluída com sucesso" });
  } catch (error) {
    console.error("❌ ERRO EXCLUIR ESTAÇÃO:", error);
    return res.status(500).json({ success: false, message: "Erro ao excluir estação" });
  }
};

module.exports = {
  listarEstacoes,
  buscarEstacaoPorId,
  criarEstacao,
  atualizarEstacao,
  excluirEstacao,
};
