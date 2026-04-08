import { useEffect, useState, useCallback, useContext } from "react";
import { Plus, Search, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import RegionalModal from "../../../components/RegionalModal";
import RegionalTable from "../../../components/RegionalTable";
import { RegionaisAPI } from "../../../services/regionais";
import { ThemeContext } from "../../../context/ThemeContext";

export default function RegionaisPage() {
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);

  const bg          = isDark ? "#0D0D0D" : "#F3F4F6";
  const textMain    = isDark ? "#FFFFFF"  : "#111827";
  const textMuted   = isDark ? "#BFBFC3"  : "#6B7280";
  const cardBg      = isDark ? "#111113"  : "#FFFFFF";
  const cardBorder  = isDark ? "#27272A"  : "#E4E4E7";
  const inputBg     = isDark ? "#18181B"  : "#FFFFFF";
  const inputBorder = isDark ? "#3F3F46"  : "#D4D4D8";
  const inputText   = isDark ? "#F4F4F5"  : "#18181B";

  const [regionais,   setRegionais]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [query,       setQuery]       = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await RegionaisAPI.listar({ limit: 1000, search: query || undefined });
      setRegionais(list);
    } catch (err) {
      console.error("Erro ao carregar regionais", err);
      alert("Erro ao carregar regionais");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, color: textMain }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* header */}
          <div className="flex items-center justify-between">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(250,76,0,0.12)", color: "#FA4C00",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <MapPin size={18} />
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textMain }}>Regionais</h1>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: textMuted }}>
                Gestão de regionais e vínculo com empresas
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: isDark ? "#1E293B" : "#EFF6FF",
                border: `1px solid ${isDark ? "#334155" : "#BFDBFE"}`,
                color: isDark ? "#94A3B8" : "#1D4ED8",
              }}>
                <MapPin size={12} />
                {regionais.length} regional{regionais.length !== 1 ? "is" : ""}
              </span>
              <button
                onClick={() => { setSelected(null); setModalOpen(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: "#FA4C00", color: "#FFFFFF",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FF5A1A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#FA4C00")}
              >
                <Plus size={15} />
                Nova Regional
              </button>
            </div>
          </div>

          {/* search */}
          <div style={{ position: "relative", maxWidth: 400 }}>
            <Search size={15} style={{
              position: "absolute", left: 12,
              top: "50%", transform: "translateY(-50%)",
              color: textMuted, pointerEvents: "none",
            }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome da regional"
              style={{
                width: "100%", padding: "9px 12px 9px 36px",
                borderRadius: 10, background: inputBg,
                border: `1px solid ${inputBorder}`,
                color: inputText, fontSize: 13, outline: "none",
                boxSizing: "border-box", transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FA4C00")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = inputBorder)}
            />
          </div>

          {/* content */}
          <section style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: textMuted }}>Carregando regionais…</div>
            ) : regionais.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: textMuted, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <MapPin size={40} strokeWidth={1.2} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 14 }}>Nenhuma regional cadastrada</p>
              </div>
            ) : (
              <RegionalTable
                regionais={regionais}
                onEdit={(regional) => { setSelected(regional); setModalOpen(true); }}
                onDelete={async (regional) => {
                  if (!window.confirm(`Deseja excluir a regional "${regional.nome}"?`)) return;
                  try {
                    await RegionaisAPI.excluir(regional.idRegional);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || "Erro ao excluir regional");
                  }
                }}
              />
            )}
          </section>
        </main>
      </div>

      {modalOpen && (
        <RegionalModal
          regional={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            try {
              if (selected) {
                await RegionaisAPI.atualizar(selected.idRegional, data);
              } else {
                await RegionaisAPI.criar(data);
              }
              setModalOpen(false);
              load();
            } catch (err) {
              alert(err?.response?.data?.message || "Erro ao salvar regional");
            }
          }}
        />
      )}
    </div>
  );
}
