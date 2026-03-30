import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

export default function ProducaoChart({ data, kpis, desabilitarAnimacoes = false }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-[#BFBFC3]">
        Sem dados disponíveis
      </div>
    );
  }

  const dadosFiltrados = data.filter((d) => d.meta > 0 || d.realizado > 0);

  /* ── Tooltip ── */
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      
      // Determinar cor baseada na performance
      const getPerformanceColor = (percentual) => {
        if (percentual >= 100) return "text-green-400";
        if (percentual >= 95) return "text-yellow-400";
        return "text-red-400";
      };
      
      return (
        <div className="bg-[#1A1A1C] border border-[#2A2A2C] p-4 rounded shadow-lg">
          <p className="font-semibold text-white">
            Hora: {String(parseInt(d.hora)).padStart(2, "0")}-{String((parseInt(d.hora) + 1) % 24).padStart(2, "0")}
          </p>
          <p className="text-blue-400">
            Meta: {d.meta.toLocaleString("pt-BR")}
          </p>
          <p className={getPerformanceColor(d.percentual)}>
            Realizado: {d.realizado.toLocaleString("pt-BR")}
          </p>
          <p className={getPerformanceColor(d.percentual)}>
            Performance: {d.percentual}%
          </p>
        </div>
      );
    }
    return null;
  };

  /* ── Label do valor da meta na linha amarela ── */
  const MetaLabel = (props) => {
    const { x, y, value } = props;
    if (!value) return null;
    return (
      <text
        x={x}
        y={y - 10}
        fill="#f59e0b"
        fontSize={11}
        fontWeight="bold"
        textAnchor="middle"
      >
        {Number(value).toLocaleString("pt-BR")}
      </text>
    );
  };

  /* ── Label do valor realizado em cima da barra ── */
  const RealizadoLabel = (props) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#ffffff"
        fontSize={11}
        fontWeight="bold"
        textAnchor="middle"
      >
        {Number(value).toLocaleString("pt-BR")}
      </text>
    );
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart
          data={dadosFiltrados}
          margin={{ top: 30, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2C" vertical={false} />

          <XAxis
            dataKey="hora"
            tick={{ fill: "#BFBFC3", fontSize: 12 }}
            axisLine={{ stroke: "#2A2A2C" }}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: "#BFBFC3", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Barra de Realizado — com cores dinâmicas */}
          <Bar 
            dataKey="realizado" 
            name="Realizado" 
            barSize={48} 
            radius={[3, 3, 0, 0]}
            isAnimationActive={!desabilitarAnimacoes}
          >
            <LabelList content={<RealizadoLabel />} />
            {dadosFiltrados.map((entry, index) => {
              const color =
                entry.realizado === 0
                  ? "transparent"
                  : entry.percentual >= 100
                  ? "#22c55e"   // verde ≥ 100%
                  : entry.percentual >= 95
                  ? "#eab308"   // amarelo ≥ 95%
                  : "#dc2626";  // vermelho < 95%
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>

          {/* Linha amarela de tendência com valores da meta */}
          <Line
            type="monotone"
            dataKey="meta"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: "#f59e0b", r: 5, strokeWidth: 0 }}
            name="Tendência"
            legendType="none"
            isAnimationActive={!desabilitarAnimacoes}
          >
            <LabelList content={<MetaLabel />} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Percentual por hora */}
      <div
        className="grid gap-1 mt-3"
        style={{
          gridTemplateColumns: `repeat(${dadosFiltrados.length}, 1fr)`,
        }}
      >
        {dadosFiltrados.map((d, i) => {
          // Mesma lógica de cores das barras
          const bgColor =
            d.realizado === 0
              ? "bg-gray-600"
              : d.percentual >= 100
              ? "bg-green-600"   // verde ≥ 100%
              : d.percentual >= 95
              ? "bg-yellow-600"  // amarelo ≥ 95%
              : "bg-red-600";    // vermelho < 95%
          
          return (
            <div
              key={i}
              className={`text-center font-bold text-sm py-2 rounded ${bgColor} text-white`}
            >
              {d.percentual.toFixed(1)}%
            </div>
          );
        })}
      </div>

      {/* Faixa de hora */}
      <div
        className="grid gap-1 mt-1"
        style={{
          gridTemplateColumns: `repeat(${dadosFiltrados.length}, 1fr)`,
        }}
      >
        {dadosFiltrados.map((d, i) => {
          const h = parseInt(d.hora);
          const proxHora = (h + 1) % 24;
          return (
            <div
              key={i}
              className="text-center font-bold text-white text-sm py-2 bg-[#1e3a5f] rounded"
            >
              {String(h).padStart(2, "0")}-{String(proxHora).padStart(2, "0")}
            </div>
          );
        })}
      </div>
    </div>
  );
}