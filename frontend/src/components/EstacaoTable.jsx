import { useContext, useState } from "react";
import { Radio, Pencil, Trash2 } from "lucide-react";
import { ThemeContext } from "../context/ThemeContext";

const THEME = {
  dark: {
    card: "#111113", cardBorder: "#27272A",
    textMain: "#F4F4F5", textMuted: "#A1A1AA", textSubtle: "#71717A",
    editBg: "#18181B", editBorder: "#27272A", editText: "#A1A1AA", editHover: "#27272A",
    deleteBg: "#200F0F", deleteBorder: "#7F1D1D", deleteText: "#F87171", deleteHover: "#2D0F0F",
    avatarBg: "#1E293B", avatarText: "#94A3B8",
    emptyText: "#71717A",
  },
  light: {
    card: "#FFFFFF", cardBorder: "#E4E4E7",
    textMain: "#18181B", textMuted: "#52525B", textSubtle: "#A1A1AA",
    editBg: "#FFFFFF", editBorder: "#E4E4E7", editText: "#52525B", editHover: "#F9FAFB",
    deleteBg: "#FEF2F2", deleteBorder: "#FECACA", deleteText: "#DC2626", deleteHover: "#FEE2E2",
    avatarBg: "#F1F5F9", avatarText: "#475569",
    emptyText: "#A1A1AA",
  },
};

export default function EstacaoTable({ estacoes, onEdit, onDelete }) {
  const { isDark } = useContext(ThemeContext);
  const T = THEME[isDark ? "dark" : "light"];

  if (!estacoes?.length) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: T.emptyText, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Radio size={40} strokeWidth={1.2} style={{ opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>Nenhuma estação cadastrada</p>
      </div>
    );
  }

  const cols = Math.min(estacoes.length, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: 20 }}>
      {estacoes.map((e) => (
        <EstacaoCard key={e.idEstacao} estacao={e} T={T} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function EstacaoCard({ estacao: e, T, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const nome    = e.nomeEstacao || e.nome || "—";
  const inicial = nome[0]?.toUpperCase() || "?";

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
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textMain }}>{nome}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textSubtle }}>ID #{e.idEstacao}</p>
        </div>
      </div>

      {/* regional */}
      {e.regional?.nome && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.textSubtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>Regional</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{e.regional.nome}</span>
        </div>
      )}

      {/* ações */}
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}` }}>
        <ActionBtn label="Editar"  icon={<Pencil size={13}/>} bg={T.editBg}   border={T.editBorder}   color={T.editText}   hover={T.editHover}   onClick={() => onEdit(e)} />
        <ActionBtn label="Excluir" icon={<Trash2 size={13}/>} bg={T.deleteBg} border={T.deleteBorder} color={T.deleteText} hover={T.deleteHover} onClick={() => onDelete(e)} />
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
