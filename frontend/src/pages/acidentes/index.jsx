// src/pages/acidentes/index.jsx
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";
import AcidenteCard from "../../components/AcidenteCard";
import { AcidentesAPI } from "../../services/acidentes";

export default function AcidentesPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [acidentes, setAcidentes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await AcidentesAPI.listar();
        if (mounted) setAcidentes(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar acidentes.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold">Acidentes</h1>
              <p className="text-sm text-[#BFBFC3]">
                Registro e acompanhamento de ocorrências
              </p>
            </div>

            <button
              onClick={() => navigate("/acidentes/novo")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] rounded-xl"
            >
              <Plus size={16} />
              Novo Acidente
            </button>
          </div>

          {loading ? (
            <LoadingScreen message="Carregando acidentes..." />
          ) : acidentes.length === 0 ? (
            <div className="text-center text-[#BFBFC3] py-10">Nenhum acidente registrado.</div>
          ) : (
            <div className="space-y-4">
              {acidentes.map((a) => (
                <AcidenteCard key={a.idAcidente || `${a.opsIdColaborador}-${a.dataOcorrencia}`} acidente={a} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
