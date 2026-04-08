import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, Hash, Eye, EyeOff, Radio } from "lucide-react";
import api from "../services/api";
import { ThemeContext } from "../context/ThemeContext";

export default function Register() {
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);

  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [opsId,      setOpsId]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [idEstacao,  setIdEstacao]  = useState("");
  const [estacoes,   setEstacoes]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const T = isDark ? {
    page:        "#0D0D0D",
    card:        "#111113",
    cardBorder:  "#27272A",
    cardShadow:  "0 24px 80px rgba(0,0,0,0.5)",
    textMain:    "#F4F4F5",
    textMuted:   "#A1A1AA",
    textSubtle:  "#71717A",
    inputBg:     "#18181B",
    inputBorder: "#3F3F46",
    inputText:   "#F4F4F5",
    iconColor:   "#71717A",
    selectBg:    "#18181B",
    errorBg:     "#2A1A1A",
    errorText:   "#F87171",
    errorBorder: "#7F1D1D",
  } : {
    page:        "#F3F4F6",
    card:        "#FFFFFF",
    cardBorder:  "#E4E4E7",
    cardShadow:  "0 24px 80px rgba(0,0,0,0.08)",
    textMain:    "#18181B",
    textMuted:   "#52525B",
    textSubtle:  "#A1A1AA",
    inputBg:     "#FFFFFF",
    inputBorder: "#D4D4D8",
    inputText:   "#18181B",
    iconColor:   "#A1A1AA",
    selectBg:    "#FFFFFF",
    errorBg:     "#FEF2F2",
    errorText:   "#DC2626",
    errorBorder: "#FECACA",
  };

  /* carrega estações ao montar (endpoint público) */
  useEffect(() => {
    api.get("/auth/estacoes")
      .then((res) => setEstacoes(res.data?.data || []))
      .catch(() => setEstacoes([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !opsId || !password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/register", {
        name,
        email,
        password,
        opsId,
        ...(idEstacao ? { idEstacao: parseInt(idEstacao) } : {}),
      });
      navigate("/login", {
        state: { success: "Conta criada com sucesso. Faça login para continuar." },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.page, padding: "20px",
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 20, padding: "40px 36px",
        boxShadow: T.cardShadow,
      }}>

        {/* logo / header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(250,76,0,0.12)", color: "#FA4C00",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
          }}>
            <User size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.textMain }}>
            Criar conta
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMuted }}>
            Contas criadas possuem acesso de liderança
          </p>
        </div>

        {/* erro */}
        {error && (
          <div style={{
            marginBottom: 18, padding: "10px 14px", borderRadius: 10,
            background: T.errorBg, color: T.errorText,
            border: `1px solid ${T.errorBorder}`, fontSize: 13, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* nome */}
          <Field
            type="text"
            placeholder="Nome completo"
            value={name}
            onChange={setName}
            icon={<User size={16} />}
            T={T}
          />

          {/* email */}
          <Field
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={setEmail}
            icon={<Mail size={16} />}
            T={T}
          />

          {/* ops id */}
          <Field
            type="text"
            placeholder="Ops ID (ex: Ops000000)"
            value={opsId}
            onChange={setOpsId}
            icon={<Hash size={16} />}
            T={T}
          />

          {/* senha */}
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
              color: T.iconColor, display: "flex", pointerEvents: "none",
            }}>
              <Lock size={16} />
            </div>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%", padding: "11px 40px 11px 40px",
                borderRadius: 10, background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                color: T.inputText, fontSize: 14, outline: "none",
                boxSizing: "border-box", transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FA4C00")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = T.inputBorder)}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", cursor: "pointer",
                color: T.iconColor, display: "flex", alignItems: "center",
                padding: 4, borderRadius: 6,
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* estação */}
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
              color: T.iconColor, display: "flex", pointerEvents: "none", zIndex: 1,
            }}>
              <Radio size={16} />
            </div>
            <select
              value={idEstacao}
              onChange={(e) => setIdEstacao(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px 11px 40px",
                borderRadius: 10, background: T.selectBg,
                border: `1px solid ${T.inputBorder}`,
                color: idEstacao ? T.inputText : T.iconColor,
                fontSize: 14, outline: "none", cursor: "pointer",
                boxSizing: "border-box", transition: "border-color 0.15s",
                appearance: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#FA4C00")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = T.inputBorder)}
            >
              <option value="">Selecionar estação (opcional)</option>
              {estacoes.map((e) => (
                <option key={e.idEstacao} value={e.idEstacao}>
                  {e.nomeEstacao}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, padding: "11px 0", borderRadius: 10, border: "none",
              background: loading ? "#71717A" : "#FA4C00",
              color: "#FFFFFF", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#FF5A1A"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#FA4C00"; }}
          >
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: T.textMuted }}>
          Já tem uma conta?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color: "#FA4C00", cursor: "pointer", fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Fazer login
          </span>
        </p>
      </div>
    </div>
  );
}

function Field({ type, placeholder, value, onChange, icon, T }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
        color: T.iconColor, display: "flex", pointerEvents: "none",
      }}>
        {icon}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "11px 14px 11px 40px",
          borderRadius: 10, background: T.inputBg,
          border: `1px solid ${focused ? "#FA4C00" : T.inputBorder}`,
          color: T.inputText, fontSize: 14, outline: "none",
          boxSizing: "border-box", transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}
