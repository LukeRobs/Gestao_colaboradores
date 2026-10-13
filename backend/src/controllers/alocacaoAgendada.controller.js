const { prisma } = require("../config/database");
const { successResponse, createdResponse, errorResponse, notFoundResponse } = require("../utils/response");
const { getTurnoOperacionalAtual, getJanelaTurno } = require("../utils/turnoMapaOperacional");
const { validarColaboradorElegivel } = require("../services/mapaOperacional/colaboradorElegibilidade.service");
const { LABORS_AGENDAVEIS, HORIZONTE_MS, saldoDiaristasFuturo, ativarAgendadasVencidas, dataDoDia } = require("../services/mapaOperacional/alocacaoAgendada.service");

const TURNOS = ["T1", "T2", "T3"];
const NOME_LABOR = {
  GOL: "Gol",
  ENDERECAMENTO: "Endereçamento",
  INDUCAO: "Indução",
  ABASTECEDOR: "Abastecedor",
  MONTAGEM_SCUTTLE: "5S / Montagem Scuttle",
  VOLANTE: "Volante",
  LOG_II: "LOG II",
  FULL_D1: "FULL D+1",
};

const colaboradorSelect = { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } };

function validarTurnoFuturo(data, turno) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "") || !TURNOS.includes(turno)) return "Informe o dia e o turno";
  const janela = getJanelaTurno(data, turno);
  const agora = Date.now();
  if (janela.inicio.getTime() <= agora) return "Esse turno já começou: aloque direto, sem pré-alocação.";
  if (janela.inicio.getTime() - agora > HORIZONTE_MS) return "Só é possível pré-alocar turnos das próximas 48 horas.";
  return null;
}

/** POST /agendadas — { idEsteira|null, labor, opsId | diarista, data, turno } */
const agendarAlocacao = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira, labor, opsId, diarista, data, turno } = req.body;

    if (!LABORS_AGENDAVEIS.includes(labor)) {
      return errorResponse(res, "Essa função não pode ser pré-alocada (pesca e packing dependem de braço/Workstation).", 400);
    }
    const erroTurno = validarTurnoFuturo(data, turno);
    if (erroTurno) return errorResponse(res, erroTurno, 400);

    const ehFull = labor === "FULL_D1";
    if (!ehFull) {
      const esteira = await prisma.mapaEsteira.findFirst({ where: { idEsteira: Number(idEsteira), idEstacao, ativo: true }, select: { idEsteira: true } });
      if (!esteira) return notFoundResponse(res, "Esteira não encontrada");
    }

    const dia = dataDoDia(data);
    const ehDiarista = !!diarista;

    if (ehDiarista) {
      const saldo = await saldoDiaristasFuturo(idEstacao, data, turno);
      if (saldo.disponiveis <= 0) {
        return errorResponse(res, `Não há diaristas disponíveis no ${turno} — ${saldo.total} lançados no Daily Works e ${saldo.alocados} já pré-alocados.`, 400);
      }
    } else {
      if (!opsId) return errorResponse(res, "Informe o colaborador (opsId) ou marque diarista", 400);
      // A presença só é exigida quando o turno começar (é quando a pessoa realmente entra).
      const { colaborador, erro } = await validarColaboradorElegivel(opsId, { contexto: "ESTEIRA", turno, semPresenca: true });
      if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");
      if (erro) return errorResponse(res, erro, 400);

      const jaAgendado = await prisma.mapaAlocacaoAgendada.findFirst({
        where: { idEstacao, opsId, diaOperacional: dia, turno, status: { in: ["PENDENTE", "ATIVANDO"] } },
      });
      if (jaAgendado) {
        const onde = jaAgendado.labor === "FULL_D1" ? "FULL D+1" : NOME_LABOR[jaAgendado.labor] || jaAgendado.labor;
        return errorResponse(res, `${colaborador.nomeCompleto} já está pré-alocado neste turno (${onde}). Remova a pré-alocação antes de mudar.`, 400);
      }
    }

    const criada = await prisma.mapaAlocacaoAgendada.create({
      data: {
        idEstacao,
        idEsteira: ehFull ? null : Number(idEsteira),
        labor,
        opsId: ehDiarista ? null : opsId,
        diarista: ehDiarista,
        diaOperacional: dia,
        turno,
        idUsuario: req.user?.id ?? null,
      },
    });
    return createdResponse(res, criada, "Pré-alocação registrada. A pessoa entra sozinha quando o turno começar.");
  } catch (err) {
    console.error("❌ Erro ao agendar alocação:", err);
    return errorResponse(res, "Erro ao registrar pré-alocação", 500);
  }
};

/** GET /agendadas?data=&turno=&idEsteira= | &full=true */
const listarAgendadas = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const atual = getTurnoOperacionalAtual();
    const data = req.query.data || atual.diaOperacionalStr;
    const turno = req.query.turno || atual.turno;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !TURNOS.includes(turno)) return errorResponse(res, "Informe o dia e o turno", 400);

    // Quem abre o turno que acabou de começar já vê as pré-alocações viradas em alocação.
    await ativarAgendadasVencidas().catch(() => {});

    const where = { idEstacao, diaOperacional: dataDoDia(data), turno };
    if (req.query.full === "true") where.idEsteira = null;
    else if (req.query.idEsteira) where.idEsteira = Number(req.query.idEsteira);

    const linhas = await prisma.mapaAlocacaoAgendada.findMany({ where, orderBy: { criadoEm: "asc" } });
    const opsIds = [...new Set(linhas.map((l) => l.opsId).filter(Boolean))];
    const colaboradores = opsIds.length ? await prisma.colaborador.findMany({ where: { opsId: { in: opsIds } }, select: colaboradorSelect }) : [];
    const porOps = new Map(colaboradores.map((c) => [c.opsId, c]));

    return successResponse(
      res,
      linhas.map((l) => ({
        idAgendada: l.idAgendada,
        idEsteira: l.idEsteira,
        labor: l.labor,
        diarista: l.diarista,
        status: l.status === "ATIVANDO" ? "PENDENTE" : l.status,
        motivoFalha: l.motivoFalha,
        colaborador: l.opsId ? porOps.get(l.opsId) || { opsId: l.opsId, nomeCompleto: l.opsId, cargo: null } : null,
      }))
    );
  } catch (err) {
    console.error("❌ Erro ao listar pré-alocações:", err);
    return errorResponse(res, "Erro ao listar pré-alocações", 500);
  }
};

/** DELETE /agendadas/:idAgendada — só enquanto estiver pendente. */
const removerAgendada = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { count } = await prisma.mapaAlocacaoAgendada.deleteMany({ where: { idAgendada: req.params.idAgendada, idEstacao, status: "PENDENTE" } });
    if (!count) return notFoundResponse(res, "Pré-alocação pendente não encontrada (talvez o turno já tenha começado)");
    return successResponse(res, null, "Pré-alocação removida");
  } catch (err) {
    console.error("❌ Erro ao remover pré-alocação:", err);
    return errorResponse(res, "Erro ao remover pré-alocação", 500);
  }
};

module.exports = { agendarAlocacao, listarAgendadas, removerAgendada };
