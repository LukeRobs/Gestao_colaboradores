const { prisma } = require("../config/database");
const crypto = require("crypto");

/* =====================================================
   CRIAR TREINAMENTO
===================================================== */
exports.createTreinamento = async (req, res) => {
  try {

    const {
      dataTreinamento,
      processo,
      tema,
      soc,
      liderResponsavelOpsId,
      setores = [],
      participantes = [],
    } = req.body;

    if (!dataTreinamento || !processo || !tema || !soc) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatórios não informados",
      });
    }

    const instrutorOpsId = liderResponsavelOpsId || req.user?.opsId;

    if (!instrutorOpsId) {
      return res.status(400).json({
        success: false,
        message: "Instrutor deve ser informado",
      });
    }

    const treinamento = await prisma.treinamento.create({

      data: {

        dataTreinamento: new Date(dataTreinamento),

        processo,
        tema,
        soc,

        liderResponsavel: {
          connect: { opsId: instrutorOpsId },
        },

        criadoPor: req.user.id,

        setores: {
          create: (setores || []).map((idSetor) => ({
            idSetor: Number(idSetor),
          })),
        },

        participantes: {
          create: (participantes || []).map((p) => ({
            opsId: p.opsId,
            cpf: p.cpf || null,
            adicionadoPor: req.user.id,
          })),
        },

      },

      include: {

        liderResponsavel: {
          select: { nomeCompleto: true },
        },

        setores: {
          include: { setor: true },
        },

        participantes: {
          include: {
            colaborador: {
              select: { nomeCompleto: true, cpf: true },
            },
          },
        },

      },

    });

    return res.status(201).json({
      success: true,
      data: treinamento,
    });

  } catch (err) {

    console.error("❌ createTreinamento:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao criar treinamento",
    });

  }
};


/* =====================================================
   LISTAR TREINAMENTOS
===================================================== */
exports.listTreinamentos = async (req, res) => {
  try {

    const treinamentos = await prisma.treinamento.findMany({

      orderBy: { dataTreinamento: "desc" },

      include: {

        liderResponsavel: {
          select: { nomeCompleto: true },
        },

        participantes: {
          include: {
            colaborador: {
              select: { nomeCompleto: true, cpf: true },
            },
          },
        },

        setores: {
          include: { setor: true },
        },

      },

    });

    return res.json({
      success: true,
      data: treinamentos,
    });

  } catch (err) {

    console.error("❌ listTreinamentos:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao listar treinamentos",
    });

  }
};


/* =====================================================
   PRESIGN UPLOAD ATA (PDF)
===================================================== */
exports.presignUploadAta = async (req, res) => {
  try {

    const { id } = req.params;

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
    });

    if (!treinamento) {
      return res.status(404).json({
        success: false,
        message: "Treinamento não encontrado",
      });
    }

    if (treinamento.status !== "ABERTO") {
      return res.status(400).json({
        success: false,
        message: "Treinamento já finalizado",
      });
    }

    if (!process.env.R2_WORKER_UPLOAD_URL) {
      return res.status(500).json({
        success: false,
        message: "R2_WORKER_UPLOAD_URL não configurado",
      });
    }

    const key = `treinamentos/${id}/${crypto.randomUUID()}.pdf`;

    return res.json({
      success: true,
      key,
      uploadUrl: `${process.env.R2_WORKER_UPLOAD_URL}/${key}`,
    });

  } catch (err) {

    console.error("❌ presignUploadAta:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao gerar URL de upload",
    });

  }
};


/* =====================================================
   FINALIZAR TREINAMENTO (UPLOAD PDF)
===================================================== */
exports.finalizarTreinamento = async (req, res) => {
  try {

    const { id } = req.params;

    const { documentoKey, nome, mime, size } = req.body;

    if (!documentoKey) {
      return res.status(400).json({
        success: false,
        message: "Documento PDF é obrigatório",
      });
    }

    const treinamento = await prisma.treinamento.update({

      where: { idTreinamento: Number(id) },

      data: {

        status: "FINALIZADO",

        ataPdfUrl: documentoKey,

        ataPdfNome: nome || "ata-treinamento.pdf",

        ataPdfMime: mime || "application/pdf",

        ataPdfSize: size || null,

        finalizadoAt: new Date(),

        finalizadoPor: req.user.id,

      },

    });

    return res.json({
      success: true,
      data: treinamento,
    });

  } catch (err) {

    console.error("❌ finalizarTreinamento:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao finalizar treinamento",
    });

  }
};


/* =====================================================
   LISTAR COLABORADORES POR SETOR
===================================================== */
exports.listParticipantesPorSetor = async (req, res) => {
  try {

    const { idSetor, busca } = req.query;

    const where = {
      status: "ATIVO",
    };

    if (idSetor) {
      where.idSetor = Number(idSetor);
    }

    if (busca) {

      where.OR = [

        {
          nomeCompleto: {
            contains: busca,
            mode: "insensitive",
          },
        },

        {
          cpf: {
            contains: busca,
          },
        },

        {
          opsId: {
            contains: busca,
            mode: "insensitive",
          },
        },

      ];

    }

    const colaboradores = await prisma.colaborador.findMany({

      where,

      select: {
        opsId: true,
        nomeCompleto: true,
        cpf: true,
        idSetor: true,
      },

      orderBy: {
        nomeCompleto: "asc",
      },

    });

    return res.json({
      success: true,
      data: colaboradores,
    });

  } catch (err) {

    console.error("❌ listParticipantesPorSetor:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao buscar participantes",
    });

  }
};


/* =====================================================
   ATUALIZAR PARTICIPANTES DO TREINAMENTO
===================================================== */
exports.atualizarParticipantes = async (req, res) => {
  try {

    const { id } = req.params;
    const { participantes = [] } = req.body;

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
    });

    if (!treinamento) {
      return res.status(404).json({
        success: false,
        message: "Treinamento não encontrado",
      });
    }

    if (treinamento.status !== "ABERTO") {
      return res.status(400).json({
        success: false,
        message: "Não é possível editar participantes de um treinamento finalizado",
      });
    }

    // Substitui todos os participantes em uma transação
    await prisma.$transaction([
      prisma.treinamentoParticipante.deleteMany({
        where: { idTreinamento: Number(id) },
      }),
      prisma.treinamentoParticipante.createMany({
        data: participantes.map((p) => ({
          idTreinamento: Number(id),
          opsId: p.opsId,
          cpf: p.cpf || null,
          adicionadoPor: req.user.id,
        })),
      }),
    ]);

    const updated = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
      include: {
        liderResponsavel: { select: { nomeCompleto: true } },
        setores: { include: { setor: true } },
        participantes: {
          include: {
            colaborador: { select: { nomeCompleto: true, cpf: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: updated });

  } catch (err) {

    console.error("❌ atualizarParticipantes:", err);

    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar participantes",
    });

  }
};
