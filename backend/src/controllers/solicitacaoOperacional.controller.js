const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
} = require("../utils/response");
const { isDiaDSR } = require("../utils/dsr");
const { getEstacoesDoGrupo } = require("../config/estacaoGrupos");
const {
  sendSolicitacaoOperacionalEmail,
  sendDecisaoOperacionalEmail,
} = require("../reports/email");
const {
  gerarFrequenciaDesligamento,
  gerarDSRFuturoColaborador,
  gerarDSRBackfillColaborador,
  gerarFrequenciaFerias,
  gerarFrequenciaAfastamento,
} = require("../services/dsrBackfill.service");
const { sendSolicitacaoNotification } = require("../services/seatalkSolicitacoes.service");
const csv = require("csvtojson");

// admin@admin.com aprova normalmente, mas não deve receber os e-mails de
// notificação de solicitação pendente (continua valendo como aprovador).
const EMAILS_SEM_NOTIFICACAO_EMAIL = ["admin@admin.com"];
const emailsParaNotificar = (aprovadores) =>
  aprovadores
    .map((a) => a.email)
    .filter((email) => !EMAILS_SEM_NOTIFICACAO_EMAIL.includes(email));

const TIPO_LABEL_SEATALK = {
  FOLGA: "Folga",
  BANCO_HORAS: "Banco de Horas",
  SINERGIA: "Sinergia",
  TROCA_DSR: "Troca de DSR",
  HORA_EXTRA: "Hora Extra",
  TROCA_GESTAO: "Troca de Gestão",
  TROCA_ESCALA: "Troca de Escala",
  DESLIGAMENTO: "Desligamento",
  TROCA_TURNO: "Troca de Turno",
  FERIAS: "Férias",
  AFASTAMENTO: "Afastamento",
  INTERNALIZACAO: "Internalização",
};

// Segunda etapa de aprovação por tipo — RH confirma Troca de Escala e Troca
// de DSR; Coordenador confirma Folga, Banco de Horas, Hora Extra, Troca de
// Gestão e Desligamento. Sinergia não tem entrada aqui — continua com
// aprovação única, como antes. Troca de Turno, Férias, Afastamento e
// Internalização também passam pelo RH — mesma natureza de mudança
// cadastral/de escala das outras confirmadas por RH.
const SEGUNDA_APROVACAO_POR_TIPO = {
  FOLGA: "COORDENADOR",
  BANCO_HORAS: "COORDENADOR",
  HORA_EXTRA: "COORDENADOR",
  TROCA_GESTAO: "COORDENADOR",
  DESLIGAMENTO: "COORDENADOR",
  TROCA_ESCALA: "RH",
  TROCA_DSR: "RH",
  TROCA_TURNO: "RH",
  FERIAS: "RH",
  AFASTAMENTO: "RH",
  INTERNALIZACAO: "RH",
};

const SEGUNDO_APROVADOR_LABEL = { RH: "RH", COORDENADOR: "Coordenador" };

function formatDataBR(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatDataHoraBR(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function linkSolicitacaoOperacional(idSolicitacao) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${frontendUrl}/solicitacoes-operacionais/${idSolicitacao}`;
}

const DESTINOS_SINERGIA_VALIDOS = ["FULL", "TRATATIVAS", "OUTRA_OPERACAO", "ALMOXARIFADO", "MEIO_AMBIENTE"];

const TIPOS_DESLIGAMENTO_VALIDOS = ["DV", "DF", "DP"];
const MOTIVOS_DESLIGAMENTO_VALIDOS = [
  "COMPLIANCE", "ALTO_INDICE_ABS", "ABANDONO", "DESEMPENHO_BAIXO",
  "DESVIO_COMPORTAMENTAL", "TERMINO_CONTRATO", "NO_SHOW", "DECLINIO",
  "NAO_CONFORMIDADE", "PEDIDO_DEMISSAO", "REDUCAO_QUADRO",
];

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

/* =====================================================
   HELPERS
===================================================== */
function normalizeDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function agoraBrasil() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function startOfDayBR(date) {
  const d = date ? new Date(date) : agoraBrasil();
  d.setHours(0, 0, 0, 0);
  return d;
}

function ymd(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function estacaoWhereSolicitacao(req) {
  return !req.dbContext?.isGlobal && req.dbContext?.estacaoId
    ? { colaborador: { idEstacao: req.dbContext.estacaoId } }
    : {};
}

/**
 * Usado em buscas por ID (que não passam pelo where da listagem):
 * bloqueia acesso a registros de outra estação.
 */
function pertenceAEstacaoDoUsuario(req, idEstacaoRegistro) {
  if (req.dbContext?.isGlobal || !req.dbContext?.estacaoId) return true;
  if (!idEstacaoRegistro) return true;
  return idEstacaoRegistro === req.dbContext.estacaoId;
}

/**
 * Um aprovador só pode decidir solicitações da própria estação (ou de uma
 * estação "irmã" dela — ver config/estacaoGrupos.js) — exceto quem tem
 * idEstacao null (aprovador global, só Admin cadastra).
 */
async function isAprovadorAtivo(email, idEstacaoSolicitacao) {
  if (!email) return false;
  const aprovador = await prisma.aprovadorOperacional.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      ativo: true,
      OR: [{ idEstacao: { in: getEstacoesDoGrupo(idEstacaoSolicitacao) } }, { idEstacao: null }],
    },
  });
  return !!aprovador;
}

/**
 * Segunda etapa: RH ou Coordenador, dependendo do tipo da solicitação.
 * Mesma regra de escopo por estação (irmãs incluídas) do primeiro aprovador.
 */
async function isSegundoAprovadorAtivo(email, tipoSegundo, idEstacaoSolicitacao) {
  if (!email || !tipoSegundo) return false;
  const aprovador = await prisma.segundoAprovadorOperacional.findFirst({
    where: {
      tipo: tipoSegundo,
      email: email.trim().toLowerCase(),
      ativo: true,
      OR: [{ idEstacao: { in: getEstacoesDoGrupo(idEstacaoSolicitacao) } }, { idEstacao: null }],
    },
  });
  return !!aprovador;
}

/**
 * Validações inteligentes comuns a todos os tipos: colaborador existe e
 * está ativo, não tem outra solicitação pendente, e não há duplicata
 * pra mesma data.
 */
async function validarColaboradorDisponivel(opsId, dataStr, { excluirIdSolicitacao } = {}) {
  const colaborador = await prisma.colaborador.findUnique({
    where: { opsId },
    select: { opsId: true, nomeCompleto: true, status: true, idEstacao: true, idEscala: true, escala: { select: { nomeEscala: true } } },
  });

  if (!colaborador) {
    throw new HttpError(`Colaborador não encontrado (${opsId})`, 400);
  }
  if (colaborador.status !== "ATIVO") {
    throw new HttpError(`${colaborador.nomeCompleto} não está ativo`, 400);
  }

  const pendente = await prisma.solicitacaoOperacional.findFirst({
    where: {
      status: "PENDENTE",
      OR: [{ opsId }, { opsId2: opsId }],
      ...(excluirIdSolicitacao ? { idSolicitacao: { not: excluirIdSolicitacao } } : {}),
    },
  });
  if (pendente) {
    throw new HttpError(`${colaborador.nomeCompleto} já possui uma solicitação pendente`, 400);
  }

  const dataNormalizada = normalizeDateOnly(dataStr);
  const duplicada = await prisma.solicitacaoOperacional.findFirst({
    where: {
      status: { in: ["PENDENTE", "APROVADA"] },
      data: dataNormalizada,
      OR: [{ opsId }, { opsId2: opsId }],
      ...(excluirIdSolicitacao ? { idSolicitacao: { not: excluirIdSolicitacao } } : {}),
    },
  });
  if (duplicada) {
    throw new HttpError(
      `${colaborador.nomeCompleto} já tem uma solicitação para ${ymd(dataNormalizada)}`,
      400
    );
  }

  return colaborador;
}

// Mesmos critérios usados no Dashboard de Internalização (candidatosInternalizacao):
// BPO, cargo elegível, ativo, +90 dias de casa, sem atestado, sem falta
// (idTipoAusencia 3 ou 32), sem medida disciplinar.
const BPO_EMPRESAS = ["ADECCO", "ADILIS", "LUANDRE"];
function isCargoElegivelInternalizacao(cargo) {
  const nome = String(cargo || "").toUpperCase();
  return nome.includes("AUXILIAR DE LOGÍSTICA I") || nome.includes("AUXILIAR DE LOGÍSTICA II");
}

/**
 * Verifica se um colaborador atende aos critérios de elegibilidade para
 * Internalização hoje. Retorna { elegivel, motivos, diasCasa }. Usado tanto
 * pelo endpoint de checagem prévia (frontend avisa antes de enviar) quanto
 * como guarda no próprio createSolicitacao (nunca confia só no frontend).
 */
async function verificarElegibilidadeInternalizacao(opsId) {
  const colaborador = await prisma.colaborador.findUnique({
    where: { opsId },
    select: {
      opsId: true,
      status: true,
      dataAdmissao: true,
      cargo: { select: { nomeCargo: true } },
      empresa: { select: { razaoSocial: true } },
    },
  });

  if (!colaborador) {
    return { elegivel: false, motivos: ["Colaborador não encontrado"], diasCasa: null };
  }

  const motivos = [];

  if (colaborador.status !== "ATIVO") {
    motivos.push("Colaborador não está ativo");
  }

  const empresaAtual = String(colaborador.empresa?.razaoSocial || "").toUpperCase();
  if (!BPO_EMPRESAS.includes(empresaAtual)) {
    motivos.push("Colaborador não pertence a uma empresa terceirizada (BPO)");
  }

  if (!isCargoElegivelInternalizacao(colaborador.cargo?.nomeCargo)) {
    motivos.push("Cargo não elegível para internalização");
  }

  const diasCasa = colaborador.dataAdmissao
    ? Math.floor((new Date() - new Date(colaborador.dataAdmissao)) / 86400000)
    : null;
  if (diasCasa === null || diasCasa <= 90) {
    motivos.push("Menos de 90 dias de casa");
  }

  if (motivos.length === 0) {
    const [qtdAtestados, qtdFaltas, qtdMedidas] = await Promise.all([
      prisma.atestadoMedico.count({ where: { opsId } }),
      prisma.frequencia.count({ where: { opsId, idTipoAusencia: { in: [3, 32] } } }),
      prisma.medidaDisciplinar.count({ where: { opsId } }),
    ]);
    if (qtdAtestados > 0) motivos.push("Possui atestado médico registrado");
    if (qtdFaltas > 0) motivos.push("Possui falta registrada");
    if (qtdMedidas > 0) motivos.push("Possui medida disciplinar registrada");
  }

  return { elegivel: motivos.length === 0, motivos, diasCasa };
}

/**
 * Verifica se uma data é DSR "de verdade" para o colaborador — ou seja,
 * exatamente o que o Controle de Presença exibe hoje para aquele dia.
 * O DSR de um colaborador nem sempre segue o padrão semanal da escala:
 * o módulo de Planejamento de Folgas Dominicais grava DSRs extras/rotativos
 * direto em `frequencia` (justificativa "DSR_FOLGA_DOMINICAL_AUTOMATICA"),
 * então uma data pode ser DSR sem bater com `escala.diasDsr`. Por isso,
 * a fonte de verdade é sempre o registro em `frequencia` quando ele existe;
 * o padrão semanal só serve de fallback para datas ainda não geradas.
 */
async function isDiaDSRReal(opsId, data, nomeEscala) {
  const freq = await prisma.frequencia.findUnique({
    where: { opsId_dataReferencia: { opsId, dataReferencia: data } },
    include: { tipoAusencia: true },
  });
  if (freq) {
    return freq.tipoAusencia?.codigo === "DSR";
  }
  return isDiaDSR(data, nomeEscala);
}

/**
 * Normaliza o texto de destino vindo de um CSV (acentos, maiúsculas,
 * espaços em vez de underscore) para uma das chaves válidas do enum
 * DestinoSinergia. Retorna null se não bater com nenhuma.
 */
function normalizarDestinoSinergia(raw) {
  const normalizado = String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return DESTINOS_SINERGIA_VALIDOS.includes(normalizado) ? normalizado : null;
}

/**
 * Aceita data em ISO (aaaa-mm-dd) ou no formato brasileiro (dd/mm/aaaa),
 * sempre devolvendo ISO (o formato que normalizeDateOnly espera). Retorna
 * null se não reconhecer o formato.
 */
function parseDataFlexivel(raw) {
  const texto = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/** Normaliza as chaves de uma linha de CSV (trim + lowercase) pra busca tolerante a maiúsculas/acentos de cabeçalho. */
function normalizarLinhaCsv(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

/* =====================================================
   IMPORTAR SINERGIA EM LOTE (CSV)
   Cada linha é validada e criada isoladamente — uma linha inválida
   não derruba as demais. Notificações (e-mail/SeaTalk) são enviadas
   uma única vez, resumindo o lote, em vez de uma por solicitação.
===================================================== */
exports.importarSinergiaLote = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, "Usuário não autenticado", 401);
    }
    if (!req.file) {
      return errorResponse(res, "Nenhum arquivo enviado", 400);
    }

    const csvString = req.file.buffer.toString("utf-8");
    const rows = await csv({ delimiter: "," }).fromString(csvString);

    if (!rows.length) {
      return errorResponse(res, "Arquivo CSV vazio", 400);
    }
    if (rows.length > 500) {
      return errorResponse(res, "Máximo de 500 linhas por importação", 400);
    }

    const criadas = [];
    const erros = [];

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 2; // +2: linha 1 é o cabeçalho
      const raw = normalizarLinhaCsv(rows[i]);
      const cpfOriginal = raw.cpf || "";

      try {
        const cpfDigits = String(cpfOriginal).replace(/\D/g, "");
        if (cpfDigits.length !== 11) {
          throw new HttpError(`CPF inválido: "${cpfOriginal}"`, 400);
        }

        const motivoLinha = String(raw.motivo || "").trim();
        if (!motivoLinha) {
          throw new HttpError("Motivo é obrigatório", 400);
        }

        const destino = normalizarDestinoSinergia(raw.destino);
        if (!destino) {
          throw new HttpError(
            `Destino inválido: "${raw.destino || ""}". Use FULL, TRATATIVAS, OUTRA_OPERACAO, ALMOXARIFADO ou MEIO_AMBIENTE`,
            400
          );
        }

        const dataIso = parseDataFlexivel(raw.data);
        if (!dataIso) {
          throw new HttpError(`Data inválida: "${raw.data || ""}". Use o formato dd/mm/aaaa`, 400);
        }

        const colaborador = await prisma.colaborador.findFirst({
          where: { cpf: cpfDigits },
          select: { opsId: true, nomeCompleto: true, idEstacao: true, cpf: true },
        });
        if (!colaborador || !pertenceAEstacaoDoUsuario(req, colaborador.idEstacao)) {
          throw new HttpError(`Colaborador não encontrado para o CPF ${cpfOriginal}`, 400);
        }

        await validarColaboradorDisponivel(colaborador.opsId, dataIso);

        const solicitacao = await prisma.$transaction(async (tx) => {
          const nova = await tx.solicitacaoOperacional.create({
            data: {
              tipo: "SINERGIA",
              opsId: colaborador.opsId,
              data: normalizeDateOnly(dataIso),
              sinergiaDestino: destino,
              motivo: motivoLinha,
              solicitanteUserId: req.user.id,
            },
          });
          await tx.solicitacaoOperacionalHistorico.create({
            data: {
              idSolicitacao: nova.idSolicitacao,
              evento: `Solicitação criada por ${req.user.name} (importação em lote)`,
            },
          });
          return nova;
        });

        criadas.push({
          linha,
          idSolicitacao: solicitacao.idSolicitacao,
          colaboradorNome: colaborador.nomeCompleto,
          idEstacao: colaborador.idEstacao,
        });
      } catch (err) {
        const mensagem = err instanceof HttpError ? err.message : err.message || "Erro desconhecido";
        erros.push({ linha, cpf: cpfOriginal, motivo: mensagem });
      }
    }

    // Notificações resumidas do lote — best-effort, não bloqueia a resposta
    if (criadas.length > 0) {
      try {
        const idsEstacao = [...new Set(criadas.map((c) => c.idEstacao).filter((v) => v != null).flatMap(getEstacoesDoGrupo))];
        const aprovadoresAtivos = await prisma.aprovadorOperacional.findMany({
          where: {
            ativo: true,
            OR: [{ idEstacao: { in: idsEstacao } }, { idEstacao: null }],
          },
        });

        if (aprovadoresAtivos.length > 0) {
          const emails = [...new Set(aprovadoresAtivos.map((a) => a.email))];
          const listaColaboradores = criadas
            .slice(0, 15)
            .map((c) => `- ${c.colaboradorNome} (Nº ${c.idSolicitacao})`)
            .join("\n");
          const resto = criadas.length > 15 ? `\n- ...e mais ${criadas.length - 15}` : "";

          await sendSolicitacaoNotification(
            `# 📋 Sinergia — Importação em Lote\n\n` +
              `- **Solicitações criadas:** ${criadas.length}\n` +
              `- **Solicitante:** ${req.user.name}\n\n` +
              `---\n\n${listaColaboradores}${resto}\n\n` +
              `[Ver todas as solicitações](${(process.env.FRONTEND_URL || "http://localhost:5173")}/solicitacoes-operacionais)`,
            { mentionEmails: emails }
          );
        }
      } catch (notifErr) {
        console.error("⚠️ Falha ao notificar importação em lote de sinergia:", notifErr.message);
      }
    }

    return successResponse(
      res,
      { criadas: criadas.length, totalLinhas: rows.length, erros },
      `${criadas.length} solicitação(ões) criada(s), ${erros.length} erro(s)`
    );
  } catch (err) {
    console.error("❌ importarSinergiaLote:", err);
    return errorResponse(res, "Erro ao importar solicitações de sinergia", 500);
  }
};

/* =====================================================
   IMPORTAR BANCO DE HORAS EM LOTE (CSV)
   Mesmo padrão de importarSinergiaLote: cada linha é validada e criada
   isoladamente — uma linha inválida não derruba as demais.
===================================================== */
exports.importarBancoHorasLote = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, "Usuário não autenticado", 401);
    }
    if (!req.file) {
      return errorResponse(res, "Nenhum arquivo enviado", 400);
    }

    const csvString = req.file.buffer.toString("utf-8");
    const rows = await csv({ delimiter: "," }).fromString(csvString);

    if (!rows.length) {
      return errorResponse(res, "Arquivo CSV vazio", 400);
    }
    if (rows.length > 500) {
      return errorResponse(res, "Máximo de 500 linhas por importação", 400);
    }

    const criadas = [];
    const erros = [];

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 2; // +2: linha 1 é o cabeçalho
      const raw = normalizarLinhaCsv(rows[i]);
      const cpfOriginal = raw.cpf || "";

      try {
        const cpfDigits = String(cpfOriginal).replace(/\D/g, "");
        if (cpfDigits.length !== 11) {
          throw new HttpError(`CPF inválido: "${cpfOriginal}"`, 400);
        }

        const motivoLinha = String(raw.motivo || "").trim();
        if (!motivoLinha) {
          throw new HttpError("Motivo é obrigatório", 400);
        }

        const dataIso = parseDataFlexivel(raw.data);
        if (!dataIso) {
          throw new HttpError(`Data inválida: "${raw.data || ""}". Use o formato dd/mm/aaaa`, 400);
        }

        const diaCompletoRaw = String(raw["dia completo"] || raw["dia_completo"] || "").trim().toUpperCase();
        const diaCompleto = ["SIM", "S", "TRUE", "1"].includes(diaCompletoRaw);

        let quantidadeHoras = null;
        let horaEntrada = null;

        if (!diaCompleto) {
          const qtdRaw = String(raw["quantidade de horas"] || raw["quantidade_horas"] || raw["horas"] || "").trim().replace(",", ".");
          quantidadeHoras = qtdRaw ? Number(qtdRaw) : NaN;
          if (!qtdRaw || Number.isNaN(quantidadeHoras) || quantidadeHoras <= 0) {
            throw new HttpError(
              `Quantidade de horas inválida: "${qtdRaw || ""}". Informe um número maior que zero, ou marque "Dia Completo"`,
              400
            );
          }

          horaEntrada = String(raw["hora de entrada"] || raw["hora_entrada"] || "").trim();
          if (!/^\d{2}:\d{2}$/.test(horaEntrada)) {
            throw new HttpError(
              `Hora de entrada inválida: "${horaEntrada || ""}". Use o formato HH:MM, ou marque "Dia Completo"`,
              400
            );
          }
        }

        const colaborador = await prisma.colaborador.findFirst({
          where: { cpf: cpfDigits },
          select: { opsId: true, nomeCompleto: true, idEstacao: true, cpf: true },
        });
        if (!colaborador || !pertenceAEstacaoDoUsuario(req, colaborador.idEstacao)) {
          throw new HttpError(`Colaborador não encontrado para o CPF ${cpfOriginal}`, 400);
        }

        await validarColaboradorDisponivel(colaborador.opsId, dataIso);

        const solicitacao = await prisma.$transaction(async (tx) => {
          const nova = await tx.solicitacaoOperacional.create({
            data: {
              tipo: "BANCO_HORAS",
              opsId: colaborador.opsId,
              data: normalizeDateOnly(dataIso),
              bhDiaCompleto: diaCompleto,
              bhQuantidadeHoras: diaCompleto ? null : quantidadeHoras,
              bhHoraEntrada: diaCompleto ? null : horaEntrada,
              motivo: motivoLinha,
              solicitanteUserId: req.user.id,
            },
          });
          await tx.solicitacaoOperacionalHistorico.create({
            data: {
              idSolicitacao: nova.idSolicitacao,
              evento: `Solicitação criada por ${req.user.name} (importação em lote)`,
            },
          });
          return nova;
        });

        criadas.push({
          linha,
          idSolicitacao: solicitacao.idSolicitacao,
          colaboradorNome: colaborador.nomeCompleto,
          idEstacao: colaborador.idEstacao,
        });
      } catch (err) {
        const mensagem = err instanceof HttpError ? err.message : err.message || "Erro desconhecido";
        erros.push({ linha, cpf: cpfOriginal, motivo: mensagem });
      }
    }

    // Notificações resumidas do lote — best-effort, não bloqueia a resposta
    if (criadas.length > 0) {
      try {
        const idsEstacao = [...new Set(criadas.map((c) => c.idEstacao).filter((v) => v != null).flatMap(getEstacoesDoGrupo))];
        const aprovadoresAtivos = await prisma.aprovadorOperacional.findMany({
          where: {
            ativo: true,
            OR: [{ idEstacao: { in: idsEstacao } }, { idEstacao: null }],
          },
        });

        if (aprovadoresAtivos.length > 0) {
          const emails = [...new Set(aprovadoresAtivos.map((a) => a.email))];
          const listaColaboradores = criadas
            .slice(0, 15)
            .map((c) => `- ${c.colaboradorNome} (Nº ${c.idSolicitacao})`)
            .join("\n");
          const resto = criadas.length > 15 ? `\n- ...e mais ${criadas.length - 15}` : "";

          await sendSolicitacaoNotification(
            `# 📋 Banco de Horas — Importação em Lote\n\n` +
              `- **Solicitações criadas:** ${criadas.length}\n` +
              `- **Solicitante:** ${req.user.name}\n\n` +
              `---\n\n${listaColaboradores}${resto}\n\n` +
              `[Ver todas as solicitações](${(process.env.FRONTEND_URL || "http://localhost:5173")}/solicitacoes-operacionais)`,
            { mentionEmails: emails }
          );
        }
      } catch (notifErr) {
        console.error("⚠️ Falha ao notificar importação em lote de banco de horas:", notifErr.message);
      }
    }

    return successResponse(
      res,
      { criadas: criadas.length, totalLinhas: rows.length, erros },
      `${criadas.length} solicitação(ões) criada(s), ${erros.length} erro(s)`
    );
  } catch (err) {
    console.error("❌ importarBancoHorasLote:", err);
    return errorResponse(res, "Erro ao importar solicitações de banco de horas", 500);
  }
};

/* =====================================================
   IMPORTAR INTERNALIZAÇÃO EM LOTE (CSV)
   Mesmo padrão de importarSinergiaLote: cada linha é validada e criada
   isoladamente — uma linha inválida não derruba as demais.
===================================================== */
exports.importarInternalizacaoLote = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, "Usuário não autenticado", 401);
    }
    if (!req.file) {
      return errorResponse(res, "Nenhum arquivo enviado", 400);
    }

    const csvString = req.file.buffer.toString("utf-8");
    const rows = await csv({ delimiter: "," }).fromString(csvString);

    if (!rows.length) {
      return errorResponse(res, "Arquivo CSV vazio", 400);
    }
    if (rows.length > 500) {
      return errorResponse(res, "Máximo de 500 linhas por importação", 400);
    }

    const criadas = [];
    const erros = [];

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 2; // +2: linha 1 é o cabeçalho
      const raw = normalizarLinhaCsv(rows[i]);
      const cpfOriginal = raw.cpf || "";

      try {
        const cpfDigits = String(cpfOriginal).replace(/\D/g, "");
        if (cpfDigits.length !== 11) {
          throw new HttpError(`CPF inválido: "${cpfOriginal}"`, 400);
        }

        const motivoLinha = String(raw.motivo || "").trim();
        if (!motivoLinha) {
          throw new HttpError("Motivo é obrigatório", 400);
        }

        const novaMatricula = String(raw["nova matrícula"] || raw["nova matricula"] || "").trim();
        if (!novaMatricula) {
          throw new HttpError("Nova matrícula é obrigatória", 400);
        }

        const novaEmpresaRaw = String(raw["nova empresa"] || "").trim();
        if (!novaEmpresaRaw) {
          throw new HttpError("Nova empresa é obrigatória", 400);
        }

        const confirmarRaw = String(raw["confirmar mesmo assim"] || raw["confirmar"] || "").trim().toUpperCase();
        const forcar = ["SIM", "S", "TRUE", "1"].includes(confirmarRaw);

        const colaborador = await prisma.colaborador.findFirst({
          where: { cpf: cpfDigits },
          select: { opsId: true, nomeCompleto: true, idEstacao: true, cpf: true },
        });
        if (!colaborador || !pertenceAEstacaoDoUsuario(req, colaborador.idEstacao)) {
          throw new HttpError(`Colaborador não encontrado para o CPF ${cpfOriginal}`, 400);
        }

        await validarColaboradorDisponivel(colaborador.opsId, ymd(startOfDayBR()));

        const novaEmpresa = await prisma.empresa.findFirst({
          where: {
            razaoSocial: { equals: novaEmpresaRaw, mode: "insensitive" },
            ativo: true,
            OR: [{ idEstacao: colaborador.idEstacao }, { idEstacao: null }],
          },
          select: { idEmpresa: true, razaoSocial: true },
        });
        if (!novaEmpresa) {
          throw new HttpError(`Empresa não encontrada ou não disponível: "${novaEmpresaRaw}"`, 400);
        }

        const matriculaEmUso = await prisma.colaborador.findUnique({
          where: { matricula: novaMatricula },
          select: { opsId: true },
        });
        if (matriculaEmUso) {
          throw new HttpError(`Matrícula "${novaMatricula}" já está em uso por outro colaborador`, 400);
        }

        const elegibilidade = await verificarElegibilidadeInternalizacao(colaborador.opsId);
        if (!elegibilidade.elegivel && !forcar) {
          throw new HttpError(
            `Colaborador não atende aos critérios de internalização: ${elegibilidade.motivos.join("; ")}. Marque "Confirmar Mesmo Assim" no CSV para continuar.`,
            400
          );
        }

        const solicitacao = await prisma.$transaction(async (tx) => {
          const nova = await tx.solicitacaoOperacional.create({
            data: {
              tipo: "INTERNALIZACAO",
              opsId: colaborador.opsId,
              data: startOfDayBR(),
              motivo: motivoLinha,
              internalizacaoNovaIdEmpresa: novaEmpresa.idEmpresa,
              internalizacaoNovaMatricula: novaMatricula,
              internalizacaoForcada: !elegibilidade.elegivel && forcar,
              solicitanteUserId: req.user.id,
            },
          });
          await tx.solicitacaoOperacionalHistorico.create({
            data: {
              idSolicitacao: nova.idSolicitacao,
              evento: `Solicitação criada por ${req.user.name} (importação em lote)`,
            },
          });
          return nova;
        });

        criadas.push({
          linha,
          idSolicitacao: solicitacao.idSolicitacao,
          colaboradorNome: colaborador.nomeCompleto,
          idEstacao: colaborador.idEstacao,
        });
      } catch (err) {
        const mensagem = err instanceof HttpError ? err.message : err.message || "Erro desconhecido";
        erros.push({ linha, cpf: cpfOriginal, motivo: mensagem });
      }
    }

    // Notificações resumidas do lote — best-effort, não bloqueia a resposta
    if (criadas.length > 0) {
      try {
        const idsEstacao = [...new Set(criadas.map((c) => c.idEstacao).filter((v) => v != null).flatMap(getEstacoesDoGrupo))];
        const aprovadoresAtivos = await prisma.aprovadorOperacional.findMany({
          where: {
            ativo: true,
            OR: [{ idEstacao: { in: idsEstacao } }, { idEstacao: null }],
          },
        });

        if (aprovadoresAtivos.length > 0) {
          const emails = [...new Set(aprovadoresAtivos.map((a) => a.email))];
          const listaColaboradores = criadas
            .slice(0, 15)
            .map((c) => `- ${c.colaboradorNome} (Nº ${c.idSolicitacao})`)
            .join("\n");
          const resto = criadas.length > 15 ? `\n- ...e mais ${criadas.length - 15}` : "";

          await sendSolicitacaoNotification(
            `# 📋 Internalização — Importação em Lote\n\n` +
              `- **Solicitações criadas:** ${criadas.length}\n` +
              `- **Solicitante:** ${req.user.name}\n\n` +
              `---\n\n${listaColaboradores}${resto}\n\n` +
              `[Ver todas as solicitações](${(process.env.FRONTEND_URL || "http://localhost:5173")}/solicitacoes-operacionais)`,
            { mentionEmails: emails }
          );
        }
      } catch (notifErr) {
        console.error("⚠️ Falha ao notificar importação em lote de internalização:", notifErr.message);
      }
    }

    return successResponse(
      res,
      { criadas: criadas.length, totalLinhas: rows.length, erros },
      `${criadas.length} solicitação(ões) criada(s), ${erros.length} erro(s)`
    );
  } catch (err) {
    console.error("❌ importarInternalizacaoLote:", err);
    return errorResponse(res, "Erro ao importar solicitações de internalização", 500);
  }
};

/* =====================================================
   LISTAR ESCALAS ATIVAS (formulário de Troca de Escala)
   Escopadas pela estação do colaborador informado, incluindo
   escalas globais (idEstacao null).
===================================================== */
exports.listarEscalasAtivas = async (req, res) => {
  try {
    const { opsId } = req.query;
    if (!opsId) {
      return errorResponse(res, "opsId é obrigatório", 400);
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      select: { idEstacao: true },
    });
    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const escalas = await prisma.escala.findMany({
      where: {
        ativo: true,
        OR: [{ idEstacao: colaborador.idEstacao }, { idEstacao: null }],
      },
      select: { idEscala: true, nomeEscala: true, descricao: true },
      orderBy: { nomeEscala: "asc" },
    });

    return successResponse(res, escalas);
  } catch (err) {
    console.error("❌ listarEscalasAtivas:", err);
    return errorResponse(res, "Erro ao listar escalas", 500);
  }
};

/* =====================================================
   LISTAR TURNOS ATIVOS (formulário de Troca de Turno)
   Escopados pela estação do colaborador informado, incluindo
   turnos globais (idEstacao null).
===================================================== */
exports.listarTurnosAtivos = async (req, res) => {
  try {
    const { opsId } = req.query;
    if (!opsId) {
      return errorResponse(res, "opsId é obrigatório", 400);
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      select: { idEstacao: true },
    });
    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const turnos = await prisma.turno.findMany({
      where: {
        ativo: true,
        OR: [{ idEstacao: colaborador.idEstacao }, { idEstacao: null }],
      },
      select: { idTurno: true, nomeTurno: true },
      orderBy: { nomeTurno: "asc" },
    });

    return successResponse(res, turnos);
  } catch (err) {
    console.error("❌ listarTurnosAtivos:", err);
    return errorResponse(res, "Erro ao listar turnos", 500);
  }
};

/* =====================================================
   LISTAR EMPRESAS PARA INTERNALIZAÇÃO (formulário)
   Só empresas SPX/diretas (fora da lista BPO), escopadas pela
   estação do colaborador.
===================================================== */
exports.listarEmpresasInternalizacao = async (req, res) => {
  try {
    const { opsId } = req.query;
    if (!opsId) {
      return errorResponse(res, "opsId é obrigatório", 400);
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      select: { idEstacao: true, idEmpresa: true },
    });
    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const empresas = await prisma.empresa.findMany({
      where: {
        ativo: true,
        OR: [{ idEstacao: colaborador.idEstacao }, { idEstacao: null }],
      },
      select: { idEmpresa: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    });

    const naoBpo = empresas.filter(
      (e) => !BPO_EMPRESAS.includes(String(e.razaoSocial).toUpperCase()) && e.idEmpresa !== colaborador.idEmpresa
    );

    return successResponse(res, naoBpo);
  } catch (err) {
    console.error("❌ listarEmpresasInternalizacao:", err);
    return errorResponse(res, "Erro ao listar empresas", 500);
  }
};

/* =====================================================
   VERIFICAR ELEGIBILIDADE PARA INTERNALIZAÇÃO
   Checagem prévia usada pelo formulário para avisar o usuário
   antes de enviar, quando o colaborador não atende aos critérios.
===================================================== */
exports.verificarElegibilidadeInternalizacaoHandler = async (req, res) => {
  try {
    const { opsId } = req.query;
    if (!opsId) {
      return errorResponse(res, "opsId é obrigatório", 400);
    }

    const resultado = await verificarElegibilidadeInternalizacao(opsId);
    return successResponse(res, resultado);
  } catch (err) {
    console.error("❌ verificarElegibilidadeInternalizacao:", err);
    return errorResponse(res, "Erro ao verificar elegibilidade", 500);
  }
};

/* =====================================================
   BUSCAR COLABORADOR POR CPF (autofill dos formulários)
===================================================== */
exports.buscarColaboradorPorCpf = async (req, res) => {
  try {
    const cpf = String(req.query.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) {
      return errorResponse(res, "CPF inválido", 400);
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf },
      select: {
        opsId: true,
        nomeCompleto: true,
        matricula: true,
        cpf: true,
        status: true,
        idEstacao: true,
        idEscala: true,
        cargo: { select: { nomeCargo: true } },
        setor: { select: { nomeSetor: true } },
        turno: { select: { nomeTurno: true } },
        empresa: { select: { razaoSocial: true } },
        escala: { select: { nomeEscala: true } },
        lider: { select: { nomeCompleto: true } },
      },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    if (!pertenceAEstacaoDoUsuario(req, colaborador.idEstacao)) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    return successResponse(res, {
      opsId: colaborador.opsId,
      nomeCompleto: colaborador.nomeCompleto,
      matricula: colaborador.matricula,
      cpf: colaborador.cpf,
      status: colaborador.status,
      cargo: colaborador.cargo?.nomeCargo || null,
      setor: colaborador.setor?.nomeSetor || null,
      turno: colaborador.turno?.nomeTurno || null,
      empresa: colaborador.empresa?.razaoSocial || null,
      lider: colaborador.lider?.nomeCompleto || null,
      idEscala: colaborador.idEscala,
      nomeEscala: colaborador.escala?.nomeEscala || null,
    });
  } catch (err) {
    console.error("❌ buscarColaboradorPorCpf:", err);
    return errorResponse(res, "Erro ao buscar colaborador", 500);
  }
};

/* =====================================================
   LISTAR SOLICITAÇÕES
===================================================== */
exports.listSolicitacoes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      tipo,
      dataInicio,
      dataFim,
      solicitante,
      colaborador,
      turno,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = { ...estacaoWhereSolicitacao(req) };
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    if (turno) where.colaborador = { ...where.colaborador, turno: { nomeTurno: turno } };
    if (solicitante) where.solicitante = { name: { contains: solicitante, mode: "insensitive" } };
    if (colaborador) {
      where.OR = [
        { colaborador: { nomeCompleto: { contains: colaborador, mode: "insensitive" } } },
        { colaborador2: { nomeCompleto: { contains: colaborador, mode: "insensitive" } } },
      ];
    }
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(`${dataInicio}T00:00:00.000Z`);
      if (dataFim) where.data.lte = new Date(`${dataFim}T23:59:59.999Z`);
    }

    const [solicitacoes, total] = await Promise.all([
      prisma.solicitacaoOperacional.findMany({
        where,
        orderBy: { data: "desc" },
        skip,
        take: limitNum,
        include: {
          colaborador: {
            select: {
              nomeCompleto: true,
              cpf: true,
              setor: { select: { nomeSetor: true } },
              turno: { select: { nomeTurno: true } },
            },
          },
          colaborador2: { select: { nomeCompleto: true } },
          solicitante: { select: { name: true } },
          decididoPor: { select: { name: true } },
        },
      }),
      prisma.solicitacaoOperacional.count({ where }),
    ]);

    return paginatedResponse(res, solicitacoes, { page: pageNum, limit: limitNum, total });
  } catch (err) {
    console.error("❌ listSolicitacoes (operacional):", err);
    return errorResponse(res, "Erro ao listar solicitações", 500);
  }
};

/* =====================================================
   ESTATÍSTICAS (CARDS DO DASHBOARD)
===================================================== */
exports.statsSolicitacoes = async (req, res) => {
  try {
    const estacaoWhere = estacaoWhereSolicitacao(req);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0, 23, 59, 59);

    const [pendentes, aprovadas, reprovadas, doMes] = await Promise.all([
      prisma.solicitacaoOperacional.count({ where: { ...estacaoWhere, status: { in: ["PENDENTE", "AGUARDANDO_SEGUNDA_APROVACAO"] } } }),
      prisma.solicitacaoOperacional.count({ where: { ...estacaoWhere, status: "APROVADA" } }),
      prisma.solicitacaoOperacional.count({ where: { ...estacaoWhere, status: "REPROVADA" } }),
      prisma.solicitacaoOperacional.count({
        where: { ...estacaoWhere, dataCriacao: { gte: inicioMes, lte: fimMes } },
      }),
    ]);

    return successResponse(res, { pendentes, aprovadas, reprovadas, doMes });
  } catch (err) {
    console.error("❌ statsSolicitacoes (operacional):", err);
    return errorResponse(res, "Erro ao buscar estatísticas", 500);
  }
};

/* =====================================================
   BUSCAR SOLICITAÇÃO POR ID
===================================================== */
exports.getSolicitacao = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitacao = await prisma.solicitacaoOperacional.findUnique({
      where: { idSolicitacao: Number(id) },
      include: {
        colaborador: {
          select: {
            nomeCompleto: true,
            cpf: true,
            matricula: true,
            idEstacao: true,
            cargo: { select: { nomeCargo: true } },
            setor: { select: { nomeSetor: true } },
            turno: { select: { nomeTurno: true } },
            lider: { select: { nomeCompleto: true } },
          },
        },
        colaborador2: {
          select: {
            nomeCompleto: true,
            cpf: true,
            matricula: true,
            cargo: { select: { nomeCargo: true } },
            setor: { select: { nomeSetor: true } },
            turno: { select: { nomeTurno: true } },
            lider: { select: { nomeCompleto: true } },
          },
        },
        novoLider: { select: { nomeCompleto: true, cargo: { select: { nomeCargo: true } } } },
        novaEscala: { select: { nomeEscala: true, descricao: true } },
        novoTurno: { select: { nomeTurno: true } },
        internalizacaoNovaEmpresa: { select: { razaoSocial: true } },
        solicitante: { select: { name: true, email: true, opsId: true } },
        decididoPor: { select: { name: true, email: true } },
        primeiraAprovacaoPor: { select: { name: true, email: true } },
        historico: { orderBy: { criadoEm: "asc" } },
      },
    });

    if (!solicitacao || !pertenceAEstacaoDoUsuario(req, solicitacao.colaborador?.idEstacao)) {
      return notFoundResponse(res, "Solicitação não encontrada");
    }

    const segundaAprovacaoTipo = SEGUNDA_APROVACAO_POR_TIPO[solicitacao.tipo] || null;

    let podeDecidir = false;
    let etapaAtual = null;
    if (solicitacao.status === "PENDENTE") {
      etapaAtual = "PRIMEIRA";
      podeDecidir = await isAprovadorAtivo(req.user.email, solicitacao.colaborador?.idEstacao);
    } else if (solicitacao.status === "AGUARDANDO_SEGUNDA_APROVACAO") {
      etapaAtual = "SEGUNDA";
      podeDecidir = await isSegundoAprovadorAtivo(req.user.email, segundaAprovacaoTipo, solicitacao.colaborador?.idEstacao);
    }

    return successResponse(res, {
      ...solicitacao,
      podeDecidir,
      etapaAtual,
      segundaAprovacaoTipo,
      segundaAprovacaoLabel: segundaAprovacaoTipo ? SEGUNDO_APROVADOR_LABEL[segundaAprovacaoTipo] : null,
    });
  } catch (err) {
    console.error("❌ getSolicitacao (operacional):", err);
    return errorResponse(res, "Erro ao buscar solicitação", 500);
  }
};

/* =====================================================
   CALENDÁRIO — fonte única de dados (colorido por status)
===================================================== */
exports.listarCalendario = async (req, res) => {
  try {
    const { inicio, fim, tipo, turno, status } = req.query;

    if (!inicio || !fim) {
      return errorResponse(res, "Parâmetros inicio e fim são obrigatórios", 400);
    }

    const where = {
      data: {
        gte: new Date(`${inicio}T00:00:00.000Z`),
        lte: new Date(`${fim}T23:59:59.999Z`),
      },
      ...estacaoWhereSolicitacao(req),
    };

    if (tipo) {
      const tipos = String(tipo).split(",").map((t) => t.trim()).filter(Boolean);
      if (tipos.length) where.tipo = { in: tipos };
    }

    if (turno) where.colaborador = { ...where.colaborador, turno: { nomeTurno: turno } };

    if (status) {
      const statusList = String(status).split(",").map((s) => s.trim()).filter(Boolean);
      if (statusList.length) where.status = { in: statusList };
    }

    const solicitacoes = await prisma.solicitacaoOperacional.findMany({
      where,
      select: {
        idSolicitacao: true,
        tipo: true,
        status: true,
        data: true,
        motivo: true,
        sinergiaDestino: true,
        bhDiaCompleto: true,
        heHoraEntrada: true,
        heHoraSaida: true,
        dataDesligamentoSolicitada: true,
        motivoDesligamentoSolicitado: true,
        tipoDesligamentoSolicitado: true,
        feriasDataInicio: true,
        feriasDataFim: true,
        afastamentoDataInicio: true,
        afastamentoDataFim: true,
        internalizacaoNovaMatricula: true,
        internalizacaoForcada: true,
        colaborador: { select: { nomeCompleto: true, cpf: true, setor: { select: { nomeSetor: true } }, turno: { select: { nomeTurno: true } } } },
        colaborador2: { select: { nomeCompleto: true } },
        novoLider: { select: { nomeCompleto: true } },
        novaEscala: { select: { nomeEscala: true } },
        novoTurno: { select: { nomeTurno: true } },
        internalizacaoNovaEmpresa: { select: { razaoSocial: true } },
        decididoPor: { select: { name: true } },
      },
      orderBy: { data: "asc" },
    });

    return successResponse(res, solicitacoes);
  } catch (err) {
    console.error("❌ listarCalendario (operacional):", err);
    return errorResponse(res, "Erro ao buscar calendário", 500);
  }
};

/* =====================================================
   CRIAR SOLICITAÇÃO
===================================================== */
exports.createSolicitacao = async (req, res) => {
  try {
    const { tipo, opsId, motivo } = req.body;

    if (!tipo || !opsId || !motivo?.trim()) {
      return errorResponse(res, "Campos obrigatórios não informados", 400);
    }
    if (!req.user?.id) {
      return errorResponse(res, "Usuário não autenticado", 401);
    }

    const dadosBase = {
      tipo,
      motivo: motivo.trim(),
      solicitanteUserId: req.user.id,
    };

    if (tipo === "FOLGA") {
      const { data } = req.body;
      if (!data) return errorResponse(res, "Data da folga é obrigatória", 400);

      await validarColaboradorDisponivel(opsId, data);

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(data);
    } else if (tipo === "BANCO_HORAS") {
      const { data, bhDiaCompleto, bhQuantidadeHoras, bhHoraEntrada } = req.body;
      if (!data) return errorResponse(res, "Data é obrigatória", 400);
      if (!bhDiaCompleto && (!bhQuantidadeHoras || !bhHoraEntrada)) {
        return errorResponse(
          res,
          "Informe a quantidade de horas e a hora de entrada, ou marque dia completo",
          400
        );
      }

      await validarColaboradorDisponivel(opsId, data);

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(data);
      dadosBase.bhDiaCompleto = !!bhDiaCompleto;
      dadosBase.bhQuantidadeHoras = bhDiaCompleto ? null : Number(bhQuantidadeHoras);
      dadosBase.bhHoraEntrada = bhDiaCompleto ? null : bhHoraEntrada;
    } else if (tipo === "SINERGIA") {
      const { data, sinergiaDestino } = req.body;
      if (!data || !sinergiaDestino) {
        return errorResponse(res, "Data e destino da sinergia são obrigatórios", 400);
      }
      if (!DESTINOS_SINERGIA_VALIDOS.includes(sinergiaDestino)) {
        return errorResponse(res, "Destino de sinergia inválido", 400);
      }

      await validarColaboradorDisponivel(opsId, data);

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(data);
      dadosBase.sinergiaDestino = sinergiaDestino;
    } else if (tipo === "TROCA_DSR") {
      const { opsId2, dsrDataAtual1, dsrDataNova1, dsrDataAtual2, dsrDataNova2 } = req.body;

      if (!opsId2 || !dsrDataAtual1 || !dsrDataNova1 || !dsrDataAtual2 || !dsrDataNova2) {
        return errorResponse(res, "Preencha os dados dos dois colaboradores e as 4 datas", 400);
      }
      if (opsId === opsId2) {
        return errorResponse(res, "Os dois colaboradores devem ser diferentes", 400);
      }
      if (dsrDataAtual1 !== dsrDataNova2 || dsrDataAtual2 !== dsrDataNova1) {
        return errorResponse(
          res,
          "A troca precisa ser uma inversão exata: o DSR atual de um deve virar o novo DSR do outro",
          400
        );
      }

      const colaborador1 = await validarColaboradorDisponivel(opsId, dsrDataNova1);
      const colaborador2 = await validarColaboradorDisponivel(opsId2, dsrDataNova2);

      const dsr1 = await isDiaDSRReal(opsId, normalizeDateOnly(dsrDataAtual1), colaborador1.escala?.nomeEscala);
      if (!dsr1) {
        return errorResponse(res, `${dsrDataAtual1} não é dia de DSR para ${colaborador1.nomeCompleto}`, 400);
      }
      const dsr2 = await isDiaDSRReal(opsId2, normalizeDateOnly(dsrDataAtual2), colaborador2.escala?.nomeEscala);
      if (!dsr2) {
        return errorResponse(res, `${dsrDataAtual2} não é dia de DSR para ${colaborador2.nomeCompleto}`, 400);
      }

      dadosBase.opsId = opsId;
      dadosBase.opsId2 = opsId2;
      dadosBase.data = normalizeDateOnly(dsrDataNova1);
      dadosBase.dsrDataAtual1 = normalizeDateOnly(dsrDataAtual1);
      dadosBase.dsrDataNova1 = normalizeDateOnly(dsrDataNova1);
      dadosBase.dsrDataAtual2 = normalizeDateOnly(dsrDataAtual2);
      dadosBase.dsrDataNova2 = normalizeDateOnly(dsrDataNova2);
    } else if (tipo === "HORA_EXTRA") {
      const { data, heHoraEntrada, heHoraSaida } = req.body;
      if (!data || !heHoraEntrada || !heHoraSaida) {
        return errorResponse(res, "Data, hora de entrada e hora de saída são obrigatórias", 400);
      }
      {
        const [hE, mE] = heHoraEntrada.split(":").map(Number);
        const [hS, mS] = heHoraSaida.split(":").map(Number);
        let minutosJornada = hS * 60 + mS - (hE * 60 + mE);
        if (minutosJornada <= 0) minutosJornada += 24 * 60;
        if (minutosJornada > 16 * 60) {
          return errorResponse(res, "Jornada inválida. Verifique os horários informados (máximo de 16h)", 400);
        }
      }

      const colaborador = await validarColaboradorDisponivel(opsId, data);

      const ehDiaDeDSR = await isDiaDSRReal(opsId, normalizeDateOnly(data), colaborador.escala?.nomeEscala);
      if (!ehDiaDeDSR) {
        return errorResponse(res, `${data} não é dia de DSR para ${colaborador.nomeCompleto}. Hora extra só pode ser solicitada em dia de DSR.`, 400);
      }

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(data);
      dadosBase.heHoraEntrada = heHoraEntrada;
      dadosBase.heHoraSaida = heHoraSaida;
    } else if (tipo === "TROCA_GESTAO") {
      const { novoLiderOpsId } = req.body;
      if (!novoLiderOpsId) {
        return errorResponse(res, "Selecione o novo líder", 400);
      }
      if (novoLiderOpsId === opsId) {
        return errorResponse(res, "O colaborador não pode ser líder de si mesmo", 400);
      }

      const colaborador = await validarColaboradorDisponivel(opsId, ymd(startOfDayBR()));

      const novoLider = await prisma.colaborador.findUnique({
        where: { opsId: novoLiderOpsId },
        select: { opsId: true, nomeCompleto: true, status: true, idEstacao: true },
      });
      if (!novoLider) {
        return errorResponse(res, "Novo líder não encontrado", 400);
      }
      if (novoLider.status !== "ATIVO") {
        return errorResponse(res, `${novoLider.nomeCompleto} não está ativo`, 400);
      }
      if (novoLider.idEstacao !== colaborador.idEstacao) {
        return errorResponse(res, `${novoLider.nomeCompleto} não pertence à mesma estação do colaborador`, 400);
      }

      dadosBase.opsId = opsId;
      dadosBase.data = startOfDayBR();
      dadosBase.novoLiderOpsId = novoLiderOpsId;
    } else if (tipo === "TROCA_ESCALA") {
      const { novaIdEscala } = req.body;
      if (!novaIdEscala) {
        return errorResponse(res, "Selecione a nova escala", 400);
      }

      const colaborador = await validarColaboradorDisponivel(opsId, ymd(startOfDayBR()));

      if (Number(novaIdEscala) === Number(colaborador.idEscala)) {
        return errorResponse(res, `${colaborador.nomeCompleto} já está nessa escala`, 400);
      }

      const novaEscala = await prisma.escala.findUnique({
        where: { idEscala: Number(novaIdEscala) },
        select: { idEscala: true, nomeEscala: true, ativo: true, idEstacao: true },
      });
      if (!novaEscala) {
        return errorResponse(res, "Escala não encontrada", 400);
      }
      if (!novaEscala.ativo) {
        return errorResponse(res, `Escala ${novaEscala.nomeEscala} não está ativa`, 400);
      }
      if (novaEscala.idEstacao !== null && novaEscala.idEstacao !== colaborador.idEstacao) {
        return errorResponse(res, `Escala ${novaEscala.nomeEscala} não está disponível para a estação do colaborador`, 400);
      }

      dadosBase.opsId = opsId;
      dadosBase.data = startOfDayBR();
      dadosBase.novaIdEscala = Number(novaIdEscala);
    } else if (tipo === "DESLIGAMENTO") {
      const { dataDesligamentoSolicitada, motivoDesligamentoSolicitado, tipoDesligamentoSolicitado } = req.body;
      if (!dataDesligamentoSolicitada || !motivoDesligamentoSolicitado || !tipoDesligamentoSolicitado) {
        return errorResponse(res, "Data, motivo e tipo de desligamento são obrigatórios", 400);
      }
      if (!TIPOS_DESLIGAMENTO_VALIDOS.includes(tipoDesligamentoSolicitado)) {
        return errorResponse(res, "Tipo de desligamento inválido", 400);
      }
      if (!MOTIVOS_DESLIGAMENTO_VALIDOS.includes(motivoDesligamentoSolicitado)) {
        return errorResponse(res, "Motivo de desligamento inválido", 400);
      }

      await validarColaboradorDisponivel(opsId, dataDesligamentoSolicitada);

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(dataDesligamentoSolicitada);
      dadosBase.dataDesligamentoSolicitada = normalizeDateOnly(dataDesligamentoSolicitada);
      dadosBase.motivoDesligamentoSolicitado = motivoDesligamentoSolicitado;
      dadosBase.tipoDesligamentoSolicitado = tipoDesligamentoSolicitado;
    } else if (tipo === "TROCA_TURNO") {
      const { novoIdTurno } = req.body;
      if (!novoIdTurno) {
        return errorResponse(res, "Selecione o novo turno", 400);
      }

      const colaborador = await validarColaboradorDisponivel(opsId, ymd(startOfDayBR()));

      const colabAtual = await prisma.colaborador.findUnique({
        where: { opsId },
        select: { idTurno: true },
      });
      if (Number(novoIdTurno) === Number(colabAtual?.idTurno)) {
        return errorResponse(res, `${colaborador.nomeCompleto} já está nesse turno`, 400);
      }

      const novoTurno = await prisma.turno.findUnique({
        where: { idTurno: Number(novoIdTurno) },
        select: { idTurno: true, nomeTurno: true, ativo: true, idEstacao: true },
      });
      if (!novoTurno) {
        return errorResponse(res, "Turno não encontrado", 400);
      }
      if (!novoTurno.ativo) {
        return errorResponse(res, `Turno ${novoTurno.nomeTurno} não está ativo`, 400);
      }
      if (novoTurno.idEstacao !== null && novoTurno.idEstacao !== colaborador.idEstacao) {
        return errorResponse(res, `Turno ${novoTurno.nomeTurno} não está disponível para a estação do colaborador`, 400);
      }

      dadosBase.opsId = opsId;
      dadosBase.data = startOfDayBR();
      dadosBase.novoIdTurno = Number(novoIdTurno);
    } else if (tipo === "FERIAS" || tipo === "AFASTAMENTO") {
      const { dataInicio, dataFim } = req.body;
      if (!dataInicio || !dataFim) {
        return errorResponse(res, "Data de início e fim são obrigatórias", 400);
      }
      if (normalizeDateOnly(dataFim) < normalizeDateOnly(dataInicio)) {
        return errorResponse(res, "A data de fim não pode ser anterior à data de início", 400);
      }

      await validarColaboradorDisponivel(opsId, dataInicio);

      dadosBase.opsId = opsId;
      dadosBase.data = normalizeDateOnly(dataInicio);
      if (tipo === "FERIAS") {
        dadosBase.feriasDataInicio = normalizeDateOnly(dataInicio);
        dadosBase.feriasDataFim = normalizeDateOnly(dataFim);
      } else {
        dadosBase.afastamentoDataInicio = normalizeDateOnly(dataInicio);
        dadosBase.afastamentoDataFim = normalizeDateOnly(dataFim);
      }
    } else if (tipo === "INTERNALIZACAO") {
      const { internalizacaoNovaIdEmpresa, internalizacaoNovaMatricula, internalizacaoForcada } = req.body;
      if (!internalizacaoNovaIdEmpresa || !internalizacaoNovaMatricula?.trim()) {
        return errorResponse(res, "Selecione a nova empresa e informe a nova matrícula", 400);
      }

      const colaborador = await validarColaboradorDisponivel(opsId, ymd(startOfDayBR()));

      const novaEmpresa = await prisma.empresa.findUnique({
        where: { idEmpresa: Number(internalizacaoNovaIdEmpresa) },
        select: { idEmpresa: true, razaoSocial: true, ativo: true, idEstacao: true },
      });
      if (!novaEmpresa) {
        return errorResponse(res, "Empresa não encontrada", 400);
      }
      if (!novaEmpresa.ativo) {
        return errorResponse(res, `Empresa ${novaEmpresa.razaoSocial} não está ativa`, 400);
      }
      if (novaEmpresa.idEstacao !== null && novaEmpresa.idEstacao !== colaborador.idEstacao) {
        return errorResponse(res, `Empresa ${novaEmpresa.razaoSocial} não está disponível para a estação do colaborador`, 400);
      }

      const matriculaEmUso = await prisma.colaborador.findUnique({
        where: { matricula: internalizacaoNovaMatricula.trim() },
        select: { opsId: true },
      });
      if (matriculaEmUso) {
        return errorResponse(res, "Essa matrícula já está em uso por outro colaborador", 400);
      }

      // Nunca confia só na checagem do frontend — se o colaborador não é
      // elegível, exige que o front tenha marcado a confirmação explícita.
      const elegibilidade = await verificarElegibilidadeInternalizacao(opsId);
      if (!elegibilidade.elegivel && !internalizacaoForcada) {
        return errorResponse(
          res,
          `Colaborador não atende aos critérios de internalização: ${elegibilidade.motivos.join("; ")}. Confirme explicitamente para continuar mesmo assim.`,
          400
        );
      }

      dadosBase.opsId = opsId;
      dadosBase.data = startOfDayBR();
      dadosBase.internalizacaoNovaIdEmpresa = Number(internalizacaoNovaIdEmpresa);
      dadosBase.internalizacaoNovaMatricula = internalizacaoNovaMatricula.trim();
      dadosBase.internalizacaoForcada = !elegibilidade.elegivel && !!internalizacaoForcada;
    } else {
      return errorResponse(res, "Tipo de solicitação inválido", 400);
    }

    const solicitacao = await prisma.$transaction(async (tx) => {
      const nova = await tx.solicitacaoOperacional.create({ data: dadosBase });

      await tx.solicitacaoOperacionalHistorico.create({
        data: { idSolicitacao: nova.idSolicitacao, evento: `Solicitação criada por ${req.user.name}` },
      });

      return nova;
    });

    // Busca colaborador + aprovadores uma vez só, reaproveitado pelo e-mail e pelo SeaTalk
    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
      select: {
        nomeCompleto: true,
        cpf: true,
        idEstacao: true,
        cargo: { select: { nomeCargo: true } },
        setor: { select: { nomeSetor: true } },
        turno: { select: { nomeTurno: true } },
        lider: { select: { nomeCompleto: true } },
      },
    });

    const aprovadoresAtivos = await prisma.aprovadorOperacional.findMany({
      where: {
        ativo: true,
        OR: [{ idEstacao: { in: getEstacoesDoGrupo(colaborador?.idEstacao) } }, { idEstacao: null }],
      },
    });

    // Notificação por e-mail — não bloqueia a criação em caso de falha
    try {
      const emailsAprovadores = emailsParaNotificar(aprovadoresAtivos);
      if (emailsAprovadores.length > 0) {
        await sendSolicitacaoOperacionalEmail({
          to: emailsAprovadores,
          solicitacao: {
            idSolicitacao: solicitacao.idSolicitacao,
            tipo,
            colaboradorNome: colaborador?.nomeCompleto,
            cpf: colaborador?.cpf,
            cargo: colaborador?.cargo?.nomeCargo,
            setor: colaborador?.setor?.nomeSetor,
            turno: colaborador?.turno?.nomeTurno,
            lider: colaborador?.lider?.nomeCompleto,
            dataCriacao: solicitacao.dataCriacao,
            data: solicitacao.data,
            motivo: solicitacao.motivo,
          },
        });

        await prisma.solicitacaoOperacionalHistorico.create({
          data: { idSolicitacao: solicitacao.idSolicitacao, evento: "E-mails enviados aos aprovadores" },
        });
      }
    } catch (emailErr) {
      console.error("⚠️ Falha ao enviar email de solicitação operacional:", emailErr.message);
    }

    try {
      await sendSolicitacaoNotification(
        `# 📋 Nova Solicitação Operacional\n\n` +
          `- **Tipo:** ${TIPO_LABEL_SEATALK[tipo] || tipo}\n` +
          `- **Colaborador:** ${colaborador?.nomeCompleto || "N/A"}\n` +
          `- **CPF:** \`${colaborador?.cpf || "N/A"}\`\n` +
          `- **Setor:** ${colaborador?.setor?.nomeSetor || "N/A"}\n` +
          `- **Data:** ${formatDataBR(solicitacao.data)}\n` +
          `- **Solicitante:** ${req.user.name}\n\n` +
          `---\n\n` +
          `[Ver solicitação completa](${linkSolicitacaoOperacional(solicitacao.idSolicitacao)})`,
        { mentionEmails: aprovadoresAtivos.map((a) => a.email) }
      );
    } catch (seatalkErr) {
      console.error("⚠️ Falha ao enviar notificação SeaTalk de solicitação operacional:", seatalkErr.message);
    }

    return createdResponse(res, solicitacao, "Solicitação criada com sucesso");
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(res, err.message, err.statusCode);
    }
    console.error("❌ createSolicitacao (operacional):", err);
    return errorResponse(res, "Erro ao criar solicitação", 500);
  }
};

/* =====================================================
   APLICAR NO CONTROLE DE PRESENÇA (dentro da transação de aprovação)
===================================================== */
async function aplicarNaFrequencia(tx, solicitacao, registradoPor) {
  const tipos = await tx.tipoAusencia.findMany({
    where: { codigo: { in: ["FO", "BH", "S1", "DSR", "P"] } },
    select: { idTipoAusencia: true, codigo: true },
  });
  const idPorCodigo = Object.fromEntries(tipos.map((t) => [t.codigo, t.idTipoAusencia]));

  async function upsertFrequencia(opsId, dataReferencia, idTipoAusencia, extra = {}) {
    await tx.frequencia.upsert({
      where: { opsId_dataReferencia: { opsId, dataReferencia } },
      update: { idTipoAusencia, manual: true, justificativa: "SOLICITACAO_OPERACIONAL", registradoPor, ...extra },
      create: { opsId, dataReferencia, idTipoAusencia, manual: true, justificativa: "SOLICITACAO_OPERACIONAL", registradoPor, ...extra },
    });
  }

  // Dia inteiro fora da operação (Folga/BH completo/Sinergia): zera qualquer
  // batida de ponto residual do dia — senão o Dashboard Operacional prioriza
  // horaEntrada sobre o tipoAusencia e mostra "Presente" em vez do status real.
  const SEM_BATIDA = { horaEntrada: null, horaSaida: null, horasTrabalhadas: null };

  if (solicitacao.tipo === "FOLGA") {
    await upsertFrequencia(solicitacao.opsId, solicitacao.data, idPorCodigo.FO, SEM_BATIDA);
  } else if (solicitacao.tipo === "BANCO_HORAS") {
    if (solicitacao.bhDiaCompleto) {
      await upsertFrequencia(solicitacao.opsId, solicitacao.data, idPorCodigo.BH, SEM_BATIDA);
    } else {
      // Horas parciais: colaborador continua presente, só registra a hora de entrada
      const horaEntrada = solicitacao.bhHoraEntrada
        ? new Date(`1970-01-01T${solicitacao.bhHoraEntrada}:00Z`)
        : null;
      await upsertFrequencia(solicitacao.opsId, solicitacao.data, null, { horaEntrada });
    }
  } else if (solicitacao.tipo === "SINERGIA") {
    await upsertFrequencia(solicitacao.opsId, solicitacao.data, idPorCodigo.S1, SEM_BATIDA);
  } else if (solicitacao.tipo === "TROCA_DSR") {
    // Colaborador 1: nova data vira DSR; data atual deixa de ser DSR
    await upsertFrequencia(solicitacao.opsId, solicitacao.dsrDataNova1, idPorCodigo.DSR);
    await upsertFrequencia(solicitacao.opsId, solicitacao.dsrDataAtual1, null);
    // Colaborador 2: espelho
    await upsertFrequencia(solicitacao.opsId2, solicitacao.dsrDataNova2, idPorCodigo.DSR);
    await upsertFrequencia(solicitacao.opsId2, solicitacao.dsrDataAtual2, null);
  } else if (solicitacao.tipo === "HORA_EXTRA") {
    // Dia era DSR e o colaborador trabalhou: sai de DSR, vira presença com horário registrado
    const [hE, mE] = solicitacao.heHoraEntrada.split(":").map(Number);
    const [hS, mS] = solicitacao.heHoraSaida.split(":").map(Number);
    const horaEntrada = new Date(`1970-01-01T${solicitacao.heHoraEntrada}:00Z`);
    const horaSaida = new Date(`1970-01-01T${solicitacao.heHoraSaida}:00Z`);
    let minutosTrabalhados = hS * 60 + mS - (hE * 60 + mE);
    if (minutosTrabalhados <= 0) minutosTrabalhados += 24 * 60;
    const horasTrabalhadas = Number((minutosTrabalhados / 60).toFixed(2));

    await upsertFrequencia(solicitacao.opsId, solicitacao.data, idPorCodigo.P, {
      horaEntrada,
      horaSaida,
      horasTrabalhadas,
      justificativa: "HORA_EXTRA_DSR",
    });
  }
}

/* =====================================================
   APLICAR MUDANÇA CADASTRAL (Troca de Gestão, Troca de Escala,
   Desligamento) — altera o próprio registro do colaborador.
   Retorna dados necessários para regenerar DSR fora da transação
   (troca de escala), quando aplicável.
===================================================== */
async function aplicarMudancaCadastral(tx, solicitacao, registradoPor) {
  if (solicitacao.tipo === "TROCA_GESTAO") {
    await tx.colaborador.update({
      where: { opsId: solicitacao.opsId },
      data: { lider: { connect: { opsId: solicitacao.novoLiderOpsId } } },
    });
    return null;
  }

  if (solicitacao.tipo === "TROCA_ESCALA") {
    const hoje = startOfDayBR();

    const atual = await tx.colaborador.findUnique({
      where: { opsId: solicitacao.opsId },
      select: { idEstacao: true },
    });

    // Fecha o histórico de escala aberto e abre um novo a partir de hoje
    await tx.colaboradorEscalaHistorico.updateMany({
      where: { opsId: solicitacao.opsId, dataFim: null },
      data: { dataFim: new Date(hoje.getTime() - 86400000) },
    });

    const historicoHoje = await tx.colaboradorEscalaHistorico.findFirst({
      where: { opsId: solicitacao.opsId, dataInicio: hoje },
    });
    if (historicoHoje) {
      await tx.colaboradorEscalaHistorico.update({
        where: { id: historicoHoje.id },
        data: { idEscala: solicitacao.novaIdEscala, dataFim: null },
      });
    } else {
      await tx.colaboradorEscalaHistorico.create({
        data: { opsId: solicitacao.opsId, idEscala: solicitacao.novaIdEscala, dataInicio: hoje },
      });
    }

    // Remove DSR futuro gerado automaticamente pela escala antiga
    const tipoDSR = await tx.tipoAusencia.findFirst({ where: { codigo: "DSR" }, select: { idTipoAusencia: true } });
    if (tipoDSR) {
      await tx.frequencia.deleteMany({
        where: { opsId: solicitacao.opsId, dataReferencia: { gte: hoje }, idTipoAusencia: tipoDSR.idTipoAusencia, manual: false },
      });
    }

    await tx.colaborador.update({
      where: { opsId: solicitacao.opsId },
      data: { escala: { connect: { idEscala: solicitacao.novaIdEscala } } },
    });

    const novaEscala = await tx.escala.findUnique({ where: { idEscala: solicitacao.novaIdEscala }, select: { nomeEscala: true } });
    return { nomeEscalaParaDSR: novaEscala?.nomeEscala ?? null, idEstacao: atual?.idEstacao ?? null };
  }

  if (solicitacao.tipo === "DESLIGAMENTO") {
    const atual = await tx.colaborador.findUnique({
      where: { opsId: solicitacao.opsId },
      select: { idEmpresa: true, idEstacao: true },
    });

    // A data prevista pode ser futura (ex: aviso prévio). Só efetiva o
    // desligamento (inativar + travar o ponto) quando essa data já chegou —
    // senão o colaborador ficaria impedido de bater ponto antes da hora.
    // Se ainda é futura, o registro em `desligamento` (criado abaixo, como
    // sempre) fica pendente e o job `efetivarDesligamentosAgendados` aplica
    // o INATIVO automaticamente no dia certo.
    const hoje = startOfDayBR();
    const dataEfetiva = startOfDayBR(solicitacao.dataDesligamentoSolicitada);
    const dataJaChegou = dataEfetiva <= hoje;

    if (dataJaChegou) {
      await tx.colaborador.update({
        where: { opsId: solicitacao.opsId },
        data: {
          status: "INATIVO",
          dataDesligamento: solicitacao.dataDesligamentoSolicitada,
          motivoDesligamento: solicitacao.motivoDesligamentoSolicitado,
          tipoDesligamento: solicitacao.tipoDesligamentoSolicitado,
        },
      });
    }

    const jaExiste = await tx.desligamento.findFirst({
      where: { opsId: solicitacao.opsId, dataDesligamento: solicitacao.dataDesligamentoSolicitada },
    });
    if (!jaExiste) {
      await tx.desligamento.create({
        data: {
          opsId: solicitacao.opsId,
          idEmpresa: atual?.idEmpresa ?? null,
          idEstacao: atual?.idEstacao ?? null,
          dataDesligamento: solicitacao.dataDesligamentoSolicitada,
          tipo: solicitacao.tipoDesligamentoSolicitado,
          motivo: solicitacao.motivoDesligamentoSolicitado,
          observacao: "Gerado via Solicitação Operacional",
          registradoPor,
          // null = ainda pendente, o job diário de efetivação aplica na data certa
          efetivadoEm: dataJaChegou ? new Date() : null,
        },
      });
    }

    return null;
  }

  if (solicitacao.tipo === "TROCA_TURNO") {
    await tx.colaborador.update({
      where: { opsId: solicitacao.opsId },
      data: { turno: { connect: { idTurno: solicitacao.novoIdTurno } } },
    });
    return null;
  }

  if (solicitacao.tipo === "FERIAS") {
    await tx.colaborador.update({
      where: { opsId: solicitacao.opsId },
      data: {
        status: "FERIAS",
        dataInicioStatus: solicitacao.feriasDataInicio,
        dataFimStatus: solicitacao.feriasDataFim,
      },
    });

    const tipoFerias = await tx.tipoAusencia.findFirst({ where: { codigo: "FE" }, select: { idTipoAusencia: true } });
    if (tipoFerias) {
      const jaExiste = await tx.ausencia.findFirst({
        where: { opsId: solicitacao.opsId, idTipoAusencia: tipoFerias.idTipoAusencia, dataInicio: solicitacao.feriasDataInicio },
      });
      if (!jaExiste) {
        const diasCorridos = Math.round((solicitacao.feriasDataFim - solicitacao.feriasDataInicio) / 86400000) + 1;
        await tx.ausencia.create({
          data: {
            opsId: solicitacao.opsId,
            idTipoAusencia: tipoFerias.idTipoAusencia,
            dataInicio: solicitacao.feriasDataInicio,
            dataFim: solicitacao.feriasDataFim,
            diasCorridos,
            status: "ATIVO",
            registradoPor,
          },
        });
      }
    }
    return null;
  }

  if (solicitacao.tipo === "AFASTAMENTO") {
    await tx.colaborador.update({
      where: { opsId: solicitacao.opsId },
      data: {
        status: "AFASTADO",
        dataInicioStatus: solicitacao.afastamentoDataInicio,
        dataFimStatus: solicitacao.afastamentoDataFim,
      },
    });

    const tipoAfastamento = await tx.tipoAusencia.findFirst({
      where: { OR: [{ codigo: "AFA" }, { codigo: "AF" }] },
      select: { idTipoAusencia: true },
      orderBy: { codigo: "asc" },
    });
    if (tipoAfastamento) {
      const jaExiste = await tx.ausencia.findFirst({
        where: { opsId: solicitacao.opsId, idTipoAusencia: tipoAfastamento.idTipoAusencia, dataInicio: solicitacao.afastamentoDataInicio },
      });
      if (!jaExiste) {
        const diasCorridos = Math.round((solicitacao.afastamentoDataFim - solicitacao.afastamentoDataInicio) / 86400000) + 1;
        await tx.ausencia.create({
          data: {
            opsId: solicitacao.opsId,
            idTipoAusencia: tipoAfastamento.idTipoAusencia,
            dataInicio: solicitacao.afastamentoDataInicio,
            dataFim: solicitacao.afastamentoDataFim,
            diasCorridos,
            status: "ATIVO",
            registradoPor,
          },
        });
      }
    }
    return null;
  }

  if (solicitacao.tipo === "INTERNALIZACAO") {
    try {
      await tx.colaborador.update({
        where: { opsId: solicitacao.opsId },
        data: {
          idEmpresa: solicitacao.internalizacaoNovaIdEmpresa,
          matricula: solicitacao.internalizacaoNovaMatricula,
        },
      });
    } catch (e) {
      if (e.code === "P2002") {
        throw new HttpError("Essa matrícula já está em uso por outro colaborador. A internalização não foi concluída.", 409);
      }
      throw e;
    }
    return null;
  }

  return null;
}

/* =====================================================
   APROVAR SOLICITAÇÃO (lógica interna, reaproveitada pela
   aprovação individual e pela aprovação em lote)
   Regra: o primeiro aprovador ativo que agir vence. Update
   condicional atômico (status = PENDENTE) evita corrida entre
   dois aprovadores agindo simultaneamente.
===================================================== */
async function processarAprovacaoSolicitacao(req, idSolicitacao) {
    const solicitacaoAtual = await prisma.solicitacaoOperacional.findUnique({
      where: { idSolicitacao },
      select: { tipo: true, status: true, colaborador: { select: { idEstacao: true } } },
    });

    if (!solicitacaoAtual || !pertenceAEstacaoDoUsuario(req, solicitacaoAtual.colaborador?.idEstacao)) {
      throw new HttpError("Solicitação não encontrada", 404);
    }

    const idEstacaoSolicitacao = solicitacaoAtual.colaborador?.idEstacao;
    const segundaEtapaTipo = SEGUNDA_APROVACAO_POR_TIPO[solicitacaoAtual.tipo] || null;

    /* =====================================================
       PRIMEIRA APROVAÇÃO — só para tipos com segunda etapa.
       Não aplica nenhum efeito ainda; só avança o status e
       avisa o RH/Coordenador de que é a vez dele.
    ===================================================== */
    if (solicitacaoAtual.status === "PENDENTE" && segundaEtapaTipo) {
      const autorizado = await isAprovadorAtivo(req.user.email, idEstacaoSolicitacao);
      if (!autorizado) {
        throw new HttpError("Você não está cadastrado como aprovador.", 403);
      }

      let solicitacaoAtualizada = null;
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.solicitacaoOperacional.updateMany({
          where: { idSolicitacao, status: "PENDENTE" },
          data: {
            status: "AGUARDANDO_SEGUNDA_APROVACAO",
            primeiraAprovacaoPorUserId: req.user.id,
            primeiraAprovacaoEm: new Date(),
          },
        });
        if (claimed.count === 0) {
          throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
        }
        solicitacaoAtualizada = await tx.solicitacaoOperacional.findUnique({ where: { idSolicitacao } });
        await tx.solicitacaoOperacionalHistorico.create({
          data: {
            idSolicitacao,
            evento: `Primeira aprovação por ${req.user.name} — aguardando confirmação do ${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]}`,
          },
        });
      });

      const segundosAprovadores = await prisma.segundoAprovadorOperacional.findMany({
        where: {
          tipo: segundaEtapaTipo,
          ativo: true,
          OR: [{ idEstacao: { in: getEstacoesDoGrupo(idEstacaoSolicitacao) } }, { idEstacao: null }],
        },
      });
      const colaboradorNotif = await prisma.colaborador.findUnique({
        where: { opsId: solicitacaoAtualizada.opsId },
        select: {
          nomeCompleto: true, cpf: true,
          cargo: { select: { nomeCargo: true } },
          setor: { select: { nomeSetor: true } },
          turno: { select: { nomeTurno: true } },
          lider: { select: { nomeCompleto: true } },
        },
      });

      // E-mail ao(s) segundo(s) aprovador(es) — best-effort
      try {
        const emailsSegundosAprovadores = emailsParaNotificar(segundosAprovadores);
        if (emailsSegundosAprovadores.length > 0) {
          await sendSolicitacaoOperacionalEmail({
            to: emailsSegundosAprovadores,
            solicitacao: {
              idSolicitacao,
              tipo: solicitacaoAtualizada.tipo,
              colaboradorNome: colaboradorNotif?.nomeCompleto,
              cpf: colaboradorNotif?.cpf,
              cargo: colaboradorNotif?.cargo?.nomeCargo,
              setor: colaboradorNotif?.setor?.nomeSetor,
              turno: colaboradorNotif?.turno?.nomeTurno,
              lider: colaboradorNotif?.lider?.nomeCompleto,
              dataCriacao: solicitacaoAtualizada.dataCriacao,
              data: solicitacaoAtualizada.data,
              motivo: solicitacaoAtualizada.motivo,
            },
          });
          await prisma.solicitacaoOperacionalHistorico.create({
            data: { idSolicitacao, evento: `E-mail enviado ao(s) ${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]}(s)` },
          });
        }
      } catch (emailErr) {
        console.error("⚠️ Falha ao enviar email de segunda aprovação:", emailErr.message);
      }

      // SeaTalk ao(s) segundo(s) aprovador(es) — best-effort
      try {
        await sendSolicitacaoNotification(
          `# ⏳ Aguardando 2ª Aprovação (${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]})\n\n` +
            `- **Tipo:** ${TIPO_LABEL_SEATALK[solicitacaoAtualizada.tipo] || solicitacaoAtualizada.tipo}\n` +
            `- **Colaborador:** ${colaboradorNotif?.nomeCompleto || "N/A"}\n` +
            `- **1ª aprovação por:** ${req.user.name}\n\n` +
            `---\n\n` +
            `[Ver solicitação completa](${linkSolicitacaoOperacional(idSolicitacao)})`,
          { mentionEmails: segundosAprovadores.map((a) => a.email) }
        );
      } catch (seatalkErr) {
        console.error("⚠️ Falha ao enviar notificação SeaTalk de segunda aprovação:", seatalkErr.message);
      }

      return `Primeira aprovação registrada — aguardando confirmação do ${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]}`;
    }

    /* =====================================================
       DECISÃO FINAL — Sinergia (aprovação única, como antes)
       ou segunda etapa dos demais tipos (RH/Coordenador).
       Só agora os efeitos (frequência/cadastro) são aplicados.
    ===================================================== */
    let autorizado = false;
    let statusEsperado = null;
    if (solicitacaoAtual.status === "PENDENTE" && !segundaEtapaTipo) {
      autorizado = await isAprovadorAtivo(req.user.email, idEstacaoSolicitacao);
      statusEsperado = "PENDENTE";
    } else if (solicitacaoAtual.status === "AGUARDANDO_SEGUNDA_APROVACAO" && segundaEtapaTipo) {
      autorizado = await isSegundoAprovadorAtivo(req.user.email, segundaEtapaTipo, idEstacaoSolicitacao);
      statusEsperado = "AGUARDANDO_SEGUNDA_APROVACAO";
    } else {
      throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
    }

    if (!autorizado) {
      throw new HttpError("Você não está cadastrado como aprovador.", 403);
    }

    const TIPOS_CADASTRAIS = ["TROCA_GESTAO", "TROCA_ESCALA", "DESLIGAMENTO", "TROCA_TURNO", "FERIAS", "AFASTAMENTO", "INTERNALIZACAO"];
    const EVENTO_POS_APROVACAO = {
      TROCA_GESTAO: "Líder do colaborador atualizado automaticamente",
      TROCA_ESCALA: "Escala do colaborador atualizada automaticamente",
      DESLIGAMENTO: "Colaborador desligado automaticamente",
      TROCA_TURNO: "Turno do colaborador atualizado automaticamente",
      FERIAS: "Colaborador marcado em férias e Controle de Presença atualizado",
      AFASTAMENTO: "Colaborador marcado como afastado e Controle de Presença atualizado",
      INTERNALIZACAO: "Empresa e matrícula do colaborador atualizadas automaticamente",
    };

    let regenDSR = null;
    let tipoAprovado = null;
    let solicitacaoAprovada = null;

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.solicitacaoOperacional.updateMany({
        where: { idSolicitacao, status: statusEsperado },
        data: { status: "APROVADA", decididoPorUserId: req.user.id, decididoEm: new Date() },
      });

      if (claimed.count === 0) {
        throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
      }

      const solicitacao = await tx.solicitacaoOperacional.findUnique({ where: { idSolicitacao } });
      tipoAprovado = solicitacao.tipo;
      solicitacaoAprovada = solicitacao;

      if (TIPOS_CADASTRAIS.includes(solicitacao.tipo)) {
        regenDSR = await aplicarMudancaCadastral(tx, solicitacao, req.user.id);
      } else {
        await aplicarNaFrequencia(tx, solicitacao, req.user.id);
      }

      const eventoDecisao = statusEsperado === "AGUARDANDO_SEGUNDA_APROVACAO"
        ? `Segunda aprovação (${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]}) por ${req.user.name}`
        : `Solicitação aprovada por ${req.user.name}`;

      await tx.solicitacaoOperacionalHistorico.createMany({
        data: [
          { idSolicitacao, evento: eventoDecisao },
          { idSolicitacao, evento: EVENTO_POS_APROVACAO[solicitacao.tipo] || "Controle de Presença atualizado automaticamente" },
        ],
      });
    });

    // Regeneração de DSR fora da transação (evita timeout em backfills longos)
    if (regenDSR?.nomeEscalaParaDSR) {
      try {
        await gerarDSRFuturoColaborador({ opsId: solicitacaoAprovada.opsId, nomeEscala: regenDSR.nomeEscalaParaDSR, idEstacao: regenDSR.idEstacao });
        await gerarDSRBackfillColaborador({ opsId: solicitacaoAprovada.opsId, nomeEscala: regenDSR.nomeEscalaParaDSR, idEstacao: regenDSR.idEstacao });
      } catch (e) {
        console.error(`❌ Erro ao regenerar DSR após troca de escala (${idSolicitacao}):`, e.message);
      }
    }

    // Frequência de desligamento fora da transação — best-effort
    if (tipoAprovado === "DESLIGAMENTO") {
      try {
        await gerarFrequenciaDesligamento({
          opsId: solicitacaoAprovada.opsId,
          dataDesligamento: solicitacaoAprovada.dataDesligamentoSolicitada,
          tipoDesligamento: solicitacaoAprovada.tipoDesligamentoSolicitado,
        });
      } catch (e) {
        console.error(`❌ Erro ao gerar frequência de desligamento (${idSolicitacao}):`, e.message);
      }
    }

    // Frequência de férias/afastamento fora da transação — best-effort
    if (tipoAprovado === "FERIAS") {
      try {
        await gerarFrequenciaFerias({
          opsId: solicitacaoAprovada.opsId,
          dataInicio: solicitacaoAprovada.feriasDataInicio,
          dataFim: solicitacaoAprovada.feriasDataFim,
        });
      } catch (e) {
        console.error(`❌ Erro ao gerar frequência de férias (${idSolicitacao}):`, e.message);
      }
    }
    if (tipoAprovado === "AFASTAMENTO") {
      try {
        await gerarFrequenciaAfastamento({
          opsId: solicitacaoAprovada.opsId,
          dataInicio: solicitacaoAprovada.afastamentoDataInicio,
          dataFim: solicitacaoAprovada.afastamentoDataFim,
        });
      } catch (e) {
        console.error(`❌ Erro ao gerar frequência de afastamento (${idSolicitacao}):`, e.message);
      }
    }

    // E-mail ao solicitante — best-effort
    try {
      const solicitacao = await prisma.solicitacaoOperacional.findUnique({
        where: { idSolicitacao },
        include: { solicitante: { select: { email: true, name: true } }, colaborador: { select: { nomeCompleto: true } } },
      });
      if (solicitacao?.solicitante?.email) {
        await sendDecisaoOperacionalEmail({
          to: solicitacao.solicitante.email,
          solicitacao: { ...solicitacao, colaboradorNome: solicitacao.colaborador?.nomeCompleto },
          aprovada: true,
        });
        await prisma.solicitacaoOperacionalHistorico.create({
          data: { idSolicitacao, evento: "E-mail enviado ao solicitante" },
        });
      }
    } catch (emailErr) {
      console.error("⚠️ Falha ao enviar email de decisão (aprovação):", emailErr.message);
    }

    try {
      const colaborador = await prisma.colaborador.findUnique({
        where: { opsId: solicitacaoAprovada.opsId },
        select: { nomeCompleto: true },
      });
      const solicitante = await prisma.user.findUnique({
        where: { id: solicitacaoAprovada.solicitanteUserId },
        select: { email: true },
      });
      await sendSolicitacaoNotification(
        `# ✅ Solicitação Operacional Aprovada\n\n` +
          `- **Tipo:** ${TIPO_LABEL_SEATALK[tipoAprovado] || tipoAprovado}\n` +
          `- **Colaborador:** ${colaborador?.nomeCompleto || "N/A"}\n` +
          `- **Data da solicitação:** ${formatDataBR(solicitacaoAprovada.data)}\n` +
          `- **Data da aprovação:** ${formatDataHoraBR(solicitacaoAprovada.decididoEm)}\n` +
          `- **Aprovado por:** ${req.user.name}\n\n` +
          `---\n\n` +
          `[Ver solicitação completa](${linkSolicitacaoOperacional(idSolicitacao)})`,
        { mentionEmails: [solicitante?.email] }
      );
    } catch (seatalkErr) {
      console.error("⚠️ Falha ao enviar notificação SeaTalk de aprovação operacional:", seatalkErr.message);
    }

    return TIPOS_CADASTRAIS.includes(tipoAprovado)
      ? "Solicitação aprovada e cadastro do colaborador atualizado"
      : "Solicitação aprovada e Controle de Presença atualizado";
}

exports.aprovarSolicitacao = async (req, res) => {
  try {
    const idSolicitacao = Number(req.params.id);
    const mensagem = await processarAprovacaoSolicitacao(req, idSolicitacao);
    return successResponse(res, null, mensagem);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(res, err.message, err.statusCode);
    }
    console.error("❌ aprovarSolicitacao (operacional):", err);
    return errorResponse(res, "Erro ao aprovar solicitação", 500);
  }
};

/* =====================================================
   LISTAR IDs APROVÁVEIS PELO FILTRO ATUAL
   Usado pela seleção "todos os resultados do filtro" — respeita
   os mesmos filtros da listagem, mas só retorna solicitações
   ainda decidíveis (PENDENTE / AGUARDANDO_SEGUNDA_APROVACAO).
===================================================== */
exports.listarIdsAprovaveis = async (req, res) => {
  try {
    const { status, tipo, dataInicio, dataFim, solicitante, colaborador, turno } = req.query;

    if (status && !["PENDENTE", "AGUARDANDO_SEGUNDA_APROVACAO"].includes(status)) {
      return successResponse(res, { ids: [], total: 0, truncado: false });
    }

    const TIPOS_APROVACAO_LOTE = ["SINERGIA", "BANCO_HORAS", "INTERNALIZACAO"];
    if (tipo && !TIPOS_APROVACAO_LOTE.includes(tipo)) {
      return successResponse(res, { ids: [], total: 0, truncado: false });
    }

    const where = { ...estacaoWhereSolicitacao(req) };
    where.status = status || { in: ["PENDENTE", "AGUARDANDO_SEGUNDA_APROVACAO"] };
    where.tipo = tipo || { in: TIPOS_APROVACAO_LOTE };
    if (turno) where.colaborador = { ...where.colaborador, turno: { nomeTurno: turno } };
    if (solicitante) where.solicitante = { name: { contains: solicitante, mode: "insensitive" } };
    if (colaborador) {
      where.OR = [
        { colaborador: { nomeCompleto: { contains: colaborador, mode: "insensitive" } } },
        { colaborador2: { nomeCompleto: { contains: colaborador, mode: "insensitive" } } },
      ];
    }
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(`${dataInicio}T00:00:00.000Z`);
      if (dataFim) where.data.lte = new Date(`${dataFim}T23:59:59.999Z`);
    }

    const MAX = 200;
    const registros = await prisma.solicitacaoOperacional.findMany({
      where,
      select: {
        idSolicitacao: true,
        tipo: true,
        solicitante: { select: { name: true } },
      },
      orderBy: { data: "desc" },
      take: MAX + 1,
    });

    const truncado = registros.length > MAX;
    const pagina = registros.slice(0, MAX);
    const ids = pagina.map((r) => r.idSolicitacao);
    const detalhes = pagina.map((r) => ({
      idSolicitacao: r.idSolicitacao,
      tipo: r.tipo,
      solicitanteNome: r.solicitante?.name || "—",
    }));

    return successResponse(res, { ids, detalhes, total: ids.length, truncado });
  } catch (err) {
    console.error("❌ listarIdsAprovaveis (operacional):", err);
    return errorResponse(res, "Erro ao buscar solicitações aprováveis", 500);
  }
};

/* =====================================================
   REPROVAR SOLICITAÇÃO
===================================================== */
exports.reprovarSolicitacao = async (req, res) => {
  try {
    const idSolicitacao = Number(req.params.id);
    const { motivo } = req.body;

    if (!motivo?.trim()) {
      return errorResponse(res, "Motivo da reprovação é obrigatório", 400);
    }

    const solicitacaoAtual = await prisma.solicitacaoOperacional.findUnique({
      where: { idSolicitacao },
      select: { tipo: true, status: true, colaborador: { select: { idEstacao: true } } },
    });

    if (!solicitacaoAtual || !pertenceAEstacaoDoUsuario(req, solicitacaoAtual.colaborador?.idEstacao)) {
      return notFoundResponse(res, "Solicitação não encontrada");
    }

    const idEstacaoSolicitacao = solicitacaoAtual.colaborador?.idEstacao;
    const segundaEtapaTipo = SEGUNDA_APROVACAO_POR_TIPO[solicitacaoAtual.tipo] || null;

    let autorizado = false;
    let statusEsperado = null;
    let etapaLabel = "";
    if (solicitacaoAtual.status === "PENDENTE") {
      autorizado = await isAprovadorAtivo(req.user.email, idEstacaoSolicitacao);
      statusEsperado = "PENDENTE";
    } else if (solicitacaoAtual.status === "AGUARDANDO_SEGUNDA_APROVACAO" && segundaEtapaTipo) {
      autorizado = await isSegundoAprovadorAtivo(req.user.email, segundaEtapaTipo, idEstacaoSolicitacao);
      statusEsperado = "AGUARDANDO_SEGUNDA_APROVACAO";
      etapaLabel = ` (${SEGUNDO_APROVADOR_LABEL[segundaEtapaTipo]})`;
    } else {
      return errorResponse(res, "Esta solicitação já foi analisada por outro responsável.", 409);
    }

    if (!autorizado) {
      return errorResponse(res, "Você não está cadastrado como aprovador.", 403);
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.solicitacaoOperacional.updateMany({
        where: { idSolicitacao, status: statusEsperado },
        data: {
          status: "REPROVADA",
          decididoPorUserId: req.user.id,
          decididoEm: new Date(),
          motivoReprovacao: motivo.trim(),
        },
      });

      if (claimed.count === 0) {
        throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
      }

      await tx.solicitacaoOperacionalHistorico.create({
        data: {
          idSolicitacao,
          evento: `Solicitação reprovada por ${req.user.name}${etapaLabel} — Motivo: ${motivo.trim()}`,
        },
      });
    });

    try {
      const solicitacao = await prisma.solicitacaoOperacional.findUnique({
        where: { idSolicitacao },
        include: { solicitante: { select: { email: true, name: true } }, colaborador: { select: { nomeCompleto: true } } },
      });
      if (solicitacao?.solicitante?.email) {
        await sendDecisaoOperacionalEmail({
          to: solicitacao.solicitante.email,
          solicitacao: { ...solicitacao, colaboradorNome: solicitacao.colaborador?.nomeCompleto },
          aprovada: false,
          motivoReprovacao: motivo.trim(),
        });
        await prisma.solicitacaoOperacionalHistorico.create({
          data: { idSolicitacao, evento: "E-mail enviado ao solicitante" },
        });
      }
    } catch (emailErr) {
      console.error("⚠️ Falha ao enviar email de decisão (reprovação):", emailErr.message);
    }

    try {
      const solicitacao = await prisma.solicitacaoOperacional.findUnique({
        where: { idSolicitacao },
        select: {
          tipo: true,
          colaborador: { select: { nomeCompleto: true } },
          solicitante: { select: { email: true } },
        },
      });
      await sendSolicitacaoNotification(
        `# ❌ Solicitação Operacional Reprovada\n\n` +
          `- **Tipo:** ${TIPO_LABEL_SEATALK[solicitacao?.tipo] || solicitacao?.tipo}\n` +
          `- **Colaborador:** ${solicitacao?.colaborador?.nomeCompleto || "N/A"}\n` +
          `- **Reprovado por:** ${req.user.name}\n\n` +
          `> Motivo: **${motivo.trim()}**\n\n` +
          `---\n\n` +
          `[Ver solicitação completa](${linkSolicitacaoOperacional(idSolicitacao)})`,
        { mentionEmails: [solicitacao?.solicitante?.email] }
      );
    } catch (seatalkErr) {
      console.error("⚠️ Falha ao enviar notificação SeaTalk de reprovação operacional:", seatalkErr.message);
    }

    return successResponse(res, null, "Solicitação reprovada");
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(res, err.message, err.statusCode);
    }
    console.error("❌ reprovarSolicitacao (operacional):", err);
    return errorResponse(res, "Erro ao reprovar solicitação", 500);
  }
};
