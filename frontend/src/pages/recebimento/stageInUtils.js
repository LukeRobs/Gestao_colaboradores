// Regras e cálculos do Stage IN (Inbound Staging Area): ruas do SPX cruzadas com a planilha Report (TOs, pacotes, aging).

/** Faixas de aging (em segundos) do cruzamento Zona × Aging. */
export const FAIXAS_AGING = [
  { rotulo: "0–4h", min: 0, max: 14400 },
  { rotulo: "4–7h", min: 14400, max: 25200 },
  { rotulo: "7–10h", min: 25200, max: 36000 },
  { rotulo: "10–13h", min: 36000, max: 46800 },
  { rotulo: "13–16h", min: 46800, max: 57600 },
  { rotulo: "16–21h", min: 57600, max: 75600 },
  { rotulo: "21–25h", min: 75600, max: 90000 },
  { rotulo: "1–2d", min: 90000, max: 172800 },
  { rotulo: "2–3d", min: 172800, max: 259200 },
  { rotulo: "3–4d", min: 259200, max: 345600 },
  { rotulo: ">4d", min: 345600, max: Infinity },
];

export const PERFIS = [
  { chave: "semPerfil", rotulo: "Sem perfil", curto: "SP", cor: "#8B8B93" },
  { chave: "pp", rotulo: "PP", curto: "PP", cor: "#3B82F6" },
  { chave: "p", rotulo: "P", curto: "P", cor: "#22C55E" },
  { chave: "m", rotulo: "M", curto: "M", cor: "#F59E0B" },
  { chave: "g", rotulo: "G", curto: "G", cor: "#FA4C00" },
  { chave: "bulky", rotulo: "Bulky", curto: "BK", cor: "#8B5CF6" },
  { chave: "ultraBulky", rotulo: "Ultra bulky", curto: "UB", cor: "#FF453A" },
];

export const CORES_TURNO = { T1: "#3B82F6", T2: "#F59E0B", T3: "#22C55E" };
const CORES_TURNO_EXTRA = ["#8B5CF6", "#14B8A6", "#EC4899"];
export const corTurno = (nome, i = 0) => CORES_TURNO[nome] || CORES_TURNO_EXTRA[i % CORES_TURNO_EXTRA.length];

const PALETA_ZONAS = ["#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#14B8A6", "#EC4899", "#06B6D4", "#A3E635", "#F97316", "#6366F1"];

/** "1h05m", "35m", "2d 3h" a partir de segundos. */
export function fmtDur(s) {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Cor do aging: verde até 4h, amarelo até 7h, laranja até 13h, vermelho depois. */
export function corAging(s) {
  if (!s || s <= 0) return "#22C55E";
  const h = s / 3600;
  if (h < 4) return "#22C55E";
  if (h < 7) return "#F59E0B";
  if (h < 13) return "#FA4C00";
  return "#FF453A";
}

export const corOcupacao = (pct) => (pct < 60 ? "#22C55E" : pct < 85 ? "#F59E0B" : "#FF453A");
export const parseOcupacao = (s) => parseFloat(String(s || "0").replace(/\s*%/, "")) || 0;

export const zonaCurta = (nome) => (nome || "").replace(/^zona\s+/i, "").trim() || "—";
export const normZona = (nome) => (nome || "").replace(/^zona\s+/i, "").trim().toUpperCase();

export const limparOperador = (s) =>
  (s || "").replace(/\[ops\d+\]/i, "").replace(/@shopee\.com\.br/i, "").replace(/@shopee\.com/i, "").trim() || "—";

export function rgba(hex, alfa) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/** Cor estável por zona dentro da estação (ordem alfabética dos nomes). */
export function mapaCoresZonas(nomes) {
  const ordenados = [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(ordenados.map((n, i) => [n, PALETA_ZONAS[i % PALETA_ZONAS.length]]));
}

// Gaiolas (código CG...) aparecem na mesma lista de TOs do Report e têm pacotes, mas o to_quantity do SPX não as conta:
// para o SPP (pacotes ÷ unidades) bater, o divisor é TOs + gaiolas da rua.
const ehGaiola = (t) => /^CG/i.test(t?.to || "");

/** Sub-classificação da rua dentro da zona (nomenclatura de Jaboatão). Sem regra para a zona = null. */
export function areaDaRua(nome, zona) {
  const z = (zona || "").toLowerCase();
  if (z.includes("cop")) return { rotulo: "COP", cor: "#F59E0B" };
  if (z.includes("lmh")) return { rotulo: "LMH", cor: "#8B5CF6" };
  if (normZona(zona) !== "VOLUMOSO") return null;
  const m = nome.match(/^IN-(\d+)V$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 16) return { rotulo: "Buffer Termoplástica", cor: "#22C55E" };
    if (n >= 17 && n <= 35) return { rotulo: "HS Volumoso", cor: "#3B82F6" };
  }
  if (/^LN-/i.test(nome)) return { rotulo: "Buffer Linear", cor: "#14B8A6" };
  return { rotulo: "Buffer LMH", cor: "#8B5CF6" };
}

/** Junta as ruas do SPX com o Report (pacotes, TOs, gaiolas, SPP). */
export function montarRuas(ruasBrutas, relatorio) {
  const rel = relatorio?.disponivel ? relatorio : null;
  return (ruasBrutas || []).map((a) => {
    const nome = (a.area_name || "").trim();
    const zona = (a.staging_group_name || "OUTRAS").trim();
    const tosRua = rel?.tosPorRua?.[nome] || [];
    const info = rel?.porRua?.[nome];
    const gaiolas = tosRua.filter(ehGaiola).length;
    const tos = a.to_quantity || 0;
    const unidades = tos + gaiolas;
    const pacotes = info ? info.pacotes : null;
    const aging = a.staging_duration_time || 0;
    const agingFaixa = aging || (tosRua.length ? Math.max(...tosRua.map((t) => t.agingH * 3600)) : 0);
    return {
      nome,
      zona,
      area: areaDaRua(nome, zona),
      tos,
      gaiolas,
      unidades,
      pacotes,
      spp: pacotes != null && unidades > 0 ? pacotes / unidades : null,
      capacidade: a.capacity || 0,
      ocupacao: parseOcupacao(a.occupy_percentage),
      ocupacaoTexto: a.occupy_percentage || "0 %",
      aging,
      agingFaixa,
      operador: limparOperador(a.operator),
      // status 1 = disponível, 2 = ocupada/indisponível (só some da tabela quando o SPX manda o campo)
      status: a.status,
      tosRua,
    };
  });
}

/** Cruzamento Faixa de aging × Zona, em pacotes (ou TOs, quando a zona não tem Report). */
export function cruzamentoAging(ruas, relatorio, zonaAtiva) {
  const rel = relatorio?.disponivel ? relatorio : null;
  const porNome = Object.fromEntries(ruas.map((r) => [r.nome, r]));
  const zonasSet = new Set();
  if (rel) Object.values(rel.porRua).forEach((ad) => ad.zona && zonasSet.add(ad.zona));
  ruas.filter((r) => r.tos > 0).forEach((r) => {
    if (!rel?.porZona[r.zona]) zonasSet.add(r.zona);
  });
  let zonas = [...zonasSet].sort((a, b) => a.localeCompare(b));
  if (zonaAtiva) zonas = zonas.filter((z) => z === zonaAtiva);

  const celulas = FAIXAS_AGING.map(() => Object.fromEntries(zonas.map((z) => [z, 0])));
  const unidadesFaixa = FAIXAS_AGING.map(() => 0);
  const indice = (s) => FAIXAS_AGING.findIndex((f) => s >= f.min && s < f.max);

  if (rel) {
    Object.entries(rel.porRua).forEach(([nome, ad]) => {
      const r = porNome[nome];
      const tosRua = rel.tosPorRua[nome] || [];
      const dur = r?.aging || (tosRua.length ? Math.max(...tosRua.map((t) => t.agingH * 3600)) : 0);
      const i = indice(dur);
      if (i < 0) return;
      if (ad.zona in celulas[i]) celulas[i][ad.zona] += ad.pacotes;
      unidadesFaixa[i] += (r?.tos || 0) + tosRua.filter(ehGaiola).length;
    });
  }
  // Ruas sem Report: usa o número de TOs.
  ruas.filter((r) => r.tos > 0).forEach((r) => {
    if (rel?.porRua[r.nome] || rel?.porZona[r.zona]) return;
    const i = indice(r.aging);
    if (i >= 0 && r.zona in celulas[i]) celulas[i][r.zona] += r.tos;
  });

  const totaisZona = Object.fromEntries(zonas.map((z) => [z, celulas.reduce((s, c) => s + (c[z] || 0), 0)]));
  return { zonas, celulas, unidadesFaixa, totaisZona, temReport: !!rel };
}

/** Totais e cruzamento Perfil × Zona a partir da planilha de perfil (já filtrada pelas TOs da estação). */
export function resumoPerfil(perfil, zonaAtiva) {
  if (!perfil?.disponivel) return null;
  let regs = Object.values(perfil.porTo);
  if (!regs.length) return null;
  if (zonaAtiva) regs = regs.filter((r) => normZona(r.zona) === normZona(zonaAtiva));
  const totais = Object.fromEntries(PERFIS.map((p) => [p.chave, 0]));
  regs.forEach((r) => PERFIS.forEach((p) => (totais[p.chave] += r[p.chave] || 0)));
  const total = PERFIS.reduce((s, p) => s + totais[p.chave], 0);
  const zonas = [...new Set(regs.map((r) => r.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const celulas = PERFIS.map(() => Object.fromEntries(zonas.map((z) => [z, 0])));
  regs.forEach((r) => {
    if (!r.zona) return;
    PERFIS.forEach((p, i) => (celulas[i][r.zona] += r[p.chave] || 0));
  });
  const totaisZona = Object.fromEntries(zonas.map((z) => [z, celulas.reduce((s, c) => s + c[z], 0)]));
  return { totais, total, zonas, celulas, totaisZona, vazio: regs.length === 0 };
}
