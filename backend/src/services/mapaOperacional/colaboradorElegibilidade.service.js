const { prisma } = require("../../config/database");
const { getTurnoOperacionalAtual } = require("../../utils/turnoMapaOperacional");
const { sinergiaNoDestinoDe } = require("../sinergiaInterna/localizacao.service");
const { STATUS_NO_DESTINO } = require("../sinergiaInterna/base");

function normaliza(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Contexto da alocação -> setor exigido do colaborador.
// Esteiras: qualquer setor "Esteira ..." (Esteira A/B/C/Linear/Termoplástica).
const CONTEXTOS = {
  ESTEIRA: {
    rotulo: "Esteiras",
    testa: (nomeSetor) => normaliza(nomeSetor).startsWith("esteira"),
    filtroPrisma: { nomeSetor: { startsWith: "Esteira", mode: "insensitive" } },
  },
  RECEBIMENTO: {
    rotulo: "Recebimento",
    testa: (nomeSetor) => normaliza(nomeSetor) === "recebimento",
    filtroPrisma: { nomeSetor: { equals: "Recebimento", mode: "insensitive" } },
  },
  EXPEDICAO: {
    rotulo: "Expedição",
    testa: (nomeSetor) => normaliza(nomeSetor) === "expedicao",
    filtroPrisma: { nomeSetor: { equals: "Expedição", mode: "insensitive" } },
  },
};

/** ESTEIRA | RECEBIMENTO | EXPEDICAO, ou null quando o setor não aloca em nenhum desses. */
// Só esses cargos entram no Label (alocação manual, busca e lista de efetivo).
const CARGOS_ELEGIVEIS = ["Auxiliar de Logística I", "Auxiliar de Logística II", "Auxiliar de Logística I - PCD"];
const CARGOS_ELEGIVEIS_NORM = CARGOS_ELEGIVEIS.map(normaliza);
const FILTRO_CARGO_PRISMA = { nomeCargo: { in: CARGOS_ELEGIVEIS } };

function contextoDoSetor(nomeSetor) {
  return Object.keys(CONTEXTOS).find((k) => CONTEXTOS[k].testa(nomeSetor)) || null;
}

function contextoDaOperacao(operacao) {
  return operacao === "INBOUND" ? "RECEBIMENTO" : "EXPEDICAO";
}

/**
 * Valida se um colaborador pode ser alocado manualmente agora: turno
 * cadastrado igual ao turno exigido (default: turno atual), setor
 * compatível com o contexto (esteira / recebimento / expedição) e marcado
 * como Presente (idTipoAusencia = 2) na Frequência do dia operacional.
 * Usado pelas esteiras, docas e times — mesma regra, um lugar só.
 */
async function validarColaboradorElegivel(opsId, { contexto, turno, semPresenca = false } = {}) {
  const colaborador = await prisma.colaborador.findUnique({
    where: { opsId },
    include: {
      turno: { select: { nomeTurno: true } },
      setor: { select: { nomeSetor: true } },
      cargo: { select: { nomeCargo: true } },
    },
  });
  if (!colaborador) return { colaborador: null, erro: "Colaborador não encontrado" };

  if (!CARGOS_ELEGIVEIS_NORM.includes(normaliza(colaborador.cargo?.nomeCargo))) {
    return {
      colaborador,
      erro: `${colaborador.nomeCompleto} é ${colaborador.cargo?.nomeCargo || "sem cargo"} — só Auxiliar de Logística I, II ou I - PCD podem ser alocados`,
    };
  }

  const { turno: turnoAtual, diaOperacional } = getTurnoOperacionalAtual();
  const turnoExigido = turno || turnoAtual;

  if (colaborador.turno?.nomeTurno !== turnoExigido) {
    return {
      colaborador,
      erro: `${colaborador.nomeCompleto} é do turno ${colaborador.turno?.nomeTurno || "—"}, não do ${turnoExigido}`,
    };
  }

  const regra = CONTEXTOS[contexto];
  // Sinergia Interna confirmada no destino: a localização operacional é o destino (o setor base não muda).
  const sinergia = await sinergiaNoDestinoDe(opsId);
  if (sinergia) {
    if (regra && sinergia.areaDestino.contexto !== contexto) {
      return {
        colaborador,
        erro: `${colaborador.nomeCompleto} está em sinergia interna na área ${sinergia.areaDestino.nome} — só pode ser alocado lá até o retorno ser confirmado`,
      };
    }
  } else if (regra && !regra.testa(colaborador.setor?.nomeSetor)) {
    return {
      colaborador,
      erro: `${colaborador.nomeCompleto} é do setor ${colaborador.setor?.nomeSetor || "não informado"} — só pode alocar quem é do setor de ${regra.rotulo}`,
    };
  }

  // Pré-alocação de turno futuro: a presença só existe quando o turno começar, e é conferida de novo na ativação.
  if (!semPresenca) {
    const frequencia = await prisma.frequencia.findUnique({
      where: { opsId_dataReferencia: { opsId, dataReferencia: diaOperacional } },
    });
    if (!frequencia || frequencia.idTipoAusencia !== 2) {
      return { colaborador, erro: `${colaborador.nomeCompleto} não está marcado como presente nessa data` };
    }
  }

  return { colaborador, erro: null };
}

/** Busca (nome/CPF/Ops ID) só entre quem passaria na validação acima. */
async function buscarColaboradoresElegiveis({ idEstacao, contexto, turno, search, semPresenca = false }) {
  const regra = CONTEXTOS[contexto];
  const { turno: turnoAtual, diaOperacional } = getTurnoOperacionalAtual();
  const termo = String(search || "").trim();

  return prisma.colaborador.findMany({
    where: {
      idEstacao,
      status: "ATIVO",
      turno: { nomeTurno: turno || turnoAtual },
      cargo: FILTRO_CARGO_PRISMA,
      ...(regra
        ? {
            AND: [
              {
                OR: [
                  // setor base compatível e sem sinergia confirmada em outra área...
                  {
                    setor: regra.filtroPrisma,
                    NOT: { sinergiasInternas: { some: { status: { in: STATUS_NO_DESTINO }, areaDestino: { contexto: { not: contexto } } } } },
                  },
                  // ...ou em sinergia confirmada numa área deste contexto
                  { sinergiasInternas: { some: { status: { in: STATUS_NO_DESTINO }, areaDestino: { contexto } } } },
                ],
              },
            ],
          }
        : {}),
      ...(semPresenca ? {} : { frequencias: { some: { dataReferencia: diaOperacional, idTipoAusencia: 2 } } }),
      ...(termo
        ? {
            OR: [
              { nomeCompleto: { contains: termo, mode: "insensitive" } },
              { opsId: { contains: termo, mode: "insensitive" } },
              { matricula: { contains: termo, mode: "insensitive" } },
              { cpf: { contains: termo, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      opsId: true,
      nomeCompleto: true,
      cargo: { select: { nomeCargo: true } },
      setor: { select: { nomeSetor: true } },
    },
    orderBy: { nomeCompleto: "asc" },
    take: 8,
  });
}

module.exports = {
  validarColaboradorElegivel,
  buscarColaboradoresElegiveis,
  contextoDaOperacao,
  contextoDoSetor,
  FILTRO_CARGO_PRISMA,
  CONTEXTOS,
};
