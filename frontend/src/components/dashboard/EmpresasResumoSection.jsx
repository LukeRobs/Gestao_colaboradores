export default function EmpresasResumoSection({ empresas = [] }) {
  if (!empresas.length) return null;

  const analiseGeral = empresas.filter((e) =>
    ["SPX", "TOTAL BPO"].includes(String(e.empresa).toUpperCase())
  );

  const analiseBPO = empresas.filter((e) =>
    ["ADECCO", "ADILIS", "LUANDRE"].includes(
      String(e.empresa).toUpperCase()
    )
  );

  const EmpresaCard = (e) => {
    const turnover = Number(e.turnover ?? 0);
    const absenteismo = Number(e.absenteismo ?? 0);

    return (
      <div
        key={e.empresa || "sem-empresa"}
        className="
          bg-surface
          rounded-2xl
          p-4 sm:p-6
          space-y-5
          w-full
        "
      >
        <h3
          className="
            font-bold
            tracking-wide
            text-lg sm:text-xl
          "
          style={{
            color:
              e.empresa?.toUpperCase() === "SPX"
                ? "#FA4C00"
                : "#FFFFFF",
          }}
        >
          {e.empresa || "Sem empresa"}
        </h3>

        {/* 🔥 GRID RESPONSIVO INTERNO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Metric label="Colaboradores escalados" value={e.totalColaboradores} />
          <Metric label="Colaboradores Cadastrados" value={e.totalColaboradoresCadastrados} />

          <Metric
            label="Presentes"
            value={e.presentes}
            color="#34C759"
          />

          <Metric
            label="Faltas"
            value={e.faltas}
            color="#FF453A"
          />

          <Metric
            label="Absenteísmo"
            value={`${absenteismo.toFixed(2)}%`}
            color={
              absenteismo > 10
                ? "#FF453A"
                : absenteismo > 5
                ? "#FF9F0A"
                : "#34C759"
            }
          />

          <Metric label="Atestados" value={e.atestados} />

          <Metric
            label="Medidas Disciplinares"
            value={e.medidasDisciplinares}
          />

          <Metric
            label="Acidentes"
            value={e.acidentes}
            color="#FFD60A"
          />

          <div className="sm:col-span-2">
            <Metric
              label="Turnover"
              value={`${turnover.toFixed(2)}%`}
              color={
                turnover > 5
                  ? "#FF453A"
                  : turnover > 3
                  ? "#FF9F0A"
                  : "#34C759"
              }
            />
          </div>
        </div>
      </div>
    );
  };

  const Metric = ({ label, value = 0, color }) => (
    <div className="min-w-0">
      <span className="text-muted text-xs sm:text-sm truncate block">
        {label}
      </span>
      <p
        className="text-base sm:text-lg font-semibold truncate"
        style={{ color: color || "#FFFFFF" }}
      >
        {value ?? 0}
      </p>
    </div>
  );

  return (
    <section className="space-y-10">
      {analiseGeral.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">
            Análise Geral
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            {analiseGeral.map(EmpresaCard)}
          </div>
        </div>
      )}

      {analiseBPO.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">
            Análise BPO
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {analiseBPO.map(EmpresaCard)}
          </div>
        </div>
      )}
    </section>
  );
}