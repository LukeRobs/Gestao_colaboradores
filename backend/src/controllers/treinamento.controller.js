const { prisma } = require("../config/database");
const crypto = require("crypto");

/* ===========================
   CRIAR TREINAMENTO
=========================== */
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

    // Se não foi informado um instrutor específico, usa o usuário logado
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

        // 🔗 vínculo correto com colaborador instrutor
        liderResponsavel: {
          connect: {
            opsId: instrutorOpsId,
          },
        },

        criadoPor: req.user.id,

        setores: {
          create: setores.map((idSetor) => ({
            idSetor,
          })),
        },

        participantes: {
          create: participantes.map((p) => ({
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

/* ===========================
   LISTAR TREINAMENTOS
=========================== */
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

    return res.json({ success: true, data: treinamentos });
  } catch (err) {
    console.error("❌ listTreinamentos:", err);
    return res.status(500).json({ success: false });
  }
};

/* ===========================
   PRESIGN UPLOAD ATA (PDF)
=========================== */
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

/* ===========================
   FINALIZAR TREINAMENTO (PDF)
=========================== */
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

    return res.json({ success: true, data: treinamento });
  } catch (err) {
    console.error("❌ finalizarTreinamento:", err);
    return res.status(500).json({ success: false });
  }
};
