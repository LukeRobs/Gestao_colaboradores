import { useContext, useState } from "react";
import { MapPin, Radio, Pencil, Trash2 } from "lucide-react";
import { ThemeContext } from "../context/ThemeContext";

const THEME = {
  dark: {
    card: "#111113", cardBorder: "#27272A",
    textMain: "#F4F4F5", textMuted: "#A1A1AA", textSubtle: "#71717A",
    tagBg: "#1E293B", tagBorder: "#334155", tagText: "#94A3B8",
    editBg: "#18181B", editBorder: "#27272A", editText: "#A1A1AA", editHover: "#27272A",
    deleteBg: "#200F0F", deleteBorder: "#7F1D1D", deleteText: "#F87171", deleteHover: "#2D0F0F",
    avatarBg: "#1E293B", avatarText: "#94A3B8",
    emptyText: "#71717A",
  },
  light: {
    card: "#FFFFFF", cardBorder: "#E4E4E7",
    textMain: "#18181B", textMuted: "#52525B", textSubtle: "#A1A1AA",
    tagBg: "#F1F5F9", tagBorder: "#CBD5E1", tagText: "#475569",
    editBg: "#FFFFFF", editBorder: "#E4E4E7", editText: "#52525B", editHover: "#F9FAFB",
    deleteBg: "#FEF2F2", deleteBorder: "#FECACA", deleteText: "#DC2626", deleteHover: "#FEE2E2",
    avatarBg: "#F1F5F9", avatarText: "#475569",
    emptyText: "#A1A1AA",
  },
};

export default function RegionalTable({ regionais, onEdit, onDelete }) {
  const { isDark } = useContext(ThemeContext);
  const T = THEME[isDark ? "dark" : "light"];

  if (!regionais?.length) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: T.emptyText, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <MapPin size={40} strokeWidth={1.2} style={{ opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>Nenhuma regional cadastrada</p>
      </div>
    );
  }

  const cols = Math.min(regionais.length, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: 20 }}>
      {regionais.map((r) => (
        <RegionalCard key={r.idRegional} regional={r} T={T} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function RegionalCard({ regional: r, T, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const inicial  = r.nome?.[0]?.toUpperCase() || "?";
  const estacoes = r.estacoes || [];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (T.card === "#FFFFFF" ? "#FAFAFA" : "#18181B") : T.card,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 14, padding: 18,
        display: "flex", flexDirection: "column", gap: 14,
        transition: "background 0.15s",
      }}
    >
      {/* topo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: T.avatarBg, color: T.avatarText,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 15,
        }}>
          {inicial}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textMain }}>{r.nome}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textSubtle }}>ID #{r.idRegional}</p>
        </div>
      </div>

      {/* estações */}
      {estacoes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <Radio size={11} style={{ color: T.textSubtle }} />
            <span style={{ fontSize: 11, color: T.textSubtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Estações ({estacoes.length})
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {estacoes.map((e) => (
              <span key={e.idEstacao} style={{
                padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: T.tagBg, border: `1px solid ${T.tagBorder}`, color: T.tagText,
              }}>
                {e.nomeEstacao}
              </span>
            ))}
          </div>
        </div>
      )}

      {estacoes.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: T.textSubtle, fontStyle: "italic" }}>
          Nenhuma estação vinculada
        </p>
      )}

      {/* ações */}
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}` }}>
        <ActionBtn label="Editar"  icon={<Pencil size={13}/>} bg={T.editBg}   border={T.editBorder}   color={T.editText}   hover={T.editHover}   onClick={() => onEdit(r)} />
        <ActionBtn label="Excluir" icon={<Trash2 size={13}/>} bg={T.deleteBg} border={T.deleteBorder} color={T.deleteText} hover={T.deleteHover} onClick={() => onDelete(r)} />
      </div>
    </div>
  );
}

function ActionBtn({ label, icon, bg, border, color, hover, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 0", borderRadius: 8,
        background: hov ? hover : bg,
        border: `1px solid ${border}`,
        color, fontSize: 12, fontWeight: 500,
        cursor: "pointer", transition: "background 0.12s",
      }}
    >
      {icon}{label}
    </button>
  );
}
