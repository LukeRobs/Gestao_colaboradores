const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const { getTurnoOperacionalAtual, getJanelaTurno } = require("../utils/turnoMapaOperacional");
const { getPlanejamentoHc } = require("../services/mapaOperacional/planejamentoHcSheets.service");
const { FILTRO_CARGO_PRISMA } = require("../services/mapaOperacional/colaboradorElegibilidade.service");
const { encerrarAlocacoesManuaisDeDiasAnteriores } = require("../services/mapaOperacional/viradaDiaOperacional.service");

const TURNOS = ["T1", "T2", "T3"];

// Na planilha, a "Esteira C" soma o FULL D+1 e a Esteira FULL: o FULL D+1 nunca
// para e fica sempre com até 6 pessoas; o que passar disso é da Esteira FULL
// (ex.: 54 = 6 no FULL D+1 + 48 na Esteira FULL; com 6 ou menos, tudo é FULL D+1).
const HC_FULL_D1 = 6;

const NOME_ESTEIRA = {
  TERMOPLASTICA: "Esteira Termoplástica",
  ESTEIRA_U: "Esteira U",
  LINEAR: "Esteira Linear",
  ESTEIRA_FULL: "Esteira FULL",
};

const AREAS = [
  { id: "TERMOPLASTICA", titulo: "Esteira Termoplástica", tipo: "ESTEIRA" },
  { id: "ESTEIRA_U", titulo: "Esteira U", tipo: "ESTEIRA" },
  { id: "LINEAR", titulo: "Esteira Linear", tipo: "ESTEIRA" },
  { id: "ESTEIRA_FULL", titulo: "Esteira FULL", tipo: "ESTEIRA" },
  { id: "FULL_D1", titulo: "FULL D+1", tipo: "ESTEIRA" },
  { id: "RECEBIMENTO", titulo: "Recebimento", tipo: "OPERACAO" },
  { id: "EXPEDICAO", titulo: "Expedição", tipo: "OPERACAO" },
];

const zeroPorTurno = () => ({ T1: 0, T2: 0, T3: 0 });

/** Traduz as 7 colunas do turno na planilha para o HC planejado de cada card. */
function planejadoDoTurno(p) {
  const c = p.ESTEIRA_C || 0;
  return {
    TERMOPLASTICA: p.TERMOPLASTICA || 0,
    ESTEIRA_U: (p.ESTEIRA_A || 0) + (p.ESTEIRA_B || 0),
    LINEAR: p.LINEAR || 0,
    ESTEIRA_FULL: Math.max(c - HC_FULL_D1, 0),
    FULL_D1: Math.min(c, HC_FULL_D1),
    RECEBIMENTO: p.INBOUND || 0,
    EXPEDICAO: p.OUTBOUND || 0,
  };
}

function turnoDoInstante(instante) {
  return getTurnoOperacionalAtual(new Date(instante)).turno;
}

/**
 * Quem a alocação representa e a qual turno cada um pertence: integrantes do
 * time usam o turno do time; colaborador avulso, o turno cadastrado (sem
 * cadastro, o turno em que a alocação começou); diarista, o turno em que
 * começou.
 */
function membrosDaAlocacao(a) {
  if (a.numeroDoca != null && a.time) {
    return a.time.integrantes.map((i) => ({ chave: i.opsId, turno: a.time.turno }));
  }
  if (a.opsId) {
    return [{ chave: a.opsId, turno: a.colaborador?.turno?.nomeTurno || turnoDoInstante(a.inicio) }];
  }
  return [{ chave: `diarista:${a.idAlocacao}`, turno: turnoDoInstante(a.inicio) }];
}

function areaDaAlocacao(a, idEsteiraParaArea) {
  if (a.numeroDoca != null) {
    if (a.operacaoDoca === "INBOUND") return "RECEBIMENTO";
    if (a.operacaoDoca === "OUTBOUND") return "EXPEDICAO";
    return null;
  }
  if (a.labor === "FULL_D1") return "FULL_D1";
  return idEsteiraParaArea.get(a.idEsteira) || null;
}

const obterPainelExecutivo = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const atual = getTurnoOperacionalAtual();
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.data || "") ? req.query.data : atual.diaOperacionalStr;

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);

    const agora = new Date();
    const janelas = Object.fromEntries(TURNOS.map((t) => [t, getJanelaTurno(dia, t)]));
    const statusTurno = Object.fromEntries(
      TURNOS.map((t) => {
        const j = janelas[t];
        return [t, agora < j.inicio ? "FUTURO" : agora < j.fim ? "ATUAL" : "ENCERRADO"];
      })
    );

    const [planejamentoBruto, esteiras] = await Promise.all([
      getPlanejamentoHc(dia).catch((err) => {
        console.error("❌ Erro ao ler planejamento de HC:", err.message);
        return null;
      }),
      prisma.mapaEsteira.findMany({ where: { idEstacao, ativo: true }, select: { idEsteira: true, nome: true } }),
    ]);

    const idEsteiraParaArea = new Map();
    esteiras.forEach((e) => {
      const area = Object.keys(NOME_ESTEIRA).find((k) => NOME_ESTEIRA[k] === e.nome);
      if (area) idEsteiraParaArea.set(e.idEsteira, area);
    });

    // ---------- Planejado ----------
    const planejadoPorArea = Object.fromEntries(AREAS.map((a) => [a.id, planejamentoBruto ? zeroPorTurno() : null]));
    if (planejamentoBruto) {
      TURNOS.forEach((t) => {
        const p = planejadoDoTurno(planejamentoBruto[t]);
        AREAS.forEach((a) => (planejadoPorArea[a.id][t] = p[a.id]));
      });
    }
    const ladosU = planejamentoBruto
      ? {
          ladoA: Object.fromEntries(TURNOS.map((t) => [t, planejamentoBruto[t].ESTEIRA_A || 0])),
          ladoB: Object.fromEntries(TURNOS.map((t) => [t, planejamentoBruto[t].ESTEIRA_B || 0])),
        }
      : null;

    // ---------- Realizado ----------
    // Turno ENCERRADO: pessoas distintas que passaram pela área no turno.
    // Turno ATUAL: quem está na área AGORA (alocação aberta), igual ao "Total HC" da tela de cada esteira;
    // contar todo mundo que já passou pelo turno inflava o número (quem saiu continuava somando).
    const inicioDia = janelas.T1.inicio;
    const fimDia = janelas.T3.fim;
    const alocacoes = await prisma.mapaAlocacao.findMany({
      where: {
        idEstacao,
        inicio: { lt: fimDia },
        OR: [{ fim: null }, { fim: { gt: inicioDia } }],
      },
      include: {
        colaborador: { select: { turno: { select: { nomeTurno: true } } } },
        time: { include: { integrantes: { select: { opsId: true } } } },
      },
    });

    const porArea = Object.fromEntries(AREAS.map((a) => [a.id, { T1: new Set(), T2: new Set(), T3: new Set() }]));
    const geral = { T1: new Set(), T2: new Set(), T3: new Set() };

    alocacoes.forEach((a) => {
      const area = areaDaAlocacao(a, idEsteiraParaArea);
      if (!area) return;
      const fimEfetivo = a.fim || agora;
      membrosDaAlocacao(a).forEach(({ chave, turno }) => {
        const j = janelas[turno];
        if (!j) return;
        if (statusTurno[turno] === "ATUAL" && a.fim) return; // já saiu: não conta no turno em andamento
        if (!(a.inicio < j.fim && fimEfetivo > j.inicio)) return;
        porArea[area][turno].add(chave);
        geral[turno].add(chave);
      });
    });

    // Recebimento e Expedição: o time ativo é o efetivo da operação no turno. No turno em andamento
    // contam todos os integrantes presentes (P) hoje, estejam ou não numa doca neste instante (a doca é
    // só onde estão trabalhando agora; senão 19 pessoas em time apareciam como 3, as da doca). Os times
    // não guardam histórico de composição, então turnos encerrados seguem só pelas alocações.
    const turnosAtuais = TURNOS.filter((t) => statusTurno[t] === "ATUAL");
    if (turnosAtuais.length) {
      const timesAtivos = await prisma.timeOperacional.findMany({
        where: { idEstacao, ativo: true, turno: { in: turnosAtuais } },
        select: { operacao: true, turno: true, integrantes: { select: { opsId: true } } },
      });
      const opsIdsDosTimes = [...new Set(timesAtivos.flatMap((t) => t.integrantes.map((i) => i.opsId)))];
      const presentesDosTimes = new Set(
        (
          await prisma.frequencia.findMany({
            where: { opsId: { in: opsIdsDosTimes }, dataReferencia: new Date(`${dia}T00:00:00.000Z`), idTipoAusencia: 2 },
            select: { opsId: true },
          })
        ).map((f) => f.opsId)
      );
      timesAtivos.forEach((t) => {
        const area = t.operacao === "INBOUND" ? "RECEBIMENTO" : "EXPEDICAO";
        t.integrantes.forEach(({ opsId }) => {
          if (!presentesDosTimes.has(opsId)) return;
          porArea[area][t.turno].add(opsId);
          geral[t.turno].add(opsId);
        });
      });
    }

    // Sinergia Interna confirmada no destino: a pessoa está LOCALIZADA lá, então conta no HC real
    // da área de destino (e, por já ter saído da origem, deixa de ser contada lá daqui pra frente).
    const AREA_DO_CARD = {
      ESTEIRA_U: "ESTEIRA_U",
      LINEAR: "LINEAR",
      TERMOPLASTICA: "TERMOPLASTICA",
      FULL: "ESTEIRA_FULL",
      FULL_D1: "FULL_D1",
      EXPEDICAO: "EXPEDICAO",
      RECEBIMENTO: "RECEBIMENTO",
    };
    const sinergias = await prisma.sinergiaInterna.findMany({
      where: {
        idEstacao,
        dataChegada: { not: null, lt: fimDia },
        status: { in: ["SINERGIA_ATIVA", "AGUARDANDO_RETORNO", "FINALIZADA"] },
        OR: [{ dataFinalizacao: null }, { dataFinalizacao: { gt: inicioDia } }],
      },
      select: { opsId: true, turno: true, dataChegada: true, dataFinalizacao: true, areaDestino: { select: { codigo: true } } },
    });
    sinergias.forEach((s) => {
      const area = AREA_DO_CARD[s.areaDestino.codigo];
      const j = janelas[s.turno];
      if (!area || !j) return;
      const fimDaPermanencia = s.dataFinalizacao || agora;
      if (!(s.dataChegada < j.fim && fimDaPermanencia > j.inicio)) return;
      if (statusTurno[s.turno] === "ATUAL" && s.dataFinalizacao) return; // já voltou à origem
      porArea[area][s.turno].add(s.opsId);
      geral[s.turno].add(s.opsId);
    });

    const realizadoDe = (conjuntos) =>
      Object.fromEntries(TURNOS.map((t) => [t, statusTurno[t] === "FUTURO" ? null : conjuntos[t].size]));

    // ---------- Presentes (P) por turno ----------
    const presentes = Object.fromEntries(
      await Promise.all(
        TURNOS.map(async (t) => {
          const n = await prisma.colaborador.count({
            where: {
              idEstacao,
              status: "ATIVO",
              turno: { nomeTurno: t },
              cargo: FILTRO_CARGO_PRISMA,
              frequencias: { some: { dataReferencia: new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))), idTipoAusencia: 2 } },
            },
          });
          return [t, statusTurno[t] === "FUTURO" ? null : n];
        })
      )
    );

    // ---------- Cards ----------
    const cards = AREAS.map((a) => {
      const realizado = realizadoDe(porArea[a.id]);
      const card = {
        id: a.id,
        titulo: a.titulo,
        tipo: a.tipo,
        planejado: planejadoPorArea[a.id],
        realizado,
      };
      if (a.id === "ESTEIRA_U") card.lados = ladosU;
      return card;
    });

    const planejadoGeral = planejamentoBruto
      ? Object.fromEntries(TURNOS.map((t) => [t, AREAS.reduce((s, a) => s + planejadoPorArea[a.id][t], 0)]))
      : null;
    cards.unshift({
      id: "GERAL",
      titulo: "Geral Label",
      tipo: "GERAL",
      planejado: planejadoGeral,
      realizado: realizadoDe(geral),
      presentes,
    });

    return successResponse(res, {
      dia,
      diaOperacionalAtual: atual.diaOperacionalStr,
      turnoAtual: atual.turno,
      statusTurno,
      planejamentoEncontrado: !!planejamentoBruto,
      cards,
    });
  } catch (err) {
    console.error("❌ Erro ao montar painel executivo:", err);
    return errorResponse(res, "Erro ao montar painel executivo", 500);
  }
};

module.exports = { obterPainelExecutivo };
