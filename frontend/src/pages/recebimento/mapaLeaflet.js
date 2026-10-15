// Mapa da frota: Leaflet + OpenStreetMap (gratuito, sem chave). Carregado sob demanda, então só as telas
// com mapa baixam a biblioteca.
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";

let promessa = null;

/** Carrega o Leaflet e o plugin de clusters uma única vez. */
export function carregarLeaflet() {
  if (!promessa) {
    promessa = import("leaflet").then(async (mod) => {
      const L = mod.default || mod;
      window.L = L; // o plugin de clusters procura o Leaflet global
      await import("leaflet.markercluster");
      return L;
    });
  }
  return promessa;
}

export const temaEscuro = () => document.documentElement.classList.contains("dark");

const ATRIBUICAO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ATRIBUICAO_TOPO = `${ATRIBUICAO_OSM}, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`;

/**
 * Camadas de mapa base, todas gratuitas e sem chave. O modo escuro é o mesmo mapa do OpenStreetMap com um filtro
 * de cor (classe .osm-escuro em globals.css), porque os mapas escuros prontos de terceiros pedem chave de API.
 */
export function camadasBase(L) {
  const osm = { maxZoom: 19, attribution: ATRIBUICAO_OSM };
  return {
    Claro: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", osm),
    Escuro: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { ...osm, className: "osm-escuro" }),
    Relevo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, subdomains: "abc", attribution: ATRIBUICAO_TOPO }),
  };
}

/** Cria o mapa com as camadas base e a escolhida conforme o tema do sistema. */
export function criarMapa(L, elemento, { zoomInicial = 5, centro = [-9.5, -38] } = {}) {
  const mapa = L.map(elemento, { zoomControl: false, preferCanvas: true, worldCopyJump: false }).setView(centro, zoomInicial);
  const bases = camadasBase(L);
  (temaEscuro() ? bases.Escuro : bases.Claro).addTo(mapa);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  L.control.layers(bases, null, { position: "topright", collapsed: true }).addTo(mapa);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);
  return mapa;
}

/** Acompanha a troca de tema do sistema e troca o mapa base junto (a menos que a pessoa já tenha escolhido). */
export function seguirTema(L, mapa) {
  const bases = camadasBase(L);
  let escolhaManual = false;
  mapa.on("baselayerchange", () => {
    escolhaManual = true;
  });
  const obs = new MutationObserver(() => {
    if (escolhaManual) return;
    mapa.eachLayer((l) => l instanceof L.TileLayer && mapa.removeLayer(l));
    (temaEscuro() ? bases.Escuro : bases.Claro).addTo(mapa);
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

const SVG_CAMINHAO =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
const SVG_ESTACAO =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 8.35V20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8.35A1 1 0 0 1 2.55 7.5l9-4.5a1 1 0 0 1 .9 0l9 4.5A1 1 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg>';

/** Estado do veículo no mapa (cor e legenda). Ordem importa: o mais grave vence. */
export const ESTADOS_MAPA = {
  ATRASADO: { rotulo: "Atrasado", cor: "#FF453A" },
  RISCO: { rotulo: "Tende a atrasar", cor: "#FA4C00" },
  MOVIMENTO: { rotulo: "Em movimento", cor: "#3B82F6" },
  PARADO: { rotulo: "Parado", cor: "#F59E0B" },
  DESTINO: { rotulo: "No destino", cor: "#22C55E" },
  OUTRO: { rotulo: "Sem programação", cor: "#8B8B93" },
};

export function estadoDoVeiculo(v) {
  if (v.situacao === "NO_PATIO" || v.situacao === "RECEBIDA") return "DESTINO";
  if (v.situacao === "SEM_PROGRAMACAO" || v.situacao === "CANCELADA") return "OUTRO";
  if (v.atrasada) return "ATRASADO";
  if (v.tendeAtrasar) return "RISCO";
  return (v.ultimaLeitura?.velocidadeKmh || 0) > 0 ? "MOVIMENTO" : "PARADO";
}

export function iconeVeiculo(L, { cor, pulsa = false, selecionado = false }) {
  return L.divIcon({
    className: "fm-marker",
    html: `<div class="fm-pin${selecionado ? " sel" : ""}" style="--c:${cor}">${pulsa ? '<span class="fm-pulse"></span>' : ""}<span class="fm-core">${SVG_CAMINHAO}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

export function iconeEstacao(L, codigo) {
  return L.divIcon({
    className: "fm-marker",
    html: `<div class="fm-station"><span class="fm-station-core">${SVG_ESTACAO}</span><span class="fm-station-label">${codigo}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function iconeCluster(L, cluster) {
  const n = cluster.getChildCount();
  const tam = n < 10 ? 36 : n < 50 ? 42 : 48;
  return L.divIcon({ className: "fm-marker", html: `<div class="fm-cluster" style="width:${tam}px;height:${tam}px">${n}</div>`, iconSize: [tam, tam] });
}

/** Rumo (graus) entre duas posições, para a seta de direção. */
export function rumo(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export const escapaHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
