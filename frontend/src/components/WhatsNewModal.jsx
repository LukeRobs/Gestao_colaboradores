import { useRef, useState, useEffect, useCallback, useContext } from "react";
import { ChevronDown } from "lucide-react";
import CHANGELOG from "../config/changelog";
import { useRefIds } from "../hooks/useRefIds";
import { ThemeContext } from "../context/ThemeContext";

/* ─── helpers ─────────────────────────────────────────── */
function Col({ items, M }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(({ id, label, sub }) => (
        <div key={id} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ color: "#FA4C00", fontVariantNumeric: "tabular-nums", minWidth: 22, textAlign: "right", fontSize: 13, fontWeight: 600 }}>
            {id}
          </span>
          <span style={{ color: M.subtle, fontSize: 12 }}>→</span>
          <span style={{ color: M.text, fontSize: 13 }}>
            {label}
            {sub && <span style={{ color: M.subtle, fontSize: 11, marginLeft: 4 }}>{sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function RefSection({ title, items, keyId, keyLabel, keySub, M }) {
  if (!items?.length) return null;
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half).map(i => ({ id: i[keyId], label: i[keyLabel], sub: keySub ? i[keySub] : undefined }));
  const right = items.slice(half).map(i => ({ id: i[keyId], label: i[keyLabel], sub: keySub ? i[keySub] : undefined }));

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: "#FA4C00", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>
        {title}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
        <Col items={left} M={M} />
        <Col items={right} M={M} />
      </div>
    </div>
  );
}

/* ─── tab button ───────────────────────────────────────── */
function Tab({ label, active, onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #FA4C00" : "2px solid transparent",
        color: active ? (isDark ? "#fff" : "#111827") : (isDark ? "#888" : "#9CA3AF"),
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        padding: "8px 4px",
        cursor: "pointer",
        transition: "color 0.2s",
      }}
    >
      {label}
    </button>
  );
}

/* ─── main ─────────────────────────────────────────────── */
export default function WhatsNewModal({ onClose }) {
  const scrollRef = useRef(null);
  const [showArrow, setShowArrow] = useState(false);
  const [activeTab, setActiveTab] = useState("novidades");
  const { data: refs, loading: refsLoading } = useRefIds();
  const { isDark } = useContext(ThemeContext);

  const M = isDark ? {
    card:       "#1A1A1C",
    cardBorder: "#2A2A2C",
    text:       "#fff",
    muted:      "#BFBFC3",
    subtle:     "#888",
    tabBorder:  "#2A2A2C",
    gradient:   "#1A1A1C",
    btnBg:      "#2A2A2C",
    btnColor:   "#BFBFC3",
  } : {
    card:       "#FFFFFF",
    cardBorder: "#E5E7EB",
    text:       "#111827",
    muted:      "#6B7280",
    subtle:     "#9CA3AF",
    tabBorder:  "#E5E7EB",
    gradient:   "#FFFFFF",
    btnBg:      "#F3F4F6",
    btnColor:   "#6B7280",
  };

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowArrow(el.scrollHeight - el.scrollTop - el.clientHeight > 20);
  }, []);

  useEffect(() => {
    const t = setTimeout(checkScroll, 200);
    return () => clearTimeout(t);
  }, [checkScroll, activeTab]);

  function scrollDown() {
    scrollRef.current?.scrollBy({ top: 160, behavior: "smooth" });
  }

  // Monta label de escala com folga
  const escalasFormatadas = (refs?.escalas ?? []).map(e => ({
    ...e,
    _sub: e.descricao ? `(${e.descricao})` : undefined,
  }));

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        padding: "16px", boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: M.card, border: `1px solid ${M.cardBorder}`, borderRadius: "20px",
          width: "100%", maxWidth: "520px", height: "min(88vh, 620px)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden", boxSizing: "border-box",
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0", flexShrink: 0 }}>
          <div>
            <p style={{ color: M.text, fontWeight: 600, fontSize: 16, margin: 0 }}>
              🚀 {CHANGELOG.titulo}
            </p>
            <p style={{ color: M.muted, fontSize: 12, margin: "2px 0 0" }}>
              Versão {CHANGELOG.version}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", color: M.muted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
          >
            ×
          </button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 20, padding: "8px 20px 0", borderBottom: `1px solid ${M.tabBorder}`, flexShrink: 0 }}>
          <Tab label="Novidades" active={activeTab === "novidades"} onClick={() => setActiveTab("novidades")} isDark={isDark} />
          <Tab label="Referências de IDs" active={activeTab === "config"} onClick={() => setActiveTab("config")} isDark={isDark} />
        </div>

        {/* SCROLL AREA */}
        <div style={{ position: "relative", flexGrow: 1, overflow: "hidden" }}>
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="wnm-scroll"
            style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "16px 20px 8px", scrollbarWidth: "none" }}
          >
            <style>{`.wnm-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* ── ABA NOVIDADES ── */}
            {activeTab === "novidades" && (
              <>
                <p style={{ color: M.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  Olá! Seja bem-vindo à versão{" "}
                  <strong style={{ color: M.text }}>{CHANGELOG.version}</strong>.
                  A partir de agora, todas as novidades e melhorias do sistema serão comunicadas por aqui.
                </p>
                {(CHANGELOG.categorias ?? []).map((cat, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <p style={{ color: "#FA4C00", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>
                      {cat.nome}
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {cat.itens.map((item, j) => (
                        <li key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ color: "#FA4C00", flexShrink: 0, marginTop: 2 }}>✦</span>
                          <span style={{ color: M.text, fontSize: 14, lineHeight: 1.5 }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}

            {/* ── ABA REFERÊNCIAS ── */}
            {activeTab === "config" && (
              refsLoading ? (
                <p style={{ color: M.subtle, fontSize: 13, textAlign: "center", marginTop: 40 }}>Carregando...</p>
              ) : !refs ? (
                <p style={{ color: M.subtle, fontSize: 13, textAlign: "center", marginTop: 40 }}>Não foi possível carregar as referências.</p>
              ) : (
                <>
                  <RefSectionM={M} 
                    title="id_estacao"
                    items={refs.estacoes}
                    keyId="idEstacao"
                    keyLabel="nomeEstacao"
                  />
                  <RefSectionM={M} 
                    title="id_empresa"
                    items={refs.empresas}
                    keyId="idEmpresa"
                    keyLabel="razaoSocial"
                  />
                  <RefSectionM={M} 
                    title="id_setor"
                    items={refs.setores}
                    keyId="idSetor"
                    keyLabel="nomeSetor"
                  />
                  <RefSectionM={M} 
                    title="id_cargo"
                    items={refs.cargos}
                    keyId="idCargo"
                    keyLabel="nomeCargo"
                  />
                  <RefSectionM={M} 
                    title="id_turno"
                    items={refs.turnos}
                    keyId="idTurno"
                    keyLabel="nomeTurno"
                  />
                  <RefSectionM={M} 
                    title="id_escala"
                    items={escalasFormatadas}
                    keyId="idEscala"
                    keyLabel="nomeEscala"
                    keySub="_sub"
                  />
                </>
              )
            )}
          </div>

          {/* SETA "ver mais" */}
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
              display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8,
              background: `linear-gradient(to bottom, transparent, ${M.gradient} 75%)`,
              pointerEvents: "none", opacity: showArrow ? 1 : 0, transition: "opacity 0.3s",
            }}
          >
            <button
              onClick={scrollDown}
              aria-label="Ver mais"
              style={{
                pointerEvents: showArrow ? "auto" : "none",
                background: M.btnBg, border: "none", borderRadius: "50%",
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: M.btnColor, boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                animation: "wnm-bounce 1.2s ease-in-out infinite",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FA4C00"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = M.btnBg; e.currentTarget.style.color = M.btnColor; }}
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px", borderRadius: 14, border: "none",
              background: "#FA4C00", color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: "pointer", boxShadow: "0 0 12px rgba(250,76,0,0.4)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#ff5a10"}
            onMouseLeave={e => e.currentTarget.style.background = "#FA4C00"}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          >
            Entendido
          </button>
        </div>
      </div>

      <style>{`
        @keyframes wnm-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
      `}</style>
    </div>
  );
}
