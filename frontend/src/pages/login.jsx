import { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, UserPlus } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================================================
     MENSAGEM DE SUCESSO VINDO DO CADASTRO
  ===================================================== */
  useEffect(() => {
    if (location.state?.success) {
      setSuccess(location.state.success);

      // limpa o state sem recarregar a página
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);


  /* =====================================================
     LOGIN
  ===================================================== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !senha) {
      setError("Preencha todos os campos.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email,
        password: senha,
      });

      const { user, token } = response.data.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      login(user, token);

      // 🔥 REDIRECIONAMENTO POR ROLE
      if (user.role === "OPERACAO") {
        navigate("/ponto", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }

    } catch (err) {
      setError(err.response?.data?.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-lg bg-surface border border-default rounded-2xl p-10 shadow-2xl">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Gestão RH
          </h1>
          <p className="text-sm text-muted">
            Acesse sua conta para continuar
          </p>
        </div>

        {/* SUCCESS */}
        {success && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-[#34C759]/40 bg-[#34C759]/10">
            <p className="text-sm text-[#34C759] text-center">
              {success}
            </p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-[#FF453A]/40 bg-[#FF453A]/10">
            <p className="text-sm text-[#FF453A] text-center">
              {error}
            </p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* EMAIL */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="
                w-full pl-12 pr-4 py-3
                bg-surface-2
                border border-default
                rounded-xl
                text-page
                placeholder:text-muted
                focus:outline-none
                focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          {/* SENHA */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="
                w-full pl-12 pr-12 py-3
                bg-surface-2
                border border-default
                rounded-xl
                text-page
                placeholder:text-muted
                focus:outline-none
                focus:ring-1 focus:ring-[#FA4C00]
              "
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* BOTÃO ENTRAR */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 rounded-xl
              bg-[#FA4C00]
              hover:bg-[#ff5e1a]
              text-white font-medium
              transition
              disabled:opacity-50
            "
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* DIVIDER */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#3D3D40]" />
          <span className="text-xs text-muted">ou</span>
          <div className="flex-1 h-px bg-[#3D3D40]" />
        </div>

        {/* CADASTRO */}
        <button
          onClick={() => navigate("/register")}
          className="
            w-full flex items-center justify-center gap-2
            py-3 rounded-xl
            border border-default
            bg-surface
            hover:bg-surface-2
            text-muted
            transition
          "
        >
          <UserPlus size={18} />
          Criar nova conta
        </button>
      </div>
    </div>
  );
}
