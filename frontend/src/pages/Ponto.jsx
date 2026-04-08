import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

function formatCPF(value) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export default function PontoPage() {
  const [cpf, setCpf] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState(null); // success | error
  const [tipoBatida, setTipoBatida] = useState(null); // ENTRADA | SAIDA
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user } = useContext(AuthContext);
  const isKiosk = user?.role === "OPERACAO";

  const navigate = useNavigate();

  const handleRegistrar = async () => {
    if (cpf.length !== 11 || loading) return;

    setLoading(true);
    setMsg("");
    setMsgType(null);
    setTipoBatida(null);

    try {
      const payload = { cpf };
      if (user?.idEstacao) payload.estacaoId = user.idEstacao;

      const res = await api.post("/ponto/registrar", payload);

      setMsg(res.data.message || "Ponto registrado com sucesso");
      setMsgType("success");
      setTipoBatida(res.data.tipo || null);
      setCpf("");
    } catch (err) {
      setMsg(
        err.response?.data?.message ||
          "Erro ao registrar ponto. Procure o líder."
      );
      setMsgType("error");
      setTipoBatida(null);
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================
     AUTO LIMPAR FEEDBACK
  ========================================== */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => {
      setMsg("");
      setTipoBatida(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div
      className={`min-h-screen bg-page text-page ${
        isKiosk ? "flex items-center justify-center" : "flex"
      }`}
    >
      {/* SIDEBAR */}
      {!isKiosk && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigate={navigate}
        />
      )}

      <MainLayout disabled={isKiosk}>
        {/* HEADER */}
        {!isKiosk && <Header onMenuClick={() => setSidebarOpen(true)} />}

        {/* PAGE */}
        <main
          className={
            isKiosk
              ? "w-full flex items-center justify-center"
              : "px-8 py-6"
          }
        >
          <section
            className={`
              bg-surface border border-default rounded-2xl space-y-8
              ${isKiosk ? "w-[520px] p-10" : "max-w-md mx-auto p-6"}
            `}
          >
            {/* TEXTO EXPLICATIVO (SEMPRE VISÍVEL) */}
            <div className="text-center space-y-2">
              <h1
                className={`font-bold ${
                  isKiosk ? "text-3xl" : "text-2xl"
                }`}
              >
                Registrar Ponto
              </h1>
              <p
                className={`text-muted ${
                  isKiosk ? "text-base" : "text-sm"
                }`}
              >
                Digite apenas seu CPF para registrar entrada ou saída
              </p>
            </div>

            {/* CPF */}
            <div>
              <label className="block text-xs text-muted mb-2 text-center">
                CPF do colaborador
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="Somente números"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleRegistrar()}
                className={`
                  w-full rounded-xl
                  bg-surface-2
                  border border-default
                  text-white tracking-widest
                  placeholder:text-[#6F6F73]
                  focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
                  ${isKiosk ? "h-16 text-2xl px-6 text-center" : "px-4 py-3 text-lg"}
                `}
              />
            </div>

            {/* BOTÃO */}
            <button
              onClick={handleRegistrar}
              disabled={cpf.length !== 11 || loading}
              className={`
                w-full rounded-xl font-semibold transition
                ${
                  loading || cpf.length !== 11
                    ? "bg-[#3D3D40] cursor-not-allowed"
                    : "bg-[#FA4C00] hover:bg-[#e64500]"
                }
                ${isKiosk ? "h-16 text-xl" : "py-3"}
              `}
            >
              {loading ? "Registrando..." : "Registrar Ponto"}
            </button>

            {/* LINK PRODUTIVIDADE — apenas para OPERACAO */}
            {isKiosk && (
              <button
                onClick={() => navigate("/dashboard/produtividade-colaborador")}
                className="w-full rounded-xl font-semibold border border-default text-muted hover:bg-surface-2 transition h-12 text-base"
              >
                Ver Produtividade por Colaborador
              </button>
            )}

            {/* FEEDBACK */}
            {msg && (
              <div
                className={`
                  flex items-center justify-center gap-2
                  text-sm font-medium rounded-xl py-3 px-4
                  ${
                    msgType === "success"
                      ? tipoBatida === "ENTRADA"
                        ? "text-emerald-400 bg-emerald-600/10 border border-emerald-600/20"
                        : "text-sky-400 bg-sky-600/10 border border-sky-600/20"
                      : "text-red-400 bg-red-600/10 border border-red-600/20"
                  }
                `}
              >
                {msgType === "success" && tipoBatida === "ENTRADA" && <span>🟢</span>}
                {msgType === "success" && tipoBatida === "SAIDA" && <span>🔵</span>}
                {msgType === "error" && <span>🔴</span>}
                <span>{msg}</span>
              </div>
            )}
          </section>
        </main>
      </MainLayout>
    </div>
  );
}
