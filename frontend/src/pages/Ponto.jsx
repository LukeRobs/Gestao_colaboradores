import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function PontoPage() {
  const [cpf, setCpf] = useState("");
  const [msg, setMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleRegistrar = async () => {
    try {
      const res = await api.post("/ponto/registrar", { cpf });
      setMsg(res.data.message);
    } catch (err) {
      setMsg(err.response?.data?.message || "Erro ao registrar ponto");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <div className="p-6 max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Registrar Ponto
          </h1>

          <div className="space-y-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-gray-700">
            <input
              type="text"
              placeholder="Digite seu CPF"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border"
            />

            <button
              onClick={handleRegistrar}
              className="w-full bg-blue-600 text-white py-2 rounded-xl"
            >
              Registrar Presença
            </button>

            {msg && (
              <p className="mt-3 text-center text-gray-900 dark:text-gray-200">
                {msg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
