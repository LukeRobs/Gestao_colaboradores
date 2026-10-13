const { prisma } = require("../../config/database");
const { getJanelaTurno } = require("../../utils/turnoMapaOperacional");
const { validarColaboradorElegivel } = require("./colaboradorElegibilidade.service");
const { avaliarConflitoAlocacao } = require("./alocacaoConflito.service");
const { getPessoasAtivasFullD1 } = require("./workstationSheets.service");

/**
 * Pré-alocação da Label: monta esteira (funções sem braço) e FULL D+1 de um turno que ainda não
 * começou. As linhas ficam em mapa_alocacao_agendada e viram alocações reais (mapa_alocacao, origem
 * MANUAL) quando o turno começa — assim nada do que é lido "ao vivo" (HC, conflitos, docas) enxerga
 * alocação futura. Pesca e packing não entram: dependem de braço / da Workstation.
 */
const LABORS_AGENDAVEIS = ["GOL", "ENDERECAMENTO", "INDUCAO", "ABASTECEDOR", "MONTAGEM_SCUTTLE", "VOLANTE", "LOG_II", "FULL_D1"];
const HORIZONTE_MS = 48 * 60 * 60 * 1000;

const idTurno = (t) => (t === "T1" ? 1 : t === "T2" ? 2 : 3);
const dataDoDia = (diaStr) => new Date(`${diaStr}T00:00:00.000Z`);
const diaStr = (d) => d.toISOString().slice(0, 10);

/** Saldo de diaristas de um turno futuro: lançados no Daily Works menos os já pré-alocados. */
async function saldoDiaristasFuturo(idEstacao, dia, turno) {
  const lancados = await prisma.dwReal.aggregate({
    where: { idEstacao, idTurno: idTurno(turno), data: dataDoDia(dia) },
    _sum: { quantidade: true },
  });
  const total = lancados._sum.quantidade || 0;
  const alocados = await prisma.mapaAlocacaoAgendada.count({
    where: { idEstacao, diarista: true, diaOperacional: dataDoDia(dia), turno, status: { in: ["PENDENTE", "ATIVANDO", "ATIVADA"] } },
  });
  return { total, alocados, disponiveis: Math.max(total - alocados, 0), turno };
}

async function marcar(idAgendada, status, motivoFalha = null) {
  await prisma.mapaAlocacaoAgendada.update({
    where: { idAgendada },
    data: { status, motivoFalha, ativadoEm: status === "ATIVADA" ? new Date() : null },
  });
}

async function ativarUma(a) {
  const idEstacao = a.idEstacao;

  if (a.diarista) {
    const { total } = await saldoDiaristasFuturo(idEstacao, diaStr(a.diaOperacional), a.turno);
    const ativosAgora = await prisma.mapaAlocacao.count({ where: { idEstacao, diarista: true, fim: null } });
    if (total - ativosAgora <= 0) return marcar(a.idAgendada, "FALHOU", "Sem saldo de diaristas no início do turno");
  } else {
    const { colaborador, erro } = await validarColaboradorElegivel(a.opsId, { contexto: "ESTEIRA", turno: a.turno });
    if (!colaborador) return marcar(a.idAgendada, "FALHOU", "Colaborador não encontrado");
    if (erro) return marcar(a.idAgendada, "FALHOU", erro);

    if (a.labor === "FULL_D1") {
      const jaNoPool =
        (await prisma.mapaAlocacao.findFirst({ where: { idEstacao, opsId: a.opsId, labor: "FULL_D1", fim: null } })) ||
        (await getPessoasAtivasFullD1().catch(() => [])).some((p) => p.opsId === a.opsId);
      if (jaNoPool) return marcar(a.idAgendada, "ATIVADA"); // já está onde foi planejado
    } else {
      const esteira = await prisma.mapaEsteira.findUnique({ where: { idEsteira: a.idEsteira }, select: { idEsteira: true, nome: true } });
      if (!esteira) return marcar(a.idAgendada, "FALHOU", "Esteira não encontrada");
      const conflito = await avaliarConflitoAlocacao({ colaborador, esteira, labor: a.labor });
      if (conflito?.codigo === "JA_ALOCADO") return marcar(a.idAgendada, "ATIVADA");
      // O líder planejou esta função: trocar de função na mesma esteira não precisa de nova confirmação.
      if (conflito && conflito.codigo !== "CONFIRMAR_SUBSTITUICAO") return marcar(a.idAgendada, "FALHOU", conflito.mensagem);
    }
  }

  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    if (!a.diarista) await tx.mapaAlocacao.updateMany({ where: { opsId: a.opsId, fim: null }, data: { fim: agora } });
    await tx.mapaAlocacao.create({
      data: {
        idEstacao,
        idEsteira: a.labor === "FULL_D1" ? null : a.idEsteira,
        braco: null,
        lado: null,
        labor: a.labor,
        origem: "MANUAL",
        opsId: a.diarista ? null : a.opsId,
        diarista: a.diarista,
        idUsuario: a.idUsuario,
      },
    });
  });
  return marcar(a.idAgendada, "ATIVADA");
}

/**
 * Converte em alocação real as pré-alocações cujo turno já começou. Idempotente: cada linha é
 * "reivindicada" (PENDENTE -> ATIVANDO) antes de processar, então dois processos não duplicam.
 */
async function ativarAgendadasVencidas() {
  const agora = new Date();
  const pendentes = await prisma.mapaAlocacaoAgendada.findMany({ where: { status: "PENDENTE" }, orderBy: { criadoEm: "asc" } });
  let ativadas = 0;

  for (const a of pendentes) {
    const janela = getJanelaTurno(diaStr(a.diaOperacional), a.turno);
    if (agora < janela.inicio) continue;

    const { count } = await prisma.mapaAlocacaoAgendada.updateMany({ where: { idAgendada: a.idAgendada, status: "PENDENTE" }, data: { status: "ATIVANDO" } });
    if (!count) continue;

    try {
      if (agora >= janela.fim) await marcar(a.idAgendada, "FALHOU", "O turno terminou antes de a pré-alocação ser ativada");
      else await ativarUma(a);
      ativadas += 1;
    } catch (err) {
      console.error("❌ [AGENDADAS] Erro ao ativar pré-alocação:", err.message);
      await marcar(a.idAgendada, "FALHOU", "Erro inesperado ao ativar");
    }
  }
  return { ativadas };
}

module.exports = { LABORS_AGENDAVEIS, HORIZONTE_MS, saldoDiaristasFuturo, ativarAgendadasVencidas, dataDoDia, diaStr };
