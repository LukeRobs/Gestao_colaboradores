const { instanteSP } = require("../../utils/turnoMapaOperacional");
const { carregar } = require("./planilha.service");

/**
 * Viagens (LH) que chegam na estação, montadas a partir das abas da planilha do Planning Inbound.
 * Junta Monitoring (programação) + dbLh (realizado) + Spp X perfil (TOs/SPP/sacas) + Telemetria (posição) +
 * motorista. A planilha é bagunçada (snapshots repetidos, formatos de data e de número misturados), então
 * toda a limpeza fica aqui e o resto do sistema só enxerga o objeto normalizado.
 */

// Estação do COPEOPLE (pelo station_id do SPX) -> código da planilha e posição física (para o mapa).
const ESTACOES = {
  10963: { codigo: "SOC-PE2", nome: "SOC-PE2 · Jaboatão dos Guararapes", coords: [-8.2074, -34.9646] },
  15000: { codigo: "SOC-PE4", nome: "SOC-PE4 · Recife 04", coords: [-8.1696, -34.9543] },
};

const TOLERANCIA_MIN = 30; // ±30 min do ETA planejado = "no prazo" (mesma regra do painel antigo)
const DATA_MINIMA = "2026-09-01"; // linhas anteriores usam outro leiaute de colunas
const TIPOS_ORIGEM = ["SOC", "FMH", "HUB", "XPT", "FBS"];

const CANCELADAS = new Set(["cancelled", "cancelado", "deleted", "spotbid cancelled", "fruitless", "infrutífera", "infrutifera", "não consumida", "nao consumida"]);
const NO_SHOW = new Set(["no show", "no_show"]);
const FECHADAS = new Set(["completed", "fechada"]);

/* ---------- conversões ---------- */
const memoData = new Map();
/** "2026-10-15 9:31" ou "15/10/2026 02:38:00" (horário de Brasília) -> epoch ms. */
function dataBR(valor) {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  if (memoData.has(s)) return memoData.get(s);
  let r = null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) r = instanteSP(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) r = instanteSP(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  }
  if (memoData.size > 60000) memoData.clear();
  memoData.set(s, r);
  return r;
}

/** "8,775" (milhar) / "12" / "0,5" -> número. */
function numero(valor) {
  if (valor === undefined || valor === null || valor === "") return 0;
  const s = String(valor).trim();
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, "")) || 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const txt = (v) => {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s || null;
};

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

/** "-8,1696, -34,9543" -> [lat, lng] */
function latLng(valor) {
  const s = String(valor || "").trim();
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;]\s+(-?\d+(?:[.,]\d+)?)$/) || s.match(/^(-?\d+\.\d+)\s*[,;]\s*(-?\d+\.\d+)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(",", "."));
  const lng = Number(m[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

function colunas(cabecalho) {
  const mapa = {};
  (cabecalho || []).forEach((h, i) => {
    const k = String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (k && !(k in mapa)) mapa[k] = i; // nomes repetidos: vale a primeira coluna
  });
  return mapa;
}

const turnoDaHora = (h) => (h >= 6 && h < 14 ? "T1" : h >= 14 && h < 22 ? "T2" : "T3");
const horaSP = (ms) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));

function tipoDeOrigem(origem, valorPlanilha) {
  const prefixo = String(origem || "").split("-")[0].toUpperCase();
  if (TIPOS_ORIGEM.includes(prefixo)) return prefixo;
  const v = String(valorPlanilha || "").toUpperCase();
  return TIPOS_ORIGEM.includes(v) ? v : prefixo || "OUTRO";
}

/* ---------- leitura de cada aba ---------- */
function lerMonitoring(valores, codigo) {
  const c = colunas(valores[0]);
  const g = (r, k) => (k in c ? r[c[k]] : undefined);
  const porLh = new Map();

  valores.slice(1).forEach((r, idx) => {
    if (g(r, "destino_1") !== codigo) return;
    const lh = txt(g(r, "lh_trip"));
    const prazo = dataBR(g(r, "prazo_eta_destino"));
    if (!lh || !prazo || String(g(r, "prazo_eta_destino")).slice(0, 10) < DATA_MINIMA) return;
    // Cada LH aparece em vários snapshots (um por dia de coleta): vale o mais recente.
    const chave = `${g(r, "data_coleta") || ""}|${String(dataBR(g(r, "latest_update")) || 0).padStart(14, "0")}|${String(idx).padStart(7, "0")}`;
    const atual = porLh.get(lh);
    if (atual && atual.chave >= chave) return;
    porLh.set(lh, { chave, r, g });
  });

  const out = new Map();
  porLh.forEach(({ r, g }, lh) => {
    const origem = txt(g(r, "origem"));
    out.set(lh, {
      lh,
      statusPlanilha: txt(g(r, "status_da_programacao")),
      solicitacao: txt(g(r, "solicitacao")),
      transportadora: txt(g(r, "adjustment_3pl")),
      origem,
      tipoOrigem: tipoDeOrigem(origem, g(r, "tipo_de_origem")),
      placas: String(g(r, "placa_do_veiculo") || "").split(",").map((p) => p.trim()).filter(Boolean),
      veiculo: txt(g(r, "veiculo_correto")),
      pacotesPlanilha: numero(g(r, "total_orders")),
      prazoEtaOrigem: dataBR(g(r, "prazo_eta_origem")),
      prazoCptOrigem: dataBR(g(r, "prazo_cpt_origem")),
      cptRealizado: dataBR(g(r, "cpt_realizado")),
      prazoEta: dataBR(g(r, "prazo_eta_destino")),
      etaReal: dataBR(g(r, "eta_destino_realizado")),
      descarga: dataBR(g(r, "horario_de_descarga")),
      turnoPlanilha: txt(g(r, "turno_destino")),
      tempoTransito: txt(g(r, "transit_time_")),
      statusCpt: txt(g(r, "status_cpt")),
      motivoCancelamento: ["OPENED", "ON TIME", "EARLY", "DELAY"].includes(String(g(r, "cancel_reason") || "")) ? null : txt(g(r, "cancel_reason")),
      atualizadoEm: dataBR(g(r, "latest_update")),
      coletaEm: txt(g(r, "data_coleta")),
    });
  });
  return out;
}

function lerDbLh(listas) {
  const out = new Map();
  listas.forEach((valores) => {
    const c = colunas(valores[0]);
    const g = (r, k) => (k in c ? r[c[k]] : undefined);
    valores.slice(1).forEach((r) => {
      const lh = txt(g(r, "lh_trip"));
      if (!lh) return;
      out.set(lh, {
        status: txt(g(r, "status")),
        motoristaId: txt(g(r, "driver_id")),
        transportador: txt(g(r, "transportador")),
        placa: txt(g(r, "vehicle_number")),
        etaPlanejado: dataBR(g(r, "eta_panej")),
        etaReal: dataBR(g(r, "eta_real")),
        liberacaoSeloEm: dataBR(g(r, "unseal_datetime")),
        descarga: dataBR(g(r, "horario_de_descarga")),
        pacotes: numero(g(r, "total_orders")),
        tosSaca: numero(g(r, "to_saca")),
        solicitadoPor: txt(g(r, "solicitation_by")),
        tipo: txt(g(r, "tipo")),
      });
    });
  });
  return out;
}

/** A aba tem duas tabelas lado a lado (colunas repetidas): A:I = perfil de pacote, J:T = SPP/TOs/sacas. */
function lerSpp(valores) {
  const perfil = new Map();
  const spp = new Map();
  valores.slice(1).forEach((r) => {
    const lhPerfil = txt(r[0]);
    if (lhPerfil) {
      perfil.set(lhPerfil, {
        pacotes: numero(r[1]),
        pp: numero(r[2]), p: numero(r[3]), m: numero(r[4]), g: numero(r[5]),
        bulky: numero(r[6]), ultraBulky: numero(r[7]), semPerfil: numero(r[8]),
      });
    }
    const lhSpp = txt(r[9]);
    if (lhSpp) {
      spp.set(lhSpp, {
        estacao: txt(r[10]),
        tos: numero(r[11]),
        bandas: [12, 13, 14, 15, 16, 17].map((i) => numero(r[i])), // 0-20, 21-30, 31-40, 41-50, 51-60, >60
        sacasTos: numero(r[18]),
        sacas: numero(r[19]),
      });
    }
  });
  return { perfil, spp };
}

function lerTelemetria(valores) {
  const c = colunas(valores[0]);
  const g = (r, k) => (k in c ? r[c[k]] : undefined);
  const porLh = new Map();
  valores.slice(1).forEach((r) => {
    const lh = txt(g(r, "trip_number"));
    const pos = latLng(g(r, "latitude_longitude"));
    if (!lh || !pos) return;
    const obs = {
      em: dataBR(g(r, "ultimo_posicionamento")),
      lat: pos[0],
      lng: pos[1],
      status: txt(g(r, "status_viagem")),
      velocidadeKmh: numero(String(g(r, "velocidade") || "").replace(/[^\d.,-]/g, "")),
      ignicao: txt(g(r, "ignicao")),
      local: txt(g(r, "localizacao_atual")),
      progressaoPct: numero(g(r, "progressao_pct")),
      distanciaFaltanteKm: numero(g(r, "distancia_faltante_km")),
      etaGoogle: dataBR(g(r, "eta_google_maps")),
      etaPlanilha: dataBR(g(r, "eta_destino")),
      paradaAtual: txt(g(r, "parada_atual")),
      paradasTotais: txt(g(r, "paradas_totais")),
      paradasProgramadas: txt(g(r, "paradas_programadas")),
      statusParadas: txt(g(r, "status_paradas")),
      ocorrencia: txt(g(r, "ocorrencia")),
      descricaoOcorrencia: txt(g(r, "descricao_ocorrencia")),
      _meta: {
        tipoVeiculo: txt(g(r, "tipo_veiculo")),
        agencia: txt(g(r, "agencia")),
        motorista: txt(g(r, "motorista")),
        origem: txt(g(r, "origem")),
        destino: txt(g(r, "destino")),
      },
      _ordem: porLh.get(lh)?.length ?? 0,
    };
    if (!porLh.has(lh)) porLh.set(lh, []);
    porLh.get(lh).push(obs);
  });
  // da leitura mais recente para a mais antiga (empate: linha mais abaixo = mais recente)
  porLh.forEach((lista) => lista.sort((a, b) => (b.em || 0) - (a.em || 0) || b._ordem - a._ordem));
  return porLh;
}

/* ---------- montagem por estação (cacheada por leitura da planilha) ---------- */
const memoBase = new Map();

async function carregarBase(spxStationId) {
  const estacao = ESTACOES[spxStationId];
  if (!estacao) return null;
  const { lidoEm, abas } = await carregar();
  const chave = `${spxStationId}|${lidoEm}`;
  if (memoBase.has(chave)) return memoBase.get(chave);

  const monitoring = lerMonitoring(abas.monitoring, estacao.codigo);
  const dbLh = lerDbLh([abas.dbLh, abas.dbLhPE4]);
  const { perfil, spp } = lerSpp(abas.spp);
  const telemetria = lerTelemetria(abas.telemetria);
  const motoristas = new Map((abas.motorista || []).slice(1).filter((r) => r[0]).map((r) => [String(r[0]).trim(), txt(r[1])]));

  const base = { lidoEm, estacao, monitoring, dbLh, perfil, spp, telemetria, motoristas };
  memoBase.clear(); // só a leitura mais recente interessa
  memoBase.set(chave, base);
  return base;
}

/* ---------- classificação (depende da hora atual) ---------- */
function situacaoDe(v, d, tele, agora) {
  const s = String(v.statusPlanilha || "").toLowerCase();
  const sd = String(d?.status || "").toLowerCase();
  if (CANCELADAS.has(s) || sd === "cancelled") return "CANCELADA";
  if (NO_SHOW.has(s)) return "NO_SHOW";
  if (v.descarga || d?.descarga || FECHADAS.has(s) || sd === "completed") return "RECEBIDA";
  if (v.etaReal || d?.etaReal || sd === "arrived") return "NO_PATIO";
  if (s === "departed" || sd === "departed" || sd === "unseal") return "EM_TRANSITO";
  const ultimo = tele?.[0];
  if (ultimo && ultimo.em && agora - ultimo.em < 6 * 3600 * 1000 && /tr[aâ]nsito/i.test(ultimo.status || "")) return "EM_TRANSITO";
  return "PROGRAMADA";
}

const mediana = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Todas as viagens da estação, já classificadas e com volume (informado ou estimado). */
async function listarTodas(spxStationId, agora = Date.now()) {
  const base = await carregarBase(spxStationId);
  if (!base) return null;
  const { monitoring, dbLh, perfil, spp, telemetria, motoristas } = base;

  const viagens = [];
  monitoring.forEach((m, lh) => {
    const d = dbLh.get(lh) || null;
    const tele = telemetria.get(lh) || null;
    const prazoEta = m.prazoEta;
    const etaReal = m.etaReal || d?.etaReal || null;
    const descarga = m.descarga || d?.descarga || null;
    const situacao = situacaoDe(m, d, tele, agora);
    const pacotesInformado = m.pacotesPlanilha || d?.pacotes || 0;
    const turno = /^T[123]$/.test(m.turnoPlanilha || "") ? m.turnoPlanilha : turnoDaHora(horaSP(prazoEta));
    const ultimo = tele?.[0] || null;
    const pendente = situacao === "PROGRAMADA" || situacao === "EM_TRANSITO";

    let desvioEtaMin = null;
    if (etaReal && (situacao === "RECEBIDA" || situacao === "NO_PATIO")) desvioEtaMin = Math.round((etaReal - prazoEta) / 60000);
    const atrasada = pendente && agora > prazoEta + TOLERANCIA_MIN * 60000;
    const etaGoogle = pendente && ultimo?.etaGoogle ? ultimo.etaGoogle : null;
    const tendeAtrasar = pendente && !atrasada && etaGoogle && etaGoogle > prazoEta + TOLERANCIA_MIN * 60000;

    viagens.push({
      lh,
      situacao,
      statusPlanilha: m.statusPlanilha,
      statusSpx: d?.status || null,
      solicitacao: m.solicitacao,
      transportadora: m.transportadora || d?.transportador || ultimo?._meta.agencia || null,
      origem: m.origem,
      tipoOrigem: m.tipoOrigem,
      placas: m.placas.length ? m.placas : d?.placa ? [d.placa] : [],
      veiculo: m.veiculo || d?.tipo || ultimo?._meta.tipoVeiculo || null,
      motorista: motoristas.get(lh) || ultimo?._meta.motorista || null,
      turno,
      prazoEta,
      etaReal,
      descarga,
      prazoEtaOrigem: m.prazoEtaOrigem,
      prazoCptOrigem: m.prazoCptOrigem,
      cptRealizado: m.cptRealizado,
      statusCpt: m.statusCpt,
      tempoTransito: m.tempoTransito,
      motivoCancelamento: m.motivoCancelamento,
      liberacaoSeloEm: d?.liberacaoSeloEm || null,
      desvioEtaMin,
      classeEta: desvioEtaMin === null ? null : desvioEtaMin < -TOLERANCIA_MIN ? "ADIANTADA" : desvioEtaMin > TOLERANCIA_MIN ? "ATRASADA" : "NO_PRAZO",
      atrasada,
      atrasoMin: atrasada ? Math.round((agora - prazoEta) / 60000) : Math.max(0, desvioEtaMin ?? 0),
      etaGoogle,
      tendeAtrasar: !!tendeAtrasar,
      pacotesInformado,
      pacotes: pacotesInformado,
      pacotesEstimado: false,
      spp: spp.get(lh) || null,
      perfil: perfil.get(lh) || null,
      tosSaca: d?.tosSaca || 0,
      temTelemetria: !!ultimo,
    });
  });

  // Volume ainda não informado (a coluna só enche depois do carregamento): estima pela mediana histórica da origem.
  const historico = viagens.filter((v) => v.situacao === "RECEBIDA" && v.pacotesInformado > 0 && v.prazoEta > agora - 45 * 86400000);
  const porOrigem = new Map();
  const porTipo = new Map();
  historico.forEach((v) => {
    (porOrigem.get(v.origem) || porOrigem.set(v.origem, []).get(v.origem)).push(v.pacotesInformado);
    (porTipo.get(v.tipoOrigem) || porTipo.set(v.tipoOrigem, []).get(v.tipoOrigem)).push(v.pacotesInformado);
  });
  const geral = mediana(historico.map((v) => v.pacotesInformado));
  viagens.forEach((v) => {
    if (v.pacotesInformado > 0 || v.situacao === "CANCELADA" || v.situacao === "NO_SHOW") return;
    const o = porOrigem.get(v.origem);
    const t = porTipo.get(v.tipoOrigem);
    const est = o && o.length >= 3 ? mediana(o) : t && t.length >= 3 ? mediana(t) : geral;
    v.pacotes = est;
    v.pacotesEstimado = est > 0;
  });

  return { base, viagens };
}

/* ---------- visões para a API ---------- */
function resumo(v) {
  return {
    lh: v.lh,
    situacao: v.situacao,
    statusPlanilha: v.statusPlanilha,
    solicitacao: v.solicitacao,
    transportadora: v.transportadora,
    origem: v.origem,
    tipoOrigem: v.tipoOrigem,
    placas: v.placas,
    veiculo: v.veiculo,
    motorista: v.motorista,
    turno: v.turno,
    prazoEta: iso(v.prazoEta),
    etaReal: iso(v.etaReal),
    descarga: iso(v.descarga),
    desvioEtaMin: v.desvioEtaMin,
    classeEta: v.classeEta,
    atrasada: v.atrasada,
    atrasoMin: v.atrasoMin,
    tendeAtrasar: v.tendeAtrasar,
    pacotes: v.pacotes,
    pacotesEstimado: v.pacotesEstimado,
    tos: v.spp?.tos || 0,
    temTelemetria: v.temTelemetria,
  };
}

function observacao(o) {
  return {
    em: iso(o.em),
    lat: o.lat,
    lng: o.lng,
    status: o.status,
    velocidadeKmh: o.velocidadeKmh,
    ignicao: o.ignicao,
    local: o.local,
    progressaoPct: o.progressaoPct,
    distanciaFaltanteKm: o.distanciaFaltanteKm,
    etaGoogle: iso(o.etaGoogle),
    paradaAtual: o.paradaAtual,
    paradasTotais: o.paradasTotais,
    paradasProgramadas: o.paradasProgramadas,
    statusParadas: o.statusParadas,
    ocorrencia: o.ocorrencia,
    descricaoOcorrencia: o.descricaoOcorrencia,
  };
}

function detalhe(v, base, agora) {
  const tele = base.telemetria.get(v.lh) || [];
  return {
    ...resumo(v),
    statusSpx: v.statusSpx,
    prazoEtaOrigem: iso(v.prazoEtaOrigem),
    prazoCptOrigem: iso(v.prazoCptOrigem),
    cptRealizado: iso(v.cptRealizado),
    statusCpt: v.statusCpt,
    tempoTransito: v.tempoTransito,
    motivoCancelamento: v.motivoCancelamento,
    liberacaoSeloEm: iso(v.liberacaoSeloEm),
    etaGoogle: iso(v.etaGoogle),
    pacotesInformado: v.pacotesInformado,
    spp: v.spp,
    perfil: v.perfil,
    tosSaca: v.tosSaca,
    destino: { codigo: base.estacao.codigo, nome: base.estacao.nome, coords: base.estacao.coords },
    leituraIdadeMin: tele[0]?.em ? Math.max(0, Math.round((agora - tele[0].em) / 60000)) : null,
    telemetria: tele.slice(0, 40).map(observacao),
  };
}

async function obterViagem(spxStationId, lh, agora = Date.now()) {
  const r = await listarTodas(spxStationId, agora);
  if (!r) return null;
  const v = r.viagens.find((x) => x.lh === lh);
  return v ? detalhe(v, r.base, agora) : undefined;
}

module.exports = {
  ESTACOES,
  TOLERANCIA_MIN,
  listarTodas,
  obterViagem,
  carregarBase,
  resumo,
  observacao,
  horaSP,
  turnoDaHora,
  iso,
};
