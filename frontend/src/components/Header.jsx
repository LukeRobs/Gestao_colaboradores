import { Menu, Sun, Moon, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";
import EstacaoSelector from "./EstacaoSelector";
import api from "../services/api";

/* ─── helpers ───────────────────────────────────────── */
const ROLE_LABEL = {
  ADMIN:       "Administrador",
  ALTA_GESTAO: "Alta Gestão",
  LIDERANCA:   "Liderança",
  OPERACAO:    "Operação",
};

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─── tema ──────────────────────────────────────────── */
function useHeaderTheme(isDark) {
  return isDark ? {
    header:         "#0D0D0F",
    headerBorder:   "#1F1F22",
    btnHover:       "#1A1A1C",
    breadcrumb:     "#71717A",
    sunColor:       "#FFD60A",
    moonColor:      "#A1A1AA",
    nameColor:      "#F4F4F5",
    roleColor:      "#71717A",
    chevronColor:   "#71717A",
    dropdown:       "#111113",
    dropdownBorder: "#27272A",
    dropdownShadow: "0 20px 60px rgba(0,0,0,0.55)",
    infoEmail:      "#A1A1AA",
    divider:        "#1F1F22",
    itemText:       "#A1A1AA",
    itemHoverText:  "#F4F4F5",
    itemHoverBg:    "#18181B",
    logoutText:     "#F87171",
    logoutHoverBg:  "#200F0F",
    avatarBg:       "#FA4C00",
    avatarText:     "#FFFFFF",
  } : {
    header:         "#FFFFFF",
    headerBorder:   "#E4E4E7",
    btnHover:       "#F4F4F5",
    breadcrumb:     "#A1A1AA",
    sunColor:       "#F59E0B",
    moonColor:      "#71717A",
    nameColor:      "#18181B",
    roleColor:      "#71717A",
    chevronColor:   "#A1A1AA",
    dropdown:       "#FFFFFF",
    dropdownBorder: "#E4E4E7",
    dropdownShadow: "0 20px 60px rgba(0,0,0,0.10)",
    infoEmail:      "#71717A",
    divider:        "#F4F4F5",
    itemText:       "#52525B",
    itemHoverText:  "#18181B",
    itemHoverBg:    "#F9FAFB",
    logoutText:     "#DC2626",
    logoutHoverBg:  "#FEF2F2",
    avatarBg:       "#FA4C00",
    avatarText:     "#FFFFFF",
  };
}

/* ─── componente principal ──────────────────────────── */
export default function Header({ onMenuClick }) {
  const { user, logout } = useContext(AuthContext);
  const { isDark, setIsDark } = useContext(ThemeContext);
  const navigate = useNavigate();
  const T = useHeaderTheme(isDark);

  const [open, setOpen]               = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOut = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleOut);
    document.addEventListener("keydown",   handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOut);
      document.removeEventListener("keydown",   handleEsc);
    };
  }, []);

  const initials    = getInitials(user?.name);
  const displayName = user?.name  || "Usuário";
  const roleLabel   = ROLE_LABEL[user?.role] || user?.role || "Usuário";

  return (
    <>
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px 0 16px",
          background: T.header,
          borderBottom: `1px solid ${T.headerBorder}`,
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* ── esquerda ────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="lg:hidden"
            onClick={onMenuClick}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: T.breadcrumb, transition: "background 0.15s",
            }}
          >
            <Menu size={20} />
          </button>

          <span
            className="hidden sm:block"
            style={{ fontSize: 13, color: T.breadcrumb }}
          >
            Dashboard
          </span>
        </div>

        {/* ── direita ─────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

          {/* seletor de estação */}
          <EstacaoSelector />

          {/* toggle tema */}
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? "Modo claro" : "Modo escuro"}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            {isDark
              ? <Sun  size={18} style={{ color: T.sunColor  }} />
              : <Moon size={18} style={{ color: T.moonColor }} />
            }
          </button>

          {/* user button + dropdown */}
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              onClick={() => setOpen(!open)}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.btnHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "5px 10px 5px 5px", borderRadius: 10, border: "none",
                background: "transparent", cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <Avatar initials={initials} size={34} radius={10} T={T} />

              <div
                className="hidden md:flex"
                style={{ flexDirection: "column", alignItems: "flex-start", gap: 1 }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 600, color: T.nameColor,
                  maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {displayName}
                </span>
                <span style={{
                  fontSize: 11, color: T.roleColor,
                  maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {roleLabel}
                </span>
              </div>

              <ChevronDown
                size={14}
                className="hidden md:block"
                style={{
                  color: T.chevronColor,
                  transition: "transform 0.2s",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* ── dropdown ──────────────────────────────── */}
            <div
              style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                width: 240,
                background: T.dropdown,
                border: `1px solid ${T.dropdownBorder}`,
                borderRadius: 14,
                boxShadow: T.dropdownShadow,
                overflow: "hidden",
                zIndex: 50,
                opacity: open ? 1 : 0,
                transform: open
                  ? "translateY(0) scale(1)"
                  : "translateY(-8px) scale(0.97)",
                pointerEvents: open ? "auto" : "none",
                transition: "opacity 0.15s ease, transform 0.15s ease",
                transformOrigin: "top right",
              }}
            >
              {/* info do usuário */}
              <div style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${T.divider}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Avatar initials={initials} size={38} radius={10} T={T} />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 600, color: T.nameColor,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
                  }}>
                    {displayName}
                  </p>
                  <p style={{
                    margin: "2px 0 0", fontSize: 11, color: T.infoEmail,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
                  }}>
                    {user?.email || ""}
                  </p>
                </div>
              </div>

              <div style={{ padding: "6px 0" }}>
                <DropdownItem
                  icon={<KeyRound size={15} />}
                  label="Mudar senha"
                  color={T.itemText}
                  hoverColor={T.itemHoverText}
                  hoverBg={T.itemHoverBg}
                  onClick={() => { setOpen(false); setShowPwModal(true); }}
                />
              </div>

              <div style={{ height: 1, background: T.divider }} />

              <div style={{ padding: "6px 0" }}>
                <DropdownItem
                  icon={<LogOut size={15} />}
                  label="Sair"
                  color={T.logoutText}
                  hoverColor={T.logoutText}
                  hoverBg={T.logoutHoverBg}
                  onClick={() => { logout(); navigate("/login"); }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {showPwModal && (
        <ChangePasswordModal
          isDark={isDark}
          onClose={() => setShowPwModal(false)}
        />
      )}
    </>
  );
}

/* ─── avatar ─────────────────────────────────────────── */
function Avatar({ initials, size, radius, T }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: T.avatarBg, color: T.avatarText,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
      letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

/* ─── item do dropdown ───────────────────────────────── */
function DropdownItem({ icon, label, color, hoverColor, hoverBg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "8px 14px", border: "none",
        background: hov ? hoverBg : "transparent",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 13, fontWeight: 500,
        color: hov ? hoverColor : color,
        cursor: "pointer", transition: "background 0.12s, color 0.12s",
        textAlign: "left",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── modal de mudar senha ───────────────────────────── */
function ChangePasswordModal({ isDark, onClose }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha,  setNovaSenha]  = useState("");
  const [confirmar,  setConfirmar]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  const M = isDark ? {
    overlay:       "rgba(0,0,0,0.7)",
    card:          "#111113",
    cardBorder:    "#27272A",
    textMain:      "#F4F4F5",
    textMuted:     "#A1A1AA",
    textSubtle:    "#71717A",
    inputBg:       "#18181B",
    inputBorder:   "#3F3F46",
    inputText:     "#F4F4F5",
    labelColor:    "#A1A1AA",
    iconBg:        "#1E1B30",
    iconColor:     "#A78BFA",
    closeBg:       "#18181B",
    closeHover:    "#27272A",
    closeColor:    "#A1A1AA",
    errorBg:       "#2A1A1A",
    errorText:     "#F87171",
    errorBorder:   "#7F1D1D",
    successBg:     "#1A2E1A",
    successText:   "#4ADE80",
    successBorder: "#166534",
    cancelBorder:  "#3F3F46",
    cancelHover:   "#1A1A1C",
  } : {
    overlay:       "rgba(0,0,0,0.4)",
    card:          "#FFFFFF",
    cardBorder:    "#E4E4E7",
    textMain:      "#18181B",
    textMuted:     "#52525B",
    textSubtle:    "#A1A1AA",
    inputBg:       "#FFFFFF",
    inputBorder:   "#D4D4D8",
    inputText:     "#18181B",
    labelColor:    "#52525B",
    iconBg:        "#EFF6FF",
    iconColor:     "#2563EB",
    closeBg:       "#F4F4F5",
    closeHover:    "#E4E4E7",
    closeColor:    "#71717A",
    errorBg:       "#FEF2F2",
    errorText:     "#DC2626",
    errorBorder:   "#FECACA",
    successBg:     "#F0FDF4",
    successText:   "#15803D",
    successBorder: "#BBF7D0",
    cancelBorder:  "#E4E4E7",
    cancelHover:   "#F4F4F5",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (novaSenha !== confirmar) { setError("As senhas não coincidem"); return; }
    if (novaSenha.length < 6)   { setError("A nova senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);
    try {
      await api.put("/auth/change-password", { senhaAtual, novaSenha });
      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(err?.response?.data?.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: M.overlay,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", padding: 20,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 400,
        background: M.card, border: `1px solid ${M.cardBorder}`,
        borderRadius: 18, padding: 28,
        boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 24px 80px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: M.iconBg, color: M.iconColor,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <KeyRound size={19} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: M.textMain }}>Mudar senha</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: M.textSubtle }}>Atualize sua senha de acesso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.background = M.closeHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = M.closeBg)}
            style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: M.closeBg, color: M.closeColor, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, lineHeight: 1, transition: "background 0.15s",
            }}
          >×</button>
        </div>

        {success && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: M.successBg, color: M.successText,
            border: `1px solid ${M.successBorder}`, fontSize: 13, fontWeight: 500,
          }}>✓ Senha alterada com sucesso!</div>
        )}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: M.errorBg, color: M.errorText,
            border: `1px solid ${M.errorBorder}`, fontSize: 13,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PwField label="Senha atual"          value={senhaAtual} onChange={setSenhaAtual} M={M} />
          <PwField label="Nova senha"           value={novaSenha}  onChange={setNovaSenha}  M={M} />
          <PwField label="Confirmar nova senha" value={confirmar}  onChange={setConfirmar}  M={M} />

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              onMouseEnter={(e) => (e.currentTarget.style.background = M.cancelHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: `1px solid ${M.cancelBorder}`,
                background: "transparent", color: M.textMuted,
                fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 0.15s",
              }}
            >Cancelar</button>
            <button type="submit" disabled={loading || success}
              style={{
                flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
                background: loading || success ? "#71717A" : "#FA4C00",
                color: "#FFFFFF", fontSize: 13, fontWeight: 600,
                cursor: loading || success ? "not-allowed" : "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading && !success) e.currentTarget.style.background = "#FF5A1A"; }}
              onMouseLeave={(e) => { if (!loading && !success) e.currentTarget.style.background = "#FA4C00"; }}
            >{loading ? "Salvando…" : success ? "Salvo!" : "Salvar senha"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PwField({ label, value, onChange, M }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: M.labelColor, marginBottom: 5 }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required
        style={{
          width: "100%", padding: "9px 12px", borderRadius: 9,
          background: M.inputBg,
          border: `1px solid ${focused ? "#FA4C00" : M.inputBorder}`,
          color: M.inputText, fontSize: 13, outline: "none",
          transition: "border-color 0.15s", boxSizing: "border-box",
        }}
      />
    </div>
  );
}
