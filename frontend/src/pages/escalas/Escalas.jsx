import { useState, useEffect, useCallback, useContext } from "react";
import { Plus, Search, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import EscalaModal from "../../components/EscalaModal";
import EscalaTable from "../../components/EscalaTable";
import { EscalasAPI } from "../../services/escalas";
import { ThemeContext } from "../../context/ThemeContext";

export default function EscalasPage() {
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);
  const [escalas,     setEscalas]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [query,       setQuery]       = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const bg         = isDark ? "#0D0D0D" : "#F3F4F6";
  const textMain   = isDark ? "#F4F4F5" : "#18181B";
  const textMuted  = isDark ? "#A1A1AA" : "#52525B";
  const cardBg     = isDark ? "#111113" : "#FFFFFF";
  const cardBorder = isDark ? "#27272A" : "#E4E4E7";
  const inputBg    = isDark ? "#18181B" : "#FFFFFF";
  const inputBorder= isDark ? "#3F3F46" : "#D4D4D8";
  const inputText  = isDark ? "#F4F4F5" : "#18181B";
  const countBg    = isDark ? "#1C1C3B" : "#EEF2FF";
  const countBorder= isDark ? "#312E81" : "#C7D2FE";
  const countText  = isDark ? "#818CF8" : "#4338CA";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await EscalasAPI.listar();
      setEscalas(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Erro ao carregar escalas", err);
      setEscalas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = escalas.filter((e) =>
    e.nomeEscala.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, color: textMain }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(250,76,0,0.12)", color: "#FA4C00",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CalendarDays size={20} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textMain }}>Escalas</h1>
                <p style={{ margin: 0, fontSize: 13, color: textMuted }}>Gestão de escalas de trabalho</p>
              </div>
              <span style={{
                padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: countBg, border: `1px solid ${countBorder}`, color: countText,
              }}>
                {escalas.length}
              </span>
            </div>
            <button
              onClick={() => { setSelected(null); setModalOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 10, border: "none",
                background: "#FA4C00", color: "#FFFFFF",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e64500")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FA4C00")}
            >
              <Plus size={16} />
              Nova Escala
            </button>
          </div>

          {/* search */}
          <div style={{ position: "relative", width: 288 }}>
            <Search size={15} style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              color: textMuted, pointerEvents: "none",
            }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar escala"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%", padding: "9px 14px 9px 34px",
                borderRadius: 10, background: inputBg,
                border: `1px solid ${searchFocused ? "#FA4C00" : inputBorder}`,
                color: inputText, fontSize: 13, outline: "none",
                boxSizing: "border-box", transition: "border-color 0.15s",
              }}
            />
          </div>

          {/* card container */}
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 16, overflow: "hidden",
          }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: textMuted, fontSize: 14 }}>
                Carregando escalas...
              </div>
            ) : (
              <EscalaTable
                escalas={filtered}
                onEdit={(e) => { setSelected(e); setModalOpen(true); }}
                onDelete={async (e) => {
                  if (!window.confirm(`Excluir a escala "${e.nomeEscala}"?`)) return;
                  try {
                    await EscalasAPI.excluir(e.idEscala);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || "Erro ao excluir escala");
                  }
                }}
              />
            )}
          </div>
        </main>
      </div>

      {modalOpen && (
        <EscalaModal
          escala={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            try {
              if (selected) {
                await EscalasAPI.atualizar(selected.idEscala, data);
              } else {
                await EscalasAPI.criar(data);
              }
              setModalOpen(false);
              load();
            } catch (err) {
              alert(err?.response?.data?.message || "Erro ao salvar escala");
            }
          }}
        />
      )}
    </div>
  );
}
