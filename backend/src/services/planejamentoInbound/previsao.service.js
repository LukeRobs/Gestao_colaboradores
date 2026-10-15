const { instanteSP, getTurnoOperacionalAtual } = require("../../utils/turnoMapaOperacional");
const { listarTodas, resumo, observacao, horaSP, iso, ESTACOES } = require("./viagens.service");

/**
 * Previsão de recebimento: cards e curvas de um dia operacional (06:00 às 05:59) da estação, e o mapa da frota.
 * "Previsto" = viagem programada para chegar no dia (pelo ETA planejado), sem as canceladas/no show.
 * "Recebido" = viagem já descarregada. Quem já chegou mas ainda não descarregou conta como pendente ("no pátio").
 */

const HORAS_DO_DIA = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];
const FAIXAS_SPP = ["0–20", "21–30", "31–40", "41–50", "51–60", ">60"];
const TURNOS = ["T1", "T2", "T3"];

const somar = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
const inativa = (v) => v.situacao === "CANCELADA" || v.situacao === "NO_SHOW";

function janelaDoDia(diaStr) {
  const [y, m, d] = diaStr.split("-").map(Number);
  return { inicio: instanteSP(y, m, d, 6).getTime(), fim: instanteSP(y, m, d + 1, 6).getTime() };
}

/** Dia operacional "YYYY-MM-DD" -> o dia seguinte/anterior (n = ±1). */
function somarDias(diaStr, n) {
  const [y, m, d] = diaStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const diaValido = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

function agrega(lista) {
  const recebidos = lista.filter((v) => v.situacao === "RECEBIDA");
  return {
    previstos: lista.length,
    recebidos: recebidos.length,
    pacotesPrevistos: somar(lista, (v) => v.pacotes),
    pacotesRecebidos: somar(recebidos, (v) => v.pacotes),
  };
}

async function previsao(spxStationId, diaQuery, turnoQuery, agora = Date.now()) {
  const r = await listarTodas(spxStationId, agora);
  if (!r) return null;
  const atual = getTurnoOperacionalAtual(new Date(agora));
  const dia = diaValido(diaQuery) ? diaQuery : atual.diaOperacionalStr;
  const { inicio, fim } = janelaDoDia(dia);

  // Turno opcional (T1 06:00–13:59, T2 14:00–21:59, T3 22:00–05:59): tudo abaixo (cards, curvas e pendentes) respeita o filtro.
  const turno = TURNOS.includes(turnoQuery) ? turnoQuery : null;
  const doDia = r.viagens.filter((v) => v.prazoEta >= inicio && v.prazoEta < fim && (!turno || v.turno === turno));
  const ativas = doDia.filter((v) => !inativa(v));
  const recebidas = ativas.filter((v) => v.situacao === "RECEBIDA");
  const pendentes = ativas.filter((v) => v.situacao !== "RECEBIDA");
  const atrasadas = pendentes.filter((v) => v.atrasada);
  const comEta = ativas.filter((v) => v.classeEta);
  const noPrazo = comEta.filter((v) => v.classeEta === "NO_PRAZO").length;

  const informados = somar(ativas, (v) => v.pacotesInformado);
  const totalPacotes = somar(ativas, (v) => v.pacotes);

  const cards = {
    previstos: ativas.length,
    canceladas: doDia.length - ativas.length,
    pacotes: {
      total: totalPacotes,
      informados,
      estimados: totalPacotes - informados,
      viagensEstimadas: ativas.filter((v) => v.pacotesEstimado).length,
      viagensSemVolume: ativas.filter((v) => v.pacotes === 0).length,
    },
    recebidos: { veiculos: recebidas.length, pacotes: somar(recebidas, (v) => v.pacotes) },
    pendentes: {
      veiculos: pendentes.length,
      pacotes: somar(pendentes, (v) => v.pacotes),
      noPatio: pendentes.filter((v) => v.situacao === "NO_PATIO").length,
      emTransito: pendentes.filter((v) => v.situacao === "EM_TRANSITO").length,
      programadas: pendentes.filter((v) => v.situacao === "PROGRAMADA").length,
    },
    atrasados: {
      veiculos: atrasadas.length,
      pacotes: somar(atrasadas, (v) => v.pacotes),
      tendemAtrasar: pendentes.filter((v) => v.tendeAtrasar).length,
    },
    aderencia: {
      pct: comEta.length ? Math.round((noPrazo / comEta.length) * 1000) / 10 : null,
      base: comEta.length,
      noPrazo,
      adiantadas: comEta.filter((v) => v.classeEta === "ADIANTADA").length,
      atrasadas: comEta.filter((v) => v.classeEta === "ATRASADA").length,
    },
  };

  /* ---- curvas ---- */
  const porHora = HORAS_DO_DIA.map((hora) => ({ hora, previstos: 0, recebidos: 0, pacotesPrevistos: 0, pacotesRecebidos: 0 }));
  const idxHora = new Map(porHora.map((h) => [h.hora, h]));
  ativas.forEach((v) => {
    const p = idxHora.get(horaSP(v.prazoEta));
    p.previstos += 1;
    p.pacotesPrevistos += v.pacotes;
    if (v.situacao === "RECEBIDA") {
      const q = idxHora.get(horaSP(v.etaReal || v.descarga || v.prazoEta));
      q.recebidos += 1;
      q.pacotesRecebidos += v.pacotes;
    }
  });

  const porSpp = FAIXAS_SPP.map((faixa, i) => ({
    faixa,
    previstos: somar(ativas, (v) => v.spp?.bandas[i] || 0),
    recebidos: somar(recebidas, (v) => v.spp?.bandas[i] || 0),
  }));

  const porTurno = TURNOS.map((turno) => ({ turno, ...agrega(ativas.filter((v) => v.turno === turno)), pendentes: pendentes.filter((v) => v.turno === turno).length, atrasados: atrasadas.filter((v) => v.turno === turno).length }));

  const agruparPor = (lista, chave) => {
    const m = new Map();
    lista.forEach((v) => {
      const k = chave(v) || "(sem origem)";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(v);
    });
    return [...m.entries()].map(([nome, vs]) => ({ nome, ...agrega(vs) })).sort((a, b) => b.pacotesPrevistos - a.pacotesPrevistos || b.previstos - a.previstos);
  };

  const porTipoOrigem = agruparPor(ativas, (v) => v.tipoOrigem);
  const porFm = agruparPor(ativas.filter((v) => v.tipoOrigem === "FMH"), (v) => v.origem);

  const proximas = [...pendentes].sort((a, b) => a.prazoEta - b.prazoEta).slice(0, 15).map(resumo);

  return {
    estacao: { codigo: r.base.estacao.codigo, nome: r.base.estacao.nome },
    dia,
    turno,
    diaOperacionalAtual: atual.diaOperacionalStr,
    leituraEm: iso(r.base.lidoEm),
    cards,
    curvas: { porHora, porSpp, porTurno, porTipoOrigem, porFm },
    proximas,
    semSpp: ativas.filter((v) => !v.spp || v.spp.tos === 0).length,
  };
}

/** Lista de viagens de um intervalo de dias operacionais (inclusive), para a tela "Viagens". */
async function viagensDoPeriodo(spxStationId, deQuery, ateQuery, agora = Date.now()) {
  const r = await listarTodas(spxStationId, agora);
  if (!r) return null;
  const atual = getTurnoOperacionalAtual(new Date(agora)).diaOperacionalStr;
  let de = diaValido(deQuery) ? deQuery : atual;
  let ate = diaValido(ateQuery) ? ateQuery : de > atual ? de : atual;
  if (de > ate) [de, ate] = [ate, de];
  if (somarDias(de, 45) < ate) de = somarDias(ate, -45); // no máximo 46 dias por consulta
  const ini = janelaDoDia(de).inicio;
  const fim = janelaDoDia(ate).fim;
  const lista = r.viagens.filter((v) => v.prazoEta >= ini && v.prazoEta < fim).sort((a, b) => a.prazoEta - b.prazoEta);
  return { estacao: { codigo: r.base.estacao.codigo, nome: r.base.estacao.nome }, de, ate, diaOperacionalAtual: atual, leituraEm: iso(r.base.lidoEm), viagens: lista.map(resumo) };
}

/** Veículos com telemetria que vão para a estação, com a trilha recente. */
async function mapa(spxStationId, agora = Date.now()) {
  const r = await listarTodas(spxStationId, agora);
  if (!r) return null;
  const { base, viagens } = r;
  const porLh = new Map(viagens.map((v) => [v.lh, v]));
  const itens = [];

  base.telemetria.forEach((obs, lh) => {
    const ultimo = obs[0];
    if (ultimo._meta.destino !== base.estacao.codigo && !porLh.has(lh)) return;
    const v = porLh.get(lh) || null;
    // Posição velha de viagem que nem está na programação é lixo da aba (a telemetria não limpa): fora do mapa.
    if (!v && ultimo.em && agora - ultimo.em > 72 * 3600 * 1000) return;
    itens.push({
      lh,
      lat: ultimo.lat,
      lng: ultimo.lng,
      posicaoEm: iso(ultimo.em),
      idadeMin: ultimo.em ? Math.max(0, Math.round((agora - ultimo.em) / 60000)) : null,
      situacao: v?.situacao || "SEM_PROGRAMACAO",
      atrasada: !!v?.atrasada,
      tendeAtrasar: !!v?.tendeAtrasar,
      origem: v?.origem || ultimo._meta.origem,
      tipoOrigem: v?.tipoOrigem || null,
      veiculo: v?.veiculo || ultimo._meta.tipoVeiculo,
      placas: v?.placas || [],
      motorista: v?.motorista || ultimo._meta.motorista,
      transportadora: v?.transportadora || ultimo._meta.agencia,
      prazoEta: iso(v?.prazoEta),
      pacotes: v?.pacotes || 0,
      pacotesEstimado: !!v?.pacotesEstimado,
      turno: v?.turno || null,
      ultimaLeitura: observacao(ultimo),
      trilha: obs.slice(0, 30).map((o) => [o.lat, o.lng]),
    });
  });

  return {
    estacao: { codigo: base.estacao.codigo, nome: base.estacao.nome, coords: base.estacao.coords },
    leituraEm: iso(base.lidoEm),
    veiculos: itens,
    // Saíram da origem mas a planilha não tem nenhuma posição deles (a telemetria cobre só parte da frota).
    semTelemetria: viagens
      .filter((v) => v.situacao === "EM_TRANSITO" && !base.telemetria.has(v.lh))
      .sort((a, b) => a.prazoEta - b.prazoEta)
      .map(resumo),
  };
}

module.exports = { previsao, viagensDoPeriodo, mapa, ESTACOES };
