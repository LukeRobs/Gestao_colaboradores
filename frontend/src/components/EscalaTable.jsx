import { useContext, useState } from "react";
import { CalendarDays, Users, Pencil, Trash2 } from "lucide-react";
import { ThemeContext } from "../context/ThemeContext";

const THEME = {
  dark: {
    card: "#111113", cardBorder: "#27272A",
    textMain: "#F4F4F5", textMuted: "#A1A1AA", textSubtle: "#71717A",
    countBg: "#1E293B", countBorder: "#334155", countText: "#94A3B8",
    statusActiveBg: "#14532D", statusActiveBorder: "#166534", statusActiveText: "#4ADE80",
    statusInactiveBg: "#450A0A", statusInactiveBorder: "#7F1D1D", statusInactiveText: "#F87171",
    tagBg: "#1C1C3B", tagBorder: "#312E81", tagText: "#818CF8",
    editBg: "#18181B", editBorder: "#27272A", editText: "#A1A1AA", editHover: "#27272A",
    deleteBg: "#200F0F", deleteBorder: "#7F1D1D", deleteText: "#F87171", deleteHover: "#2D0F0F",
    avatarBg: "#1C1C3B", avatarText: "#818CF8",
    emptyText: "#71717A",
  },
  light: {
    card: "#FFFFFF", cardBorder: "#E4E4E7",
    textMain: "#18181B", textMuted: "#52525B", textSubtle: "#A1A1AA",
    countBg: "#EFF6FF", countBorder: "#BFDBFE", countText: "#1D4ED8",
    statusActiveBg: "#F0FDF4", statusActiveBorder: "#BBF7D0", statusActiveText: "#15803D",
    statusInactiveBg: "#FEF2F2", statusInactiveBorder: "#FECACA", statusInactiveText: "#DC2626",
    tagBg: "#EEF2FF", tagBorder: "#C7D2FE", tagText: "#4338CA",
    editBg: "#FFFFFF", editBorder: "#E4E4E7", editText: "#52525B", editHover: "#F9FAFB",
    deleteBg: "#FEF2F2", deleteBorder: "#FECACA", deleteText: "#DC2626", deleteHover: "#FEE2E2",
    avatarBg: "#EEF2FF", avatarText: "#4338CA",
    emptyText: "#A1A1AA",
  },
};

export default function EscalaTable({ escalas, onEdit, onDelete }) {
  const { isDark } = useContext(ThemeContext);
  const T = THEME[isDark ? "dark" : "light"];

  if (!escalas?.length) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: T.emptyText, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <CalendarDays size={40} strokeWidth={1.2} style={{ opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>Nenhuma escala cadastrada</p>
      </div>
    );
  }

  const cols = Math.min(escalas.length, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: 20 }}>
      {escalas.map((e) => (
        <EscalaCard key={e.idEscala} escala={e} T={T} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function EscalaCard({ escala: e, T, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const inicial = e.nomeEscala?.[0]?.toUpperCase() || "?";
  const ativo   = e.ativo !== false;
  const ativos  = e._count?.colaboradores ?? 0;
  const regime  = (e.diasTrabalhados != null && e.diasFolga != null)
    ? `${e.diasTrabalhados}x${e.diasFolga}`
    : null;

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
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
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textMain }}>{e.nomeEscala}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textSubtle }}>ID #{e.idEscala}</p>
          </div>
        </div>
        <span style={{
          padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          background: ativo ? T.statusActiveBg : T.statusInactiveBg,
          border: `1px solid ${ativo ? T.statusActiveBorder : T.statusInactiveBorder}`,
          color: ativo ? T.statusActiveText : T.statusInactiveText,
        }}>
          • {ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* tipo */}
        {e.tipoEscala && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: T.textSubtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo</span>
            <span style={{
              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: T.tagBg, border: `1px solid ${T.tagBorder}`, color: T.tagText,
            }}>
              {e.tipoEscala}
            </span>
          </div>
        )}

        {/* regime (dias trab x folga) */}
        {regime && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: T.textSubtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>Regime</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: T.tagBg, border: `1px solid ${T.tagBorder}`, color: T.tagText,
              fontVariantNumeric: "tabular-nums",
            }}>
              <CalendarDays size={11} />
              {regime}
            </span>
          </div>
        )}

        {/* colaboradores ativos */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.textSubtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>Colaboradores Ativos</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: T.countBg, border: `1px solid ${T.countBorder}`, color: T.countText,
          }}>
            <Users size={11} />
            {ativos}
          </span>
        </div>
      </div>

      {/* descrição */}
      {e.descricao && (
        <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.5, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 10 }}>
          {e.descricao}
        </p>
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
