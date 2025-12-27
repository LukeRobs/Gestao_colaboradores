import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MedidaDisciplinarCard from "../../components/MedidaDisciplinarCard";
import { MedidasDisciplinaresAPI } from "../../services/medidasDisciplinares";

export default function MedidasDisciplinaresPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [medidas, setMedidas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await MedidasDisciplinaresAPI.listar();
        if (mounted) {
          setMedidas(data);
        }
      } catch (err) {
        console.error("Erro ao carregar medidas disciplinares", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-6">
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold">Medidas Disciplinares</h1>
              <p className="text-sm text-[#BFBFC3]">
                Histórico disciplinar dos colaboradores
              </p>
            </div>

            <button
              onClick={() => navigate("/medidas-disciplinares/novo")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] rounded-xl"
            >
              <Plus size={16} />
              Nova Medida
            </button>
          </div>

          {/* LISTA */}
          {loading ? (
            <div className="text-center text-[#BFBFC3] py-10">
              Carregando medidas disciplinares…
            </div>
          ) : medidas.length === 0 ? (
            <div className="text-center text-[#BFBFC3] py-10">
              Nenhuma medida disciplinar registrada.
            </div>
          ) : (
            <div className="space-y-4">
              {medidas.map((m) => (
                <MedidaDisciplinarCard
                  key={m.idMedida}
                  medida={m}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
