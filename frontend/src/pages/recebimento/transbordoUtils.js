// Regras e agregações do Transbordo: TOs com tag CD escaneadas, agrupadas por turno, hora, origem e veículo (LT).

export const TURNOS = ["T1", "T2", "T3"];
// O dia operacional começa às 06:00 — o gráfico segue essa ordem (T3 da madrugada fecha o dia à direita).
export const HORAS_DO_DIA = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];

export const METRICAS = {
  pacotes: { rotulo: "Pacotes", unidade: "pacotes" },
  tos: { rotulo: "TOs", unidade: "TOs" },
  veiculos: { rotulo: "Veículos", unidade: "veículos" },
};

export const fmtKg = (gramas) => ((gramas || 0) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtHora = (t) => (t.hora == null ? "—" : `${String(t.hora).padStart(2, "0")}:${String(t.minuto).padStart(2, "0")}`);
export const fmtDataBR = (iso) => iso.split("-").reverse().join("/");
export const temExcecao = (t) => Array.isArray(t.abnormalLabels) && t.abnormalLabels.length > 0;

/** Chave do veículo: cada LT é uma viagem de um veículo; sem LT, vale a placa. */
export const chaveVeiculo = (t) => t.tripNumber || t.vehicleNumber || "(sem LT)";

/** Duração entre dois instantes ISO, em minutos (0 se faltar algum). */
const minEntre = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : 0);

/** Um registro por veículo (LT), com os totais das TOs dele nas TOs recebidas (já filtradas). */
export function agruparVeiculos(lista) {
  const mapa = new Map();
  lista.forEach((t) => {
    const k = chaveVeiculo(t);
    let v = mapa.get(k);
    if (!v) {
      v = { chave: k, lt: t.tripNumber || null, placa: t.vehicleNumber || null, motorista: t.driverName || null, tos: 0, pacotes: 0, pesoG: 0, excecoes: 0, origens: new Map(), docas: new Map(), operadores: new Set(), primeiroScan: null, ultimoScan: null, itens: [] };
      mapa.set(k, v);
    }
    v.tos += 1;
    v.pacotes += t.parcels || 0;
    v.pesoG += t.weightG || 0;
    if (temExcecao(t)) v.excecoes += 1;
    if (t.loadedStationName) v.origens.set(t.loadedStationName, (v.origens.get(t.loadedStationName) || 0) + 1);
    if (t.dockNumber) v.docas.set(t.dockNumber, (v.docas.get(t.dockNumber) || 0) + 1);
    if (t.operator) v.operadores.add(t.operator);
    if (t.scanEm && (!v.primeiroScan || t.scanEm < v.primeiroScan)) v.primeiroScan = t.scanEm;
    if (t.scanEm && (!v.ultimoScan || t.scanEm > v.ultimoScan)) v.ultimoScan = t.scanEm;
    if (!v.motorista && t.driverName) v.motorista = t.driverName;
    v.itens.push(t);
  });
  const maisFrequente = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return [...mapa.values()].map((v) => ({
    ...v,
    origem: maisFrequente(v.origens),
    outrasOrigens: Math.max(0, v.origens.size - 1),
    doca: maisFrequente(v.docas),
    operadores: v.operadores.size,
    duracaoMin: minEntre(v.primeiroScan, v.ultimoScan),
  }));
}

/** Valor por hora do dia operacional (24 posições, índice = hora). Veículos = LTs com ao menos um scan na hora. */
export function serieHora(lista, metrica) {
  const valores = new Array(24).fill(0);
  if (metrica === "veiculos") {
    const por = Array.from({ length: 24 }, () => new Set());
    lista.forEach((t) => t.hora != null && por[t.hora].add(chaveVeiculo(t)));
    por.forEach((s, h) => (valores[h] = s.size));
  } else {
    lista.forEach((t) => {
      if (t.hora != null) valores[t.hora] += metrica === "pacotes" ? t.parcels || 0 : 1;
    });
  }
  return HORAS_DO_DIA.map((h) => ({ hora: String(h).padStart(2, "0"), valor: valores[h] }));
}

/** Origens com TOs, pacotes e veículos, da maior para a menor na métrica escolhida. */
export function origensDoDia(lista, metrica, limite = 8) {
  const mapa = new Map();
  lista.forEach((t) => {
    const nome = t.loadedStationName || "(sem origem)";
    const o = mapa.get(nome) || { nome, tos: 0, pacotes: 0, veiculos: new Set() };
    o.tos += 1;
    o.pacotes += t.parcels || 0;
    o.veiculos.add(chaveVeiculo(t));
    mapa.set(nome, o);
  });
  return [...mapa.values()]
    .map((o) => ({ ...o, veiculos: o.veiculos.size }))
    .sort((a, b) => b[metrica] - a[metrica])
    .slice(0, limite);
}

/** TOs, pacotes e veículos de cada turno. */
export function resumoPorTurno(lista) {
  const agg = Object.fromEntries(TURNOS.map((t) => [t, { tos: 0, pacotes: 0, veiculos: new Set() }]));
  lista.forEach((t) => {
    if (!t.turno || !agg[t.turno]) return;
    agg[t.turno].tos += 1;
    agg[t.turno].pacotes += t.parcels || 0;
    agg[t.turno].veiculos.add(chaveVeiculo(t));
  });
  return Object.fromEntries(TURNOS.map((t) => [t, { ...agg[t], veiculos: agg[t].veiculos.size }]));
}
