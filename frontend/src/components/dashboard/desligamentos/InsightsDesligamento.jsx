const INSIGHT_CONFIG = [
  {
    key: "principalMotivo",
    label: "Principal Motivo",
    icon: "⚠️",
    accent: "#FBBF24",
    description: "Motivo mais recorrente de desligamento",
  },
  {
    key: "turnoCritico",
    label: "Turno Crítico",
    icon: "🕐",
    accent: "#F97316",
    description: "Turno com maior concentração de desligamentos",
  },
  {
    key: "liderDestaque", // ✅ corrigido
    label: "Líder em Destaque",
    icon: "👤",
    accent: "#E8410A",
    description: "Gestor com mais desligamentos no período",
  },
  {
    key: "setorCritico",
    label: "Setor Crítico",
    icon: "🏭",
    accent: "#A78BFA",
    description: "Setor com maior índice de desligamentos",
  },
  {
    key: "empresaCritica",
    label: "Empresa Crítica",
    icon: "🏢",
    accent: "#60A5FA",
    description: "Empresa terceirizada com mais desligamentos",
  },
  {
    key: "generoDestaque", // ✅ corrigido
    label: "Gênero em Destaque",
    icon: "📊",
    accent: "#34D399",
    description: "Gênero com maior concentração de desligamentos",
  },
];

function InsightCard({ label, icon, accent, description, value }) {
  const isEmpty = !value || !value.label;

  return (
    <div className="relative flex flex-col gap-2 bg-[#151517] border border-white/[0.07] rounded-2xl p-4 overflow-hidden hover:border-white/[0.14] transition-all duration-300 hover:-translate-y-0.5">
      
      {/* Accent */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accent}88, ${accent}22)` }}
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          {icon}
        </span>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-white/40">
          {label}
        </span>
      </div>

      {/* Value */}
      {isEmpty ? (
        <p className="text-white/20 text-sm font-medium">—</p>
      ) : (
        <div className="flex flex-col">
          <p
            className="text-sm font-bold leading-snug truncate"
            style={{ color: accent }}
            title={value.label}
          >
            {value.label}
          </p>

          {/* 🔥 quantidade */}
          <span className="text-[10px] text-white/30">
            {value.value} casos
          </span>
        </div>
      )}

      {/* Description */}
      <p className="text-[10px] text-white/25 leading-tight">
        {description}
      </p>
    </div>
  );
}

export default function InsightsDesligamento({ data }) {
  const hasAnyInsight =
    data &&
    INSIGHT_CONFIG.some((c) => {
      const v = data[c.key];
      return v && v.label;
    });

  return (
    <div className="w-full bg-[#151517] border border-white/[0.07] rounded-2xl p-5">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <h3 className="text-sm font-semibold text-white/80">
            Insights Automáticos
          </h3>
        </div>

        {!hasAnyInsight && (
          <span className="text-[11px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">
            Dados insuficientes
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {INSIGHT_CONFIG.map((cfg) => (
          <InsightCard
            key={cfg.key}
            label={cfg.label}
            icon={cfg.icon}
            accent={cfg.accent}
            description={cfg.description}
            value={data?.[cfg.key]}
          />
        ))}
      </div>
    </div>
  );
}