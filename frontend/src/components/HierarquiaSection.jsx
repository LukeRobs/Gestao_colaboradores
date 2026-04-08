import { useState, useMemo } from "react";

/* =====================================================
   COMPONENT
===================================================== */
export default function HierarquiaSection({
  resumo,
  hierarquia = [],
}) {
  const [modo, setModo] = useState("arvore");

  /* ================= COBERTURA ================= */
  const coberturaTotal = useMemo(() => {
    return (
      hierarquia?.reduce(
        (acc, g) =>
          acc +
          g.supervisores.reduce(
            (sAcc, s) =>
              sAcc +
              s.lideres.reduce(
                (lAcc, l) => lAcc + l.colaboradores.length,
                0
              ),
            0
          ),
        0
      ) || 0
    );
  }, [hierarquia]);

  return (
    <div className="
      bg-page
      rounded-2xl
      border
      border-default
      p-4
      sm:p-6
      lg:p-8
      space-y-6
    ">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-sm text-muted tracking-wider">
          ANÁLISE HIERÁRQUICA
        </h2>

        <div className="flex gap-3">
          <ToggleButton
            active={modo === "arvore"}
            onClick={() => setModo("arvore")}
          >
            🌳 Visão Árvore
          </ToggleButton>

          <ToggleButton
            active={modo === "nivel"}
            onClick={() => setModo("nivel")}
          >
            ▦ Por Nível
          </ToggleButton>
        </div>
      </div>

      {/* MINI KPI CARDS */}
      <div className="
        grid
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        gap-4
        sm:gap-6"
      >
        <MiniCard
          label="Gerentes"
          value={resumo?.totalGerentes || 0}
          subtitle="Total cadastrados"
          color="#FA4C00"
        />
        <MiniCard
          label="Supervisores"
          value={resumo?.totalSupervisores || 0}
          subtitle="Vinculados a gerentes"
          color="#3b82f6"
        />
        <MiniCard
          label="Líderes"
          value={resumo?.totalLideres || 0}
          subtitle="Ativos na operação"
          color="#34C759"
        />
      </div>

      {/* CONTEÚDO DINÂMICO */}
      {modo === "arvore" ? (
        <ArvoreHierarquica data={hierarquia} />
      ) : (
        <PorNivelHierarquia data={hierarquia} />
      )}
    </div>
  );
}

/* =====================================================
   TOGGLE BUTTON
===================================================== */
function ToggleButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition-all border ${
        active
          ? "bg-[#1F1F1F] border-[#2A2A2A]"
          : "bg-transparent border-default hover:bg-[#151515]"
      }`}
    >
      {children}
    </button>
  );
}

/* =====================================================
   MINI CARD
===================================================== */
function MiniCard({ label, value, subtitle, color }) {
  return (
    <div className="
      bg-[#0F0F0F]
      border
      border-default
      rounded-xl
      p-4
      sm:p-6"
    >
      <p className="text-xs text-[#7A7A7A] uppercase tracking-wide">
        {label}
      </p>
      <p
        className="text-2xl sm:text-3xl font-semibold mt-2"
        style={{ color }}
      >
        {value}
      </p>
      <p className="text-xs text-[#5A5A5A] mt-1">
        {subtitle}
      </p>
    </div>
  );
}

/* =====================================================
   🌳 VISÃO ÁRVORE
===================================================== */
function ArvoreHierarquica({ data }) {
  const [openGerente, setOpenGerente] = useState({});
  const [openSupervisor, setOpenSupervisor] = useState({});
  const [openLider, setOpenLider] = useState({});

  if (!data?.length) {
    return (
      <p className="text-[#7A7A7A] text-sm">
        Nenhuma hierarquia encontrada no período.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((gerente) => {
        const gerenteOpen = openGerente[gerente.id];

        return (
          <div
            key={gerente.id}
            className="bg-[#0F0F0F] border border-default rounded-xl"
          >
            {/* GERENTE */}
            <div
              onClick={() =>
                setOpenGerente((prev) => ({
                  ...prev,
                  [gerente.id]: !prev[gerente.id],
                }))
              }
              className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#151515] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-orange-400 font-semibold">
                  {gerente.nome}
                </span>

                <span className="text-xs text-[#6B7280] bg-surface px-2 py-0.5 rounded-md">
                  {gerente.totalColaboradores ?? 0} colab
                </span>

                <span className="text-xs text-[#6B7280] transition-transform">
                  {gerenteOpen ? "▲" : "▼"}
                </span>
              </div>

              <MetricasLinha node={gerente} />
            </div>

            {/* SUPERVISORES */}
            {gerenteOpen &&
              gerente.supervisores.map((sup) => {
                const supOpen = openSupervisor[sup.id];

                return (
                  <div key={sup.id} className="pl-4 sm:pl-6 lg:pl-8 border-t border-[#1A1A1A]">
                    <div
                      onClick={() =>
                        setOpenSupervisor((prev) => ({
                          ...prev,
                          [sup.id]: !prev[sup.id],
                        }))
                      }
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#141414]"
                    >
                      <span className="text-blue-400">
                        {sup.nome}
                      </span>

                      <MetricasLinha node={sup} />
                    </div>

                    {/* LÍDERES */}
                    {supOpen &&
                      sup.lideres.map((lider) => {
                        const liderOpen = openLider[lider.id];

                        return (
                          <div
                            key={lider.id}
                            className="pl-4 sm:pl-6 lg:pl-8 border-t border-[#181818]"
                          >
                            <div
                              onClick={() =>
                                setOpenLider((prev) => ({
                                  ...prev,
                                  [lider.id]: !prev[lider.id],
                                }))
                              }
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#131313]"
                            >
                              <span className="text-green-400">
                                {lider.nome}
                              </span>

                              <MetricasLinha node={lider} />
                            </div>
                    {/* SUPERVISIONADOS DIRETOS */}
                        {supOpen && sup.supervisionadosDiretos?.length > 0 && (
                        <div className="pl-4 sm:pl-6 lg:pl-8 border-t border-[#181818]">
                            <div className="p-4 bg-[#0B0B0B] space-y-2">
                            <p className="text-xs text-[#6B7280] mb-2">
                                Supervisionados Diretos
                            </p>

                            {sup.supervisionadosDiretos.map((c) => (
                                <div
                                key={c.opsId}
                                className="flex justify-between text-sm text-muted"
                                >
                                <span>{c.nome}</span>
                                <span className="text-[#6B7280]">
                                    {c.setor}
                                </span>
                                </div>
                            ))}
                            </div>
                        </div>
                        )}
                    {/* OPERADORES */}
                            {liderOpen && (
                              <div className="pl-4 sm:pl-6 lg:pl-8 p-4 space-y-2 bg-[#0B0B0B]">
                                {lider.colaboradores.map((c) => (
                                  <div
                                    key={c.opsId}
                                    className="flex justify-between text-sm text-muted"
                                  >
                                    <span>{c.nome}</span>
                                    <span className="text-[#6B7280]">
                                      {c.setor}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

function MetricasLinha({ node }) {
  const absColor =
    node.absenteismo >= 3
      ? "text-red-400"
      : node.absenteismo >= 2
      ? "text-yellow-400"
      : "text-green-400";

  return (
    <div className="
      flex
      flex-wrap
      gap-3
      sm:gap-6
      text-xs
      sm:text-sm"
    >
      <MetricItem label="COLAB" value={node.totalColaboradores} />
      <MetricItem label="FALTAS" value={node.faltas} color="text-red-400" />
      <MetricItem label="ATEST." value={node.atestados} color="text-yellow-400" />
      <MetricItem label="ABS." value={`${node.absenteismo}%`} color={absColor} />
    </div>
  );
}

function MetricItem({ label, value, color = "text-muted" }) {
  return (
    <div className="flex gap-1 whitespace-nowrap">
      <span className="text-[#6B7280]">{label}</span>
      <span className={`font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}

/* =====================================================
   ▦ VISÃO POR NÍVEL
===================================================== */
function PorNivelHierarquia({ data }) {
  const gerentes = data;
  const supervisores = useMemo(
    () => data.flatMap(g => g.supervisores),
    [data]
  );

  const lideres = useMemo(
    () => supervisores.flatMap(s => s.lideres),
    [supervisores]
  );

  return (
    <div className="
      grid
      grid-cols-1
      md:grid-cols-2
      2xl:grid-cols-3
      gap-6"
    >

      <NivelCard
        title="GERENTE × SUPERVISOR"
        items={gerentes}
        color="text-orange-400"
      />

      <NivelCard
        title="SUPERVISOR × LÍDER"
        items={supervisores}
        color="text-blue-400"
      />

      <NivelCard
        title="LÍDER × COLABORADOR"
        items={lideres}
        color="text-green-400"
      />
    </div>
  );
}

/* =====================================================
   NIVEL CARD
===================================================== */
function NivelCard({ title, items, color }) {
  return (
    <div className="bg-[#0F0F0F] border border-default rounded-xl p-6">
      <p className="text-sm text-[#7A7A7A] mb-4 tracking-wide">
        {title}
      </p>

      <div className="space-y-3">
        {items.map((item) => {
          const absColor =
            item.absenteismo >= 3
              ? "text-red-400"
              : item.absenteismo >= 2
              ? "text-yellow-400"
              : "text-green-400";

          return (
            <div
              key={item.id}
              className="flex flex-col border-b border-[#1A1A1A] pb-3"
            >
              {/* NOME */}
              <div className="flex justify-between items-center">
                <span className={`${color} truncate`}>
                  {item.nome}
                </span>

                <span className="text-sm text-muted">
                  {item.totalColaboradores}
                </span>
              </div>

              {/* MÉTRICAS */}
              <div className="
                flex
                flex-wrap
                gap-4
                mt-2
                text-xs"
              >
                <span className="text-[#6B7280]">
                  Faltas:{" "}
                  <span className="text-red-400 font-semibold">
                    {item.faltas}
                  </span>
                </span>

                <span className="text-[#6B7280]">
                  Atest.:{" "}
                  <span className="text-yellow-400 font-semibold">
                    {item.atestados}
                  </span>
                </span>

                <span className="text-[#6B7280]">
                  Abs:{" "}
                  <span className={`font-semibold ${absColor}`}>
                    {item.absenteismo}%
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
