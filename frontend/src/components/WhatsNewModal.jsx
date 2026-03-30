import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import CHANGELOG from "../config/changelog";

export default function WhatsNewModal({ onClose }) {
  const scrollRef = useRef(null);
  const [showArrow, setShowArrow] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowArrow(el.scrollHeight - el.scrollTop - el.clientHeight > 20);
  }, []);

  useEffect(() => {
    const t = setTimeout(checkScroll, 200);
    return () => clearTimeout(t);
  }, [checkScroll]);

  function scrollDown() {
    scrollRef.current?.scrollBy({ top: 160, behavior: "smooth" });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Modal — altura fixa para o flex funcionar */}
      <div
        style={{
          background: "#1A1A1C",
          border: "1px solid #2A2A2C",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "460px",
          height: "min(88vh, 600px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* HEADER — fixo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 20px 16px",
            borderBottom: "1px solid #2A2A2C",
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 16, margin: 0 }}>
              🚀 {CHANGELOG.titulo}
            </p>
            <p style={{ color: "#BFBFC3", fontSize: 12, margin: "2px 0 0" }}>
              Versão {CHANGELOG.version}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "none",
              border: "none",
              color: "#BFBFC3",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* SCROLL AREA — ocupa o espaço restante */}
        <div style={{ position: "relative", flexGrow: 1, overflow: "hidden" }}>
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            style={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              padding: "16px 20px 8px",
              scrollbarWidth: "none",
            }}
          >
            <style>{`
              .wnm-scroll::-webkit-scrollbar { display: none; }
            `}</style>

            <p style={{ color: "#BFBFC3", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Olá! Seja bem-vindo à versão{" "}
              <strong style={{ color: "#fff" }}>{CHANGELOG.version}</strong>.
              A partir de agora, todas as novidades e melhorias do sistema serão comunicadas por aqui.
            </p>

            {(CHANGELOG.categorias ?? []).map((cat, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <p
                  style={{
                    color: "#FA4C00",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                    margin: "0 0 10px",
                  }}
                >
                  {cat.tipo}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {cat.itens.map((item, j) => (
                    <li key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "#FA4C00", flexShrink: 0, marginTop: 2 }}>✦</span>
                      <span style={{ color: "#EDEDED", fontSize: 14, lineHeight: 1.5 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* SETA "ver mais" com gradiente */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 64,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 8,
              background: "linear-gradient(to bottom, transparent, #1A1A1C 75%)",
              pointerEvents: "none",
              opacity: showArrow ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          >
            <button
              onClick={scrollDown}
              aria-label="Ver mais"
              style={{
                pointerEvents: showArrow ? "auto" : "none",
                background: "#2A2A2C",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#BFBFC3",
                boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                animation: "wnm-bounce 1.2s ease-in-out infinite",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FA4C00"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#2A2A2C"; e.currentTarget.style.color = "#BFBFC3"; }}
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* FOOTER — fixo */}
        <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 14,
              border: "none",
              background: "#FA4C00",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(250,76,0,0.4)",
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
