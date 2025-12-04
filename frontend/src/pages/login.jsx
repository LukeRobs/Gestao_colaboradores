import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      console.log("Resposta completa:", response.data);

      const { user, token } = response.data.data;

      if (!token) {
        setError("Token não recebido do servidor.");
        return;
      }

      console.log("✅ Token recebido:", token.substring(0, 20) + "...");
      console.log("✅ User recebido:", user.name);

      // 🔥 SALVA NO LOCALSTORAGE PARA O AXIOS USAR AUTOMÁTICO
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Atualiza contexto global
      login(user, token);

      // Redireciona
      navigate("/");

    } catch (err) {
      console.error("❌ Erro no login:", err);
      setError(err.response?.data?.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Bem-vindo
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl placeholder-gray-300 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full pl-12 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-xl placeholder-gray-300 text-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 p-3 bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-400 text-center">
            <strong>Teste:</strong> Use suas credenciais cadastradas.
          </p>
        </div>
      </div>
    </div>
  );
}
