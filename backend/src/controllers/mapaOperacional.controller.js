const { prisma } = require("../config/database");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");
const { getAutoAlocacoesEsteira, getPessoasAtivasFullD1, codigosDaEsteira } = require("../services/mapaOperacional/workstationSheets.service");
const { getProdutividadeHoraAtual } = require("../services/mapaOperacional/productivitySheets.service");
const {
  validarColaboradorElegivel,
  buscarColaboradoresElegiveis,
  CONTEXTOS,
} = require("../services/mapaOperacional/colaboradorElegibilidade.service");
const { encerrarAlocacoesManuaisDeDiasAnteriores } = require("../services/mapaOperacional/viradaDiaOperacional.service");
const { avaliarConflitoAlocacao } = require("../services/mapaOperacional/alocacaoConflito.service");
const { saldoDiaristasFuturo, ativarAgendadasVencidas } = require("../services/mapaOperacional/alocacaoAgendada.service");
const { partesSP, getTurnoOperacionalAtual, getJanelaTurno, formatDataHora } = require("../utils/turnoMapaOperacional");

function turnoParaId(turno) {
  return turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
}

// Labors manuais que não são vinculados a um braço/lado específico — a
// pessoa fica alocada "na esteira" pra essa função, não numa posição física
// do desenho. Mesmas opções em toda esteira. PACKING (e os labors de doca,
// fora deste controller) continuam exigindo braço/lado.
const LABORS_MANUAIS_SEM_BRACO = [
  "PESCA",
  "GOL",
  "ENDERECAMENTO",
  "INDUCAO",
  "ABASTECEDOR",
  "MONTAGEM_SCUTTLE",
  "VOLANTE",
  "LOG_II",
];

/**
 * Resolve turno/dia pedidos na query (?turno=&data=) ou cai no turno/dia
 * operacional atual. Também informa se é o turno "ao vivo" (atual) ou um
 * turno passado (histórico, só reconstrutível a partir de MapaAlocacao).
 */
function resolverTurnoRequisicao(req) {
  const atual = getTurnoOperacionalAtual();
  const turno = req.query.turno || atual.turno;
  const diaOperacionalStr = req.query.data || atual.diaOperacionalStr;
  const isAtual = turno === atual.turno && diaOperacionalStr === atual.diaOperacionalStr;
  return { turno, diaOperacionalStr, isAtual, atual };
}

/* =====================================================
   TURNO ATUAL (pro seletor do front saber o default)
===================================================== */
const obterTurnoAtual = async (req, res) => {
  const { turno, diaOperacional, diaOperacionalStr } = getTurnoOperacionalAtual();
  return successResponse(res, { turno, diaOperacional, diaOperacionalStr });
};

/* =====================================================
   ESTEIRAS (config + braços)
===================================================== */
const listarEsteiras = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;

    const esteiras = await prisma.mapaEsteira.findMany({
      where: { idEstacao, ativo: true },
      include: {
        bracos: { orderBy: [{ numero: "asc" }, { lado: "asc" }] },
      },
      orderBy: { ordem: "asc" },
    });

    return successResponse(res, esteiras);
  } catch (err) {
    console.error("❌ Erro ao listar esteiras:", err);
    return errorResponse(res, "Erro ao listar esteiras", 500);
  }
};

async function buscarEsteiraDaEstacao(idEsteira, idEstacao) {
  return prisma.mapaEsteira.findFirst({
    where: { idEsteira: Number(idEsteira), idEstacao },
  });
}

/* =====================================================
   PRODUÇÃO DO TURNO (acumulada — soma das horas já persistidas)
===================================================== */
const obterProducaoTurno = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira } = req.params;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    const { turno, diaOperacionalStr } = resolverTurnoRequisicao(req);
    const [y, m, d] = diaOperacionalStr.split("-").map(Number);
    const dataOperacional = new Date(y, m - 1, d);

    const codigos = codigosDaEsteira(esteira.nome);
    const registros = codigos.length
      ? await prisma.mapaWorkstationProducaoTurno.findMany({
          where: { codigoEstacao: { in: codigos }, dataOperacional, turno },
        })
      : [];

    const producaoAcumulada = registros.reduce(
      (s, r) => s + Math.max(r.throughputAtual - r.throughputBase, 0),
      0
    );
    return successResponse(res, { producaoAcumulada, codigosRegistrados: registros.length });
  } catch (err) {
    console.error("❌ Erro ao obter produção do turno:", err);
    return errorResponse(res, "Erro ao obter produção do turno", 500);
  }
};

/* =====================================================
   ALOCAÇÕES (packing/labor de esteira)
===================================================== */
const listarAlocacoes = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira } = req.params;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
    const { turno, diaOperacionalStr, isAtual } = resolverTurnoRequisicao(req);
    if (isAtual) await ativarAgendadasVencidas().catch(() => {}); // turno que acabou de começar já mostra as pré-alocações

    const where = isAtual
      ? // No turno ao vivo, o automático vem de listarAutoAlocacoes (lido direto
        // da planilha, com produtividade/rank em tempo real) — aqui só as
        // manuais/diaristas, senão duplicaria quem já aparece por lá.
        { idEsteira: esteira.idEsteira, fim: null, origem: "MANUAL" }
      : (() => {
          const janela = getJanelaTurno(diaOperacionalStr, turno);
          return {
            idEsteira: esteira.idEsteira,
            inicio: { lt: janela.fim },
            OR: [{ fim: null }, { fim: { gt: janela.inicio } }],
          };
        })();

    const linhas = await prisma.mapaAlocacao.findMany({
      where,
      include: {
        colaborador: {
          select: {
            opsId: true,
            nomeCompleto: true,
            cargo: { select: { nomeCargo: true } },
          },
        },
      },
      orderBy: [{ braco: "asc" }, { lado: "asc" }, { inicio: "asc" }],
    });

    if (isAtual) return successResponse(res, linhas);

    // Histórico: agrupa as linhas de origem AUTO por braço/lado no mesmo
    // formato da visão ao vivo (totalColaboradores + lista) — senão o front
    // só mostraria a última pessoa de cada braço, reproduzindo o mesmo bug
    // de "uma pessoa por braço" que já corrigimos pra visão ao vivo.
    const manuais = linhas.filter((l) => l.origem !== "AUTO");
    const autos = linhas.filter((l) => l.origem === "AUTO");

    const autosPorBraco = new Map();
    autos.forEach((l) => {
      const chave = `${l.braco}-${l.lado}`;
      if (!autosPorBraco.has(chave)) autosPorBraco.set(chave, []);
      autosPorBraco.get(chave).push(l);
    });

    const autosAgrupados = [...autosPorBraco.values()].map((linhasBraco) => ({
      idEsteira: esteira.idEsteira,
      braco: linhasBraco[0].braco,
      lado: linhasBraco[0].lado,
      origem: "AUTO",
      totalColaboradores: linhasBraco.length,
      colaboradores: linhasBraco.map((l) => ({
        opsId: l.opsId,
        colaborador: l.colaborador,
        checkIn: formatDataHora(l.inicio),
        checkOut: l.fim ? formatDataHora(l.fim) : null,
      })),
    }));

    return successResponse(res, [...manuais, ...autosAgrupados]);
  } catch (err) {
    console.error("❌ Erro ao listar alocações:", err);
    return errorResponse(res, "Erro ao listar alocações", 500);
  }
};

/* =====================================================
   AUTO-ALOCAÇÕES (quem está logado na Workstation agora,
   cruzado com a produtividade real da hora atual)
===================================================== */
const listarAutoAlocacoes = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira } = req.params;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    // Workstation só dá a foto de agora — não tem como reconstruir um turno
    // passado, então só retorna dado quando o turno pedido é o atual (ao vivo).
    const { turno, isAtual } = resolverTurnoRequisicao(req);
    if (!isAtual) return successResponse(res, []);

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
    const grupos = await getAutoAlocacoesEsteira(esteira.nome);
    if (grupos.length === 0) return successResponse(res, []);

    // Manual tem prioridade sobre automático — não mostra auto num braço/lado
    // que já tem alguém alocado manualmente ali. Filtra origem: "MANUAL" aqui
    // porque o job de sync agora também grava as auto-alocações como
    // MapaAlocacao (fim: null enquanto ativas) pra viabilizar histórico — sem
    // esse filtro, toda auto-alocação já persistida se contaria como "coberta
    // por manual" e sumiria da visão ao vivo.
    const manuais = await prisma.mapaAlocacao.findMany({
      where: { idEsteira: esteira.idEsteira, fim: null, origem: "MANUAL", labor: "PACKING" },
      select: { braco: true, lado: true },
    });
    const cobertoPorManual = new Set(manuais.map((m) => `${m.braco}-${m.lado}`));

    const gruposLivres = grupos.filter((g) => !cobertoPorManual.has(`${g.braco}-${g.lado}`));
    if (gruposLivres.length === 0) return successResponse(res, []);

    const opsIds = [...new Set(gruposLivres.flatMap((g) => g.pessoas.map((p) => p.opsId)))];
    const colaboradores = await prisma.colaborador.findMany({
      where: { opsId: { in: opsIds } },
      select: {
        opsId: true,
        nomeCompleto: true,
        cargo: { select: { nomeCargo: true } },
        turno: { select: { nomeTurno: true } },
      },
    });
    const colaboradorPorOpsId = new Map(colaboradores.map((c) => [c.opsId, c]));

    // O horário de check-in não importa pra decidir o turno — alguém pode logar
    // uns minutos antes do início oficial do turno e continua sendo daquele
    // turno. O que importa é o turno cadastrado do colaborador: só é excluído
    // da visão automática se o cadastro apontar um turno DIFERENTE do turno
    // sendo visualizado agora. Sem turno cadastrado (ou colaborador não
    // encontrado) não é motivo pra esconder — nesse caso, mantém.
    function pertenceAoTurno(p) {
      const colaborador = colaboradorPorOpsId.get(p.opsId);
      const turnoCadastrado = colaborador?.turno?.nomeTurno;
      return !turnoCadastrado || turnoCadastrado === turno;
    }

    const horaAtual = partesSP().hora;

    const resultado = (
      await Promise.all(
        gruposLivres.map(async (g) => {
          const pessoasDoTurno = g.pessoas.filter(pertenceAoTurno);
          if (pessoasDoTurno.length === 0) return null;

          const comProdutividade = await Promise.all(
            pessoasDoTurno.map(async (p) => {
              const produtividade = await getProdutividadeHoraAtual(p.opsId, horaAtual);
              return {
                opsId: p.opsId,
                colaborador: colaboradorPorOpsId.get(p.opsId) || { opsId: p.opsId, nomeCompleto: p.nome, cargo: null },
                checkIn: p.checkIn,
                producaoHoraAtual: produtividade.producaoHoraAtual,
                efficiencyTotal: produtividade.efficiencyTotal,
                produtividadeEncontrada: produtividade.encontrado,
              };
            })
          );
          // Rank: do mais produtivo (na hora atual) pro menos, dentro do mesmo braço.
          const ranking = [...comProdutividade].sort((a, b) => b.producaoHoraAtual - a.producaoHoraAtual);
          ranking.forEach((p, i) => { p.posicaoRank = i + 1; });

          return {
            idEsteira: esteira.idEsteira,
            braco: g.braco,
            lado: g.lado,
            origem: "AUTO",
            totalColaboradores: ranking.length,
            producaoHoraAtualTotal: ranking.reduce((s, p) => s + p.producaoHoraAtual, 0),
            efficiencyTotalSoma: ranking.reduce((s, p) => s + p.efficiencyTotal, 0),
            colaboradores: ranking,
          };
        })
      )
    ).filter(Boolean);

    return successResponse(res, resultado);
  } catch (err) {
    console.error("❌ Erro ao listar auto-alocações:", err);
    return errorResponse(res, "Erro ao listar auto-alocações", 500);
  }
};

/* =====================================================
   FULL D+1 — pool compartilhado (não é grid de braços)
===================================================== */
const listarFullD1 = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { turno, diaOperacionalStr, isAtual } = resolverTurnoRequisicao(req);

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
    if (isAtual) await ativarAgendadasVencidas().catch(() => {}); // turno que acabou de começar já mostra as pré-alocações

    if (!isAtual) {
      const janela = getJanelaTurno(diaOperacionalStr, turno);
      const linhas = await prisma.mapaAlocacao.findMany({
        where: {
          idEstacao,
          labor: "FULL_D1",
          inicio: { lt: janela.fim },
          OR: [{ fim: null }, { fim: { gt: janela.inicio } }],
        },
        include: {
          colaborador: { select: { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } } },
        },
        orderBy: { inicio: "asc" },
      });
      const pessoasHistorico = linhas.map((l) => ({
        opsId: l.opsId,
        colaborador: l.colaborador,
        origem: l.origem,
        diarista: l.diarista,
        idAlocacao: l.idAlocacao,
        checkIn: formatDataHora(l.inicio),
        checkOut: l.fim ? formatDataHora(l.fim) : null,
      }));
      // Quem esteve no FULL D+1 por sinergia interna nesse turno (chegada confirmada).
      const sinergiasHistorico = await prisma.sinergiaInterna.findMany({
        where: {
          idEstacao,
          areaDestino: { codigo: "FULL_D1" },
          dataChegada: { not: null, lt: janela.fim },
          status: { in: ["SINERGIA_ATIVA", "AGUARDANDO_RETORNO", "FINALIZADA"] },
          OR: [{ dataFinalizacao: null }, { dataFinalizacao: { gt: janela.inicio } }],
        },
        include: {
          colaborador: { select: { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } } },
          areaOrigem: { select: { nome: true } },
        },
        orderBy: { dataChegada: "asc" },
      });
      sinergiasHistorico.forEach((s) =>
        pessoasHistorico.push({
          opsId: s.opsId,
          colaborador: s.colaborador,
          origem: "SINERGIA",
          sinergia: { origem: s.areaOrigem.nome, retornoPendente: s.status === "AGUARDANDO_RETORNO" },
          checkIn: formatDataHora(s.dataChegada),
          checkOut: s.dataFinalizacao ? formatDataHora(s.dataFinalizacao) : null,
        })
      );
      return successResponse(res, { total: pessoasHistorico.length, pessoas: pessoasHistorico });
    }

    const pessoas = await getPessoasAtivasFullD1();

    const opsIds = [...new Set(pessoas.map((p) => p.opsId))];
    const colaboradores = opsIds.length
      ? await prisma.colaborador.findMany({
          where: { opsId: { in: opsIds } },
          select: {
            opsId: true,
            nomeCompleto: true,
            cargo: { select: { nomeCargo: true } },
            turno: { select: { nomeTurno: true } },
          },
        })
      : [];
    const colaboradorPorOpsId = new Map(colaboradores.map((c) => [c.opsId, c]));

    const horaAtual = partesSP().hora;
    const semDuplicar = new Map();
    pessoas.forEach((p) => semDuplicar.set(p.opsId, p));

    // Mesma regra da auto-alocação de esteira: só exclui se o turno cadastrado
    // do colaborador for DIFERENTE do turno atual — sem cadastro, mantém.
    const doTurnoAtual = [...semDuplicar.values()].filter((p) => {
      const turnoCadastrado = colaboradorPorOpsId.get(p.opsId)?.turno?.nomeTurno;
      return !turnoCadastrado || turnoCadastrado === turno;
    });

    const automaticos = await Promise.all(
      doTurnoAtual.map(async (p) => {
        const produtividade = await getProdutividadeHoraAtual(p.opsId, horaAtual);
        return {
          opsId: p.opsId,
          colaborador: colaboradorPorOpsId.get(p.opsId) || { opsId: p.opsId, nomeCompleto: p.nome, cargo: null },
          origem: "AUTO",
          producaoHoraAtual: produtividade.producaoHoraAtual,
          efficiencyTotal: produtividade.efficiencyTotal,
        };
      })
    );

    // Alocações manuais (lançadas por aqui). Quem também está logado na
    // Workstation já aparece acima, com produção — não conta duas vezes.
    const jaNoPool = new Set(automaticos.map((a) => a.opsId));
    const manuaisAbertas = await prisma.mapaAlocacao.findMany({
      where: { idEstacao, labor: "FULL_D1", origem: "MANUAL", fim: null },
      include: {
        colaborador: { select: { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } } },
      },
      orderBy: { inicio: "asc" },
    });
    const manuais = manuaisAbertas
      .filter((m) => m.diarista || !jaNoPool.has(m.opsId))
      .map((m) => ({
        opsId: m.opsId,
        colaborador: m.colaborador,
        origem: "MANUAL",
        diarista: m.diarista,
        idAlocacao: m.idAlocacao,
        checkIn: formatDataHora(m.inicio),
        producaoHoraAtual: null,
        efficiencyTotal: null,
      }));

    // Quem está no FULL D+1 por sinergia interna (já chegou; ainda não confirmou o retorno).
    const jaListados = new Set([...automaticos, ...manuais].map((p) => p.opsId).filter(Boolean));
    const sinergiasAtivas = await prisma.sinergiaInterna.findMany({
      where: { idEstacao, areaDestino: { codigo: "FULL_D1" }, status: { in: ["SINERGIA_ATIVA", "AGUARDANDO_RETORNO"] } },
      include: {
        colaborador: { select: { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } } },
        areaOrigem: { select: { nome: true } },
      },
      orderBy: { dataChegada: "asc" },
    });
    const porSinergia = sinergiasAtivas
      .filter((s) => !jaListados.has(s.opsId))
      .map((s) => ({
        opsId: s.opsId,
        colaborador: s.colaborador,
        origem: "SINERGIA",
        sinergia: { origem: s.areaOrigem.nome, retornoPendente: s.status === "AGUARDANDO_RETORNO" },
        checkIn: formatDataHora(s.dataChegada),
        producaoHoraAtual: null,
        efficiencyTotal: null,
      }));

    const resultado = [...automaticos, ...manuais, ...porSinergia];

    return successResponse(res, { total: resultado.length, pessoas: resultado });
  } catch (err) {
    console.error("❌ Erro ao listar FULL D+1:", err);
    return errorResponse(res, "Erro ao listar FULL D+1", 500);
  }
};

/* =====================================================
   FULL D+1 — alocação manual (quem não aparece pela Workstation)
===================================================== */
const criarAlocacaoFullD1 = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { opsId, diarista } = req.body;
    const isDiarista = !!diarista;

    if (!isDiarista && !opsId) {
      return errorResponse(res, "Informe o colaborador (opsId) ou marque diarista", 400);
    }

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);

    if (!isDiarista) {
      const { colaborador, erro } = await validarColaboradorElegivel(opsId, { contexto: "ESTEIRA" });
      if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");
      if (erro) return errorResponse(res, erro, 400);

      // Já no pool (manual ou automático persistido, ou logado agora na Workstation)?
      const jaAlocado = await prisma.mapaAlocacao.findFirst({ where: { idEstacao, opsId, labor: "FULL_D1", fim: null } });
      const logadoAgora = (await getPessoasAtivasFullD1()).some((p) => p.opsId === opsId);
      if (jaAlocado || logadoAgora) {
        return errorResponse(res, `${colaborador.nomeCompleto} já está no FULL D+1`, 400);
      }
    } else {
      const { diaOperacional, turno: turnoAtual } = getTurnoOperacionalAtual();
      const saldo = await calcularSaldoDiaristas(idEstacao, diaOperacional, turnoAtual);
      if (saldo.disponiveis <= 0) {
        return errorResponse(
          res,
          `Não há diaristas disponíveis — ${saldo.total} lançados no Daily Works e ${saldo.alocados} já alocados neste turno.`,
          400
        );
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // uma pessoa só pode estar em um lugar por vez
      if (!isDiarista) {
        await tx.mapaAlocacao.updateMany({ where: { opsId, fim: null }, data: { fim: now } });
      }
      await tx.mapaAlocacao.create({
        data: {
          idEstacao,
          idEsteira: null,
          braco: null,
          lado: null,
          labor: "FULL_D1",
          origem: "MANUAL",
          opsId: isDiarista ? null : opsId,
          diarista: isDiarista,
        },
      });
    });

    return successResponse(res, null, "Alocação registrada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao alocar no FULL D+1:", err);
    return errorResponse(res, "Erro ao alocar no FULL D+1", 500);
  }
};

const removerAlocacaoFullD1 = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idAlocacao } = req.params;

    const alocacao = await prisma.mapaAlocacao.findFirst({
      where: { idAlocacao, idEstacao, labor: "FULL_D1", origem: "MANUAL", fim: null },
    });
    if (!alocacao) return notFoundResponse(res, "Alocação manual ativa não encontrada");

    await prisma.mapaAlocacao.update({ where: { idAlocacao }, data: { fim: new Date() } });
    return successResponse(res, null, "Alocação encerrada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao encerrar alocação do FULL D+1:", err);
    return errorResponse(res, "Erro ao encerrar alocação", 500);
  }
};

const criarAlocacao = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira } = req.params;
    const { braco, lado, opsId, diarista, labor = "PACKING", confirmarSubstituicao = false } = req.body;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    const exigeBraco = !LABORS_MANUAIS_SEM_BRACO.includes(labor);
    // Pesca fica em um braço (e é movida entre eles), mas pode entrar sem posição.
    const pescaComBraco = labor === "PESCA" && !!braco && !!lado;
    const usaBraco = exigeBraco || pescaComBraco;

    if (labor === "PESCA" && (!!braco !== !!lado)) {
      return errorResponse(res, "Informe o braço e o lado", 400);
    }

    if (usaBraco) {
      if (!braco || !lado) {
        return errorResponse(res, "Informe o braço e o lado", 400);
      }

      const erroBraco = await validarBracoDaEsteira(esteira.idEsteira, braco, lado);
      if (erroBraco) return erroBraco.status === 404 ? notFoundResponse(res, erroBraco.mensagem) : errorResponse(res, erroBraco.mensagem, 400);
    }

    const isDiarista = !!diarista;

    if (!isDiarista && !opsId) {
      return errorResponse(res, "Informe o colaborador (opsId) ou marque diarista", 400);
    }

    let colaborador = null;
    if (!isDiarista) {
      const { colaborador: encontrado, erro } = await validarColaboradorElegivel(opsId, { contexto: "ESTEIRA" });
      if (!encontrado) return notFoundResponse(res, "Colaborador não encontrado");
      if (erro) return errorResponse(res, erro, 400);
      colaborador = encontrado;

      await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
      // packing automático e outras esteiras/docas bloqueiam; outra função na mesma esteira pede confirmação do líder
      const conflito = await avaliarConflitoAlocacao({ colaborador, esteira, labor, braco, lado });
      if (conflito) {
        const precisaConfirmar = conflito.codigo === "CONFIRMAR_SUBSTITUICAO";
        if (!precisaConfirmar || !confirmarSubstituicao) {
          return errorResponse(res, conflito.mensagem, precisaConfirmar ? 409 : 400, { codigo: conflito.codigo, atual: conflito.atual });
        }
      }
    } else {
      const { diaOperacional, turno: turnoAtual } = getTurnoOperacionalAtual();
      const saldo = await calcularSaldoDiaristas(idEstacao, diaOperacional, turnoAtual);
      if (saldo.disponiveis <= 0) {
        return errorResponse(
          res,
          `Não há diaristas disponíveis — ${saldo.total} lançados no Daily Works e ${saldo.alocados} já alocados neste turno.`,
          400
        );
      }
    }

    const now = new Date();

    await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
    await prisma.$transaction(async (tx) => {
      // uma pessoa só pode estar em um lugar por vez
      if (!isDiarista) {
        await tx.mapaAlocacao.updateMany({
          where: { opsId, fim: null },
          data: { fim: now },
        });
      }

      // um braço/lado só pode ter uma alocação ativa por vez (não se aplica
      // aos labors sem braço, onde várias pessoas dividem a mesma função)
      if (exigeBraco) {
        await tx.mapaAlocacao.updateMany({
          where: { idEsteira: esteira.idEsteira, braco: Number(braco), lado: String(lado).toUpperCase(), fim: null, labor: { notIn: ["PESCA"] } },
          data: { fim: now },
        });
      }

      await tx.mapaAlocacao.create({
        data: {
          idEstacao,
          idEsteira: esteira.idEsteira,
          braco: usaBraco ? Number(braco) : null,
          lado: usaBraco ? String(lado).toUpperCase() : null,
          labor,
          origem: "MANUAL",
          opsId: isDiarista ? null : opsId,
          diarista: isDiarista,
          idUsuario: req.user?.id ?? null,
        },
      });
    });

    const alocacoes = await prisma.mapaAlocacao.findMany({
      where: { idEsteira: esteira.idEsteira, fim: null },
      include: {
        colaborador: {
          select: { opsId: true, nomeCompleto: true, cargo: { select: { nomeCargo: true } } },
        },
      },
    });

    return successResponse(res, alocacoes, "Alocação registrada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao criar alocação:", err);
    return errorResponse(res, "Erro ao criar alocação", 500);
  }
};

const removerAlocacao = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira, idAlocacao } = req.params;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    const alocacao = await prisma.mapaAlocacao.findFirst({
      where: { idAlocacao, idEsteira: esteira.idEsteira, fim: null },
    });
    if (!alocacao) return notFoundResponse(res, "Alocação ativa não encontrada");

    await prisma.mapaAlocacao.update({
      where: { idAlocacao },
      data: { fim: new Date() },
    });

    return successResponse(res, null, "Alocação encerrada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao remover alocação:", err);
    return errorResponse(res, "Erro ao remover alocação", 500);
  }
};

/* =====================================================
   PESCA: movimentação entre braços (kanban) + rastreabilidade
===================================================== */
async function validarBracoDaEsteira(idEsteira, braco, lado) {
  const config = await prisma.mapaEsteiraBraco.findFirst({
    where: { idEsteira, numero: Number(braco), lado: String(lado).toUpperCase() },
  });
  if (!config) return { status: 404, mensagem: "Braço não encontrado nesta esteira" };
  if (!config.habilitado) return { status: 400, mensagem: "Este braço está desabilitado" };
  return null;
}

/**
 * Move uma Pesca para outro braço (ou para "sem braço", com braco/lado nulos).
 * Não edita a linha: encerra a atual e abre uma nova — o conjunto de linhas é o
 * histórico (quem, de onde, para onde, quando).
 */
const moverAlocacao = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira, idAlocacao } = req.params;
    const { braco, lado } = req.body;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    const destinoDefinido = !!braco && !!lado;
    if (!destinoDefinido && (braco || lado)) return errorResponse(res, "Informe o braço e o lado", 400);

    const atual = await prisma.mapaAlocacao.findFirst({
      where: { idAlocacao, idEsteira: esteira.idEsteira, fim: null, origem: "MANUAL" },
    });
    if (!atual) return errorResponse(res, "Esta pesca já foi movida ou encerrada por outra pessoa. Atualize a tela.", 409);
    if (atual.labor !== "PESCA") return errorResponse(res, "Somente a Pesca pode ser movida entre braços", 400);

    const novoBraco = destinoDefinido ? Number(braco) : null;
    const novoLado = destinoDefinido ? String(lado).toUpperCase() : null;
    if (atual.braco === novoBraco && atual.lado === novoLado) {
      return errorResponse(res, "A pesca já está nesta posição", 400);
    }

    if (destinoDefinido) {
      const erroBraco = await validarBracoDaEsteira(esteira.idEsteira, novoBraco, novoLado);
      if (erroBraco) return erroBraco.status === 404 ? notFoundResponse(res, erroBraco.mensagem) : errorResponse(res, erroBraco.mensagem, 400);
    }

    const now = new Date();
    const movida = await prisma.$transaction(async (tx) => {
      // condicional: se outra pessoa já moveu/encerrou esta alocação, não duplica
      const fechada = await tx.mapaAlocacao.updateMany({ where: { idAlocacao, fim: null }, data: { fim: now } });
      if (fechada.count === 0) return null;
      return tx.mapaAlocacao.create({
        data: {
          idEstacao,
          idEsteira: esteira.idEsteira,
          braco: novoBraco,
          lado: novoLado,
          labor: "PESCA",
          origem: "MANUAL",
          opsId: atual.opsId,
          diarista: atual.diarista,
          idUsuario: req.user?.id ?? null,
          inicio: now,
        },
      });
    });
    if (!movida) return errorResponse(res, "Esta pesca já foi movida ou encerrada por outra pessoa. Atualize a tela.", 409);

    return successResponse(res, movida, "Pesca movida com sucesso");
  } catch (err) {
    console.error("❌ Erro ao mover alocação:", err);
    return errorResponse(res, "Erro ao mover alocação", 500);
  }
};

/** Log das pescas do dia operacional (cada linha = uma passagem por um braço). */
const listarMovimentacoesPesca = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idEsteira } = req.params;

    const esteira = await buscarEsteiraDaEstacao(idEsteira, idEstacao);
    if (!esteira) return notFoundResponse(res, "Esteira não encontrada");

    const { diaOperacionalStr } = resolverTurnoRequisicao(req);
    const inicioDia = getJanelaTurno(diaOperacionalStr, "T1").inicio;

    const linhas = await prisma.mapaAlocacao.findMany({
      where: { idEsteira: esteira.idEsteira, labor: "PESCA", origem: "MANUAL", inicio: { gte: inicioDia } },
      orderBy: { inicio: "desc" },
      take: 300,
      include: { colaborador: { select: { opsId: true, nomeCompleto: true } } },
    });

    const idsUsuario = [...new Set(linhas.map((l) => l.idUsuario).filter(Boolean))];
    const usuarios = idsUsuario.length
      ? await prisma.user.findMany({ where: { id: { in: idsUsuario } }, select: { id: true, name: true } })
      : [];
    const nomePorId = new Map(usuarios.map((u) => [u.id, u.name]));

    return successResponse(
      res,
      linhas.map((l) => ({
        idAlocacao: l.idAlocacao,
        opsId: l.opsId,
        nome: l.colaborador?.nomeCompleto ?? (l.diarista ? "Diarista" : l.opsId),
        diarista: l.diarista,
        braco: l.braco,
        lado: l.lado,
        inicio: l.inicio,
        fim: l.fim,
        registradoPor: l.idUsuario ? nomePorId.get(l.idUsuario) ?? null : null,
      }))
    );
  } catch (err) {
    console.error("❌ Erro ao listar movimentações de pesca:", err);
    return errorResponse(res, "Erro ao listar movimentações", 500);
  }
};

/* =====================================================
   DIARISTAS DISPONÍVEIS (saldo do Daily Works)
===================================================== */
async function calcularSaldoDiaristas(idEstacao, dataOperacional, turnoAtual) {
  const idTurno = turnoParaId(turnoAtual);

  await encerrarAlocacoesManuaisDeDiasAnteriores(idEstacao);
  const dataInicioDia = new Date(dataOperacional);
  dataInicioDia.setHours(0, 0, 0, 0);

  const lancados = await prisma.dwReal.aggregate({
    where: { idEstacao, idTurno, data: dataInicioDia },
    _sum: { quantidade: true },
  });
  const total = lancados._sum.quantidade || 0;

  const alocados = await prisma.mapaAlocacao.count({
    where: { idEstacao, diarista: true, fim: null },
  });

  return { total, alocados, disponiveis: Math.max(total - alocados, 0) };
}

/* =====================================================
   BUSCA DE COLABORADORES ELEGÍVEIS (turno + presença + setor)
===================================================== */
const buscarElegiveis = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { contexto, turno, search, semPresenca } = req.query;
    if (!CONTEXTOS[contexto]) return errorResponse(res, "Contexto inválido", 400);

    const colaboradores = await buscarColaboradoresElegiveis({ idEstacao, contexto, turno, search, semPresenca: semPresenca === "true" });
    return successResponse(res, colaboradores);
  } catch (err) {
    console.error("❌ Erro ao buscar colaboradores elegíveis:", err);
    return errorResponse(res, "Erro ao buscar colaboradores", 500);
  }
};

const diaristasDisponiveis = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    // ?turno=&data= de um turno futuro (pré-alocação): saldo do Daily Works daquele turno.
    const { data, turno } = req.query;
    if (data && turno) {
      return successResponse(res, await saldoDiaristasFuturo(idEstacao, data, turno));
    }

    const { diaOperacional, turno: turnoAtual } = getTurnoOperacionalAtual();

    const saldo = await calcularSaldoDiaristas(idEstacao, diaOperacional, turnoAtual);

    return successResponse(res, { ...saldo, turno: turnoAtual });
  } catch (err) {
    console.error("❌ Erro ao calcular saldo de diaristas:", err);
    return errorResponse(res, "Erro ao calcular saldo de diaristas", 500);
  }
};

module.exports = {
  obterTurnoAtual,
  listarEsteiras,
  listarAlocacoes,
  listarAutoAlocacoes,
  listarFullD1,
  obterProducaoTurno,
  calcularSaldoDiaristas,
  buscarElegiveis,
  criarAlocacao,
  removerAlocacao,
  moverAlocacao,
  listarMovimentacoesPesca,
  criarAlocacaoFullD1,
  removerAlocacaoFullD1,
  diaristasDisponiveis,
};
