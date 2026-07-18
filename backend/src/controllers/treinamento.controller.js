const { prisma } = require("../config/database");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getR2Client } = require("../services/r2");

const BUCKET = process.env.R2_BUCKET_NAME;

/* =====================================================
   CRIAR TREINAMENTO
===================================================== */
function normalizeDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

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

    const instrutorExiste = await prisma.colaborador.findUnique({
      where: { opsId: instrutorOpsId },
      select: { opsId: true },
    });

    if (!instrutorExiste) {
      return res.status(400).json({
        success: false,
        message: `Colaborador responsável não encontrado (OpsId: ${instrutorOpsId}). Verifique se o líder está cadastrado no sistema.`,
      });
    }

    const treinamento = await prisma.treinamento.create({

      data: {

        dataTreinamento: normalizeDateOnly(dataTreinamento),

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
              select: {
                nomeCompleto: true,
                cpf: true,
                setor: { select: { nomeSetor: true } },
                turno: { select: { nomeTurno: true } },
              },
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
   BUSCAR TREINAMENTO POR ID
===================================================== */
exports.getTreinamento = async (req, res) => {
  try {
    const { id } = req.params;

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
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
              select: {
                nomeCompleto: true,
                cpf: true,
                setor: { select: { nomeSetor: true } },
                turno: { select: { nomeTurno: true } },
              },
            },
          },
        },
      },
    });

    if (!treinamento) {
      return res.status(404).json({ success: false, message: "Treinamento não encontrado" });
    }

    return res.json({ success: true, data: treinamento });
  } catch (err) {
    console.error("❌ getTreinamento:", err);
    return res.status(500).json({ success: false, message: "Erro ao buscar treinamento" });
  }
};


/* =====================================================
   LISTAR TREINAMENTOS
===================================================== */
exports.statsTreinamentos = async (req, res) => {
  try {
    const estacaoWhere = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? { liderResponsavel: { idEstacao: req.dbContext.estacaoId } }
      : {};

    const [total, finalizados, pendentes, cancelados] = await Promise.all([
      prisma.treinamento.count({ where: estacaoWhere }),
      prisma.treinamento.count({ where: { ...estacaoWhere, status: "FINALIZADO" } }),
      prisma.treinamento.count({ where: { ...estacaoWhere, status: "ABERTO" } }),
      prisma.treinamento.count({ where: { ...estacaoWhere, status: "CANCELADO" } }),
    ]);

    return res.json({ success: true, data: { total, finalizados, pendentes, cancelados } });
  } catch (err) {
    console.error("❌ statsTreinamentos:", err);
    return res.status(500).json({ success: false, message: "Erro ao buscar estatísticas" });
  }
};

exports.listTreinamentos = async (req, res) => {
  try {

    const { page = 1, limit = 50, tema, processo, lider, dataInicio, dataFim } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
      ? { liderResponsavel: { idEstacao: req.dbContext.estacaoId } }
      : {};

    if (tema)    where.tema     = { contains: tema,    mode: "insensitive" };
    if (processo) where.processo = { contains: processo, mode: "insensitive" };
    if (lider)   where.liderResponsavelOpsId = lider;
    if (dataInicio || dataFim) {
      where.dataTreinamento = {};
      if (dataInicio) where.dataTreinamento.gte = new Date(`${dataInicio}T00:00:00.000Z`);
      if (dataFim)    where.dataTreinamento.lte = new Date(`${dataFim}T23:59:59.999Z`);
    }

    const [treinamentos, total] = await Promise.all([
      prisma.treinamento.findMany({
        where,
        orderBy: { dataTreinamento: "desc" },
        skip,
        take: limitNum,
        include: {
          liderResponsavel: { select: { nomeCompleto: true } },
          participantes: {
            include: {
              colaborador: {
                select: {
                  nomeCompleto: true,
                  cpf: true,
                  setor: { select: { nomeSetor: true } },
                  turno: { select: { nomeTurno: true } },
                },
              },
            },
          },
          setores: { include: { setor: true } },
        },
      }),
      prisma.treinamento.count({ where }),
    ]);

    return res.json({
      success: true,
      data: treinamentos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasNextPage: pageNum < (Math.ceil(total / limitNum) || 1),
        hasPreviousPage: pageNum > 1,
      },
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
// Mantido apenas para compatibilidade — não é mais usado pelo frontend
exports.presignUploadAta = async (req, res) => {
  return res.status(410).json({ success: false, message: "Use POST /:id/upload-ata" });
};

/* =====================================================
   UPLOAD ATA DIRETO (multipart → backend → R2)
   Evita CORS: o backend faz o PUT ao R2 server-side
===================================================== */
exports.uploadAta = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Arquivo PDF não enviado" });
    }

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
    });

    if (!treinamento) {
      return res.status(404).json({ success: false, message: "Treinamento não encontrado" });
    }

    if (!["ABERTO", "RASCUNHO"].includes(treinamento.status)) {
      return res.status(400).json({ success: false, message: "Treinamento já finalizado" });
    }

    if (!BUCKET) {
      return res.status(500).json({ success: false, message: "R2_BUCKET_NAME não configurado" });
    }

    const key = `treinamentos/${id}/${crypto.randomUUID()}.pdf`;

    const r2 = getR2Client();
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: "application/pdf",
      ContentLength: req.file.size,
    }));

    // Finaliza o treinamento já com a chave salva
    const updated = await prisma.treinamento.update({
      where: { idTreinamento: Number(id) },
      data: {
        status: "FINALIZADO",
        ataPdfUrl: key,
        ataPdfNome: req.file.originalname || "ata-treinamento.pdf",
        ataPdfMime: "application/pdf",
        ataPdfSize: req.file.size,
        finalizadoAt: new Date(),
        finalizadoPor: req.user.id,
      },
    });

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("❌ uploadAta:", err);
    return res.status(500).json({ success: false, message: "Erro ao fazer upload da ATA" });
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

    if (!["ABERTO", "RASCUNHO"].includes(treinamento.status)) {
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
            colaborador: {
              select: {
                nomeCompleto: true,
                cpf: true,
                setor: { select: { nomeSetor: true } },
                turno: { select: { nomeTurno: true } },
              },
            },
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


/* =====================================================
   PRESIGN DOWNLOAD ATA (PDF)
===================================================== */
exports.presignDownloadAta = async (req, res) => {
  try {
    const { id } = req.params;

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
    });

    if (!treinamento) {
      return res.status(404).json({ success: false, message: "Treinamento não encontrado" });
    }

    if (!treinamento.ataPdfUrl) {
      return res.status(404).json({ success: false, message: "Nenhuma ATA anexada" });
    }

    if (!BUCKET) {
      return res.status(500).json({ success: false, message: "R2_BUCKET_NAME não configurado" });
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: treinamento.ataPdfUrl,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="${treinamento.ataPdfNome || "ata-treinamento.pdf"}"`,
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 600 });

    return res.json({ success: true, data: { url, expiresIn: 600 } });
  } catch (err) {
    console.error("❌ presignDownloadAta:", err);
    return res.status(500).json({ success: false, message: "Erro ao gerar URL de download" });
  }
};


/* =====================================================
   CANCELAR TREINAMENTO
===================================================== */
exports.cancelarTreinamento = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({
        success: false,
        message: "Motivo do cancelamento é obrigatório",
      });
    }

    const treinamento = await prisma.treinamento.findUnique({
      where: { idTreinamento: Number(id) },
    });

    if (!treinamento) {
      return res.status(404).json({ success: false, message: "Treinamento não encontrado" });
    }

    if (!["ABERTO", "RASCUNHO"].includes(treinamento.status)) {
      return res.status(400).json({
        success: false,
        message: "Apenas treinamentos em aberto podem ser cancelados",
      });
    }

    const updated = await prisma.treinamento.update({
      where: { idTreinamento: Number(id) },
      data: {
        status: "CANCELADO",
        motivoCancelamento: motivo.trim(),
        canceladoAt: new Date(),
        canceladoPor: req.user.id,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ cancelarTreinamento:", err);
    return res.status(500).json({ success: false, message: "Erro ao cancelar treinamento" });
  }
};

/* =====================================================
   IMPORTAR TREINAMENTO VIA PLANILHA
===================================================== */
exports.importTreinamento = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Arquivo não enviado" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });

    // ── Aba "Treinamento" ─────────────────────────────────────
    const sheetT = wb.Sheets["Treinamento"];
    if (!sheetT) {
      return res.status(400).json({ success: false, message: 'Aba "Treinamento" não encontrada. Use o modelo padrão.' });
    }

    const headerRows = XLSX.utils.sheet_to_json(sheetT, { header: 1 });
    const hm = {};
    for (const row of headerRows) {
      if (row[0]) hm[String(row[0]).toLowerCase().trim()] = row[1] ?? "";
    }

    const errors = [];

    // Campos obrigatórios
    if (!hm["data_treinamento"]) errors.push({ campo: "data_treinamento", mensagem: "Data do treinamento é obrigatória" });
    if (!hm["processo"])         errors.push({ campo: "processo",         mensagem: "Processo é obrigatório" });
    if (!hm["tema"])             errors.push({ campo: "tema",             mensagem: "Tema é obrigatório" });
    if (!hm["soc"])              errors.push({ campo: "soc",              mensagem: "SOC é obrigatório" });
    if (!hm["ops_id_instrutor"]) errors.push({ campo: "ops_id_instrutor", mensagem: "OpsId do instrutor é obrigatório" });

    // Parse data
    let dataDate = null;
    if (hm["data_treinamento"]) {
      const raw = hm["data_treinamento"];
      if (raw instanceof Date) {
        dataDate = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12);
      } else {
        const str = String(raw).trim();
        const matchBR = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchBR) {
          dataDate = new Date(Number(matchBR[3]), Number(matchBR[2]) - 1, Number(matchBR[1]), 12);
        } else if (matchISO) {
          dataDate = new Date(Number(matchISO[1]), Number(matchISO[2]) - 1, Number(matchISO[3]), 12);
        } else {
          errors.push({ campo: "data_treinamento", mensagem: `Formato inválido: "${str}". Use DD/MM/YYYY` });
        }
      }
    }

    // ── Aba "Participantes" ───────────────────────────────────
    const sheetP = wb.Sheets["Participantes"];
    if (!sheetP) {
      return res.status(400).json({ success: false, message: 'Aba "Participantes" não encontrada. Use o modelo padrão.' });
    }

    const partRows = XLSX.utils.sheet_to_json(sheetP, { defval: "" })
      .filter((r) => {
        const id = String(r["ops_id"] || "").trim();
        return id && id !== "Ops00000"; // ignora linha de exemplo
      });
    if (!partRows.length) {
      errors.push({ mensagem: 'Nenhum participante encontrado na aba "Participantes"' });
    }

    const opsIdsSeen = new Set();
    const participantes = [];

    for (let i = 0; i < partRows.length; i++) {
      const row = partRows[i];
      const linha = i + 2;
      const opsId = String(row["ops_id"] || "").trim();
      const cpf   = String(row["cpf"]    || "").trim() || null;

      if (!opsId) {
        errors.push({ linha, mensagem: "ops_id é obrigatório" });
        continue;
      }
      if (opsIdsSeen.has(opsId)) {
        errors.push({ linha, mensagem: `Participante duplicado: ${opsId}` });
        continue;
      }
      opsIdsSeen.add(opsId);
      const presencaRaw = String(row["presenca"] || "").trim().toLowerCase();
      const presente = presencaRaw === "" || presencaRaw === "presente" || presencaRaw === "sim";
      participantes.push({ opsId, cpf, presente });
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const instrutorOpsId = String(hm["ops_id_instrutor"]).trim();

    // Verificar instrutor no banco
    const instrutor = await prisma.colaborador.findUnique({
      where: { opsId: instrutorOpsId },
      select: { opsId: true, nomeCompleto: true },
    });
    if (!instrutor) {
      return res.status(400).json({
        success: false,
        errors: [{ campo: "ops_id_instrutor", mensagem: `Instrutor não encontrado: ${instrutorOpsId}` }],
      });
    }

    // Verificar participantes no banco
    const opsIdsArr = participantes.map((p) => p.opsId);
    const colaboradoresDB = await prisma.colaborador.findMany({
      where: { opsId: { in: opsIdsArr } },
      select: { opsId: true, status: true, nomeCompleto: true },
    });
    const colabMap = new Map(colaboradoresDB.map((c) => [c.opsId, c]));

    const dbErrors = [];
    for (let i = 0; i < participantes.length; i++) {
      const p = participantes[i];
      const linha = i + 2;
      const colab = colabMap.get(p.opsId);
      if (!colab) {
        dbErrors.push({ linha, mensagem: `Ops ID não encontrado: ${p.opsId}` });
      }
    }
    if (dbErrors.length > 0) {
      return res.status(400).json({ success: false, errors: dbErrors });
    }

    // ── Criar em transação ─────────────────────────────────────
    const treinamento = await prisma.$transaction(async (tx) => {
      return tx.treinamento.create({
        data: {
          dataTreinamento: dataDate,
          processo:        String(hm["processo"]).trim(),
          tema:            String(hm["tema"]).trim(),
          soc:             String(hm["soc"]).trim(),
          local:           hm["local"]           ? String(hm["local"]).trim().slice(0, 200) || null : null,
          horarioInicio:   /^\d{2}:\d{2}$/.test(String(hm["horario_inicio"] || "").trim()) ? String(hm["horario_inicio"]).trim() : null,
          horarioFim:      /^\d{2}:\d{2}$/.test(String(hm["horario_fim"]   || "").trim()) ? String(hm["horario_fim"]).trim()   : null,
          status:          "RASCUNHO",
          liderResponsavel: { connect: { opsId: instrutorOpsId } },
          criadoPor:       req.user.id,
          participantes: {
            create: participantes.map((p) => ({
              opsId:         p.opsId,
              cpf:           p.cpf || null,
              presente:      p.presente,
              adicionadoPor: req.user.id,
            })),
          },
        },
        include: {
          liderResponsavel: { select: { nomeCompleto: true } },
          participantes: {
            include: {
              colaborador: {
                select: {
                  nomeCompleto: true,
                  cargo:  { select: { nomeCargo: true } },
                  setor:  { select: { nomeSetor: true } },
                  turno:  { select: { nomeTurno: true } },
                  empresa: { select: { razaoSocial: true } },
                },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: `Treinamento criado com ${participantes.length} participante(s)`,
      data: treinamento,
    });

  } catch (err) {
    console.error("❌ importTreinamento:", err);
    return res.status(500).json({ success: false, message: "Erro ao importar treinamento" });
  }
};
