import { useId } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumero } from "../../components/mapaOperacional/uiTokens";
import { COR_PREVISTO, COR_RECEBIDO } from "./inboundUtils";

// Gráficos da Previsão de recebimento (recharts). Cores e tipografia seguem os tokens do tema (claro/escuro).

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const EIXO = { tick: { fill: "var(--color-muted)", fontSize: 11 }, axisLine: false, tickLine: false };
const GRADE = { stroke: "var(--color-border)", strokeDasharray: "2 4", strokeOpacity: 0.9 };

// Rótulo de valor: some quando é 0 e abrevia milhares ("12,5k") para não encavalar.
const rotuloValor = (v) => (v > 0 ? (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v)) : "");
const ROTULO_PREVISTO = { fill: "var(--color-muted)", fontSize: 10, fontWeight: 600 };
const ROTULO_RECEBIDO = { fill: COR_RECEBIDO, fontSize: 10, fontWeight: 700 };
const compacto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n));

/** Tooltip no estilo dos cards do sistema: título, uma linha por série (com a cor) e o desvio quando há as duas. */
function TooltipCard({ active, payload, label, titulo, unidade }) {
  if (!active || !payload?.length) return null;
  const linhas = payload.filter((p) => p.name === "Previsto" || p.name === "Recebido");
  const prev = linhas.find((p) => p.name === "Previsto")?.value;
  const rec = linhas.find((p) => p.name === "Recebido")?.value;
  return (
    <div className="rounded-xl border border-default bg-surface px-3.5 py-3 shadow-xl text-xs min-w-[150px]">
      <p className="font-semibold text-page mb-2">{titulo ? titulo(label) : label}</p>
      <ul className="space-y-1.5">
        {linhas.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm" style={{ background: p.name === "Recebido" ? COR_RECEBIDO : COR_PREVISTO }} />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-page">{formatNumero(p.value)}</span>
          </li>
        ))}
      </ul>
      {prev > 0 && rec !== undefined && (
        <p className="mt-2 pt-2 border-t border-default text-muted tabular-nums">
          {Math.round((rec / prev) * 100)}% do previsto{unidade ? ` · ${unidade}` : ""}
        </p>
      )}
    </div>
  );
}

export function Legenda({ itens }) {
  return (
    <ul className="flex items-center gap-3 text-xs text-muted" aria-label="Legenda do gráfico">
      {itens.map((i) => (
        <li key={i.rotulo} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

export function CurvaHora({ dados, chavePrev, chaveRec, unidade }) {
  const gid = useId().replace(/:/g, "");
  const animar = !reduzirMovimento();
  return (
    <div className="h-72" role="img" aria-label={`Curva de recebimento por hora, previsto e recebido, em ${unidade}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 24, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_RECEBIDO} stopOpacity={0.38} />
              <stop offset="100%" stopColor={COR_RECEBIDO} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRADE} vertical={false} />
          <XAxis dataKey="hora" {...EIXO} interval={0} />
          <YAxis {...EIXO} width={48} allowDecimals={false} tickFormatter={compacto} />
          <Tooltip content={<TooltipCard titulo={(h) => `${h}:00 às ${h}:59`} unidade={unidade} />} cursor={{ stroke: "var(--color-border-2)", strokeDasharray: "3 3" }} />
          <Area type="linear" dataKey={chaveRec} name="Recebido" stroke={COR_RECEBIDO} strokeWidth={2.5} fill={`url(#${gid})`} dot={{ r: 2.5, fill: COR_RECEBIDO, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive={animar}>
            <LabelList dataKey={chaveRec} position="bottom" offset={8} formatter={rotuloValor} style={ROTULO_RECEBIDO} />
          </Area>
          <Line type="linear" dataKey={chavePrev} name="Previsto" stroke={COR_PREVISTO} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2.5, fill: COR_PREVISTO, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive={animar}>
            <LabelList dataKey={chavePrev} position="top" offset={8} formatter={rotuloValor} style={ROTULO_PREVISTO} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Colunas({ dados, chaveX, chavePrev, chaveRec, altura = "h-64", unidade }) {
  const animar = !reduzirMovimento();
  return (
    <div className={altura} role="img" aria-label="Gráfico de barras, previsto e recebido">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barGap={4}>
          <CartesianGrid {...GRADE} vertical={false} />
          <XAxis dataKey={chaveX} {...EIXO} interval={0} />
          <YAxis {...EIXO} width={48} allowDecimals={false} tickFormatter={compacto} />
          <Tooltip content={<TooltipCard unidade={unidade} />} cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }} />
          <Bar dataKey={chavePrev} name="Previsto" fill={COR_PREVISTO} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={animar}>
            <LabelList dataKey={chavePrev} position="top" formatter={rotuloValor} style={ROTULO_PREVISTO} />
          </Bar>
          <Bar dataKey={chaveRec} name="Recebido" fill={COR_RECEBIDO} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={animar}>
            <LabelList dataKey={chaveRec} position="top" formatter={rotuloValor} style={ROTULO_RECEBIDO} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarrasHorizontais({ dados, chavePrev, chaveRec, unidade }) {
  const altura = Math.max(220, dados.length * 40 + 30);
  const animar = !reduzirMovimento();
  return (
    <div style={{ height: altura }} role="img" aria-label="Recebimento por FM, previsto e recebido">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }} barGap={3}>
          <CartesianGrid {...GRADE} horizontal={false} />
          <XAxis type="number" {...EIXO} allowDecimals={false} tickFormatter={compacto} />
          <YAxis type="category" dataKey="nome" {...EIXO} width={96} interval={0} />
          <Tooltip content={<TooltipCard unidade={unidade} />} cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }} />
          <Bar dataKey={chavePrev} name="Previsto" fill={COR_PREVISTO} radius={[0, 6, 6, 0]} barSize={10} isAnimationActive={animar}>
            <LabelList dataKey={chavePrev} position="right" formatter={rotuloValor} style={ROTULO_PREVISTO} />
          </Bar>
          <Bar dataKey={chaveRec} name="Recebido" fill={COR_RECEBIDO} radius={[0, 6, 6, 0]} barSize={10} isAnimationActive={animar}>
            <LabelList dataKey={chaveRec} position="right" formatter={rotuloValor} style={ROTULO_RECEBIDO} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
