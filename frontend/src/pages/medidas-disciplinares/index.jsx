import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MedidaDisciplinarCard from "../../components/MedidaDisciplinarCard";
import { MedidasDisciplinaresAPI } from "../../services/medidasDisciplinares";

export default function MedidasDisciplinaresPage() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [medidas, setMedidas] = useState([]);
  const [loading, setLoading] = useState(true);

  /* 🔎 FILTROS */
  const [filtroData, setFiltroData] = useState("");
  const [filtroNome, setFiltroNome] = useState("");

  /* ================= LOAD ================= */

  async function load() {
    setLoading(true);

    try {
      const data = await MedidasDisciplinaresAPI.listar({
        data: filtroData || undefined,
        nome: filtroNome || undefined,
      });

      setMedidas(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar medidas disciplinares");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  /* ================= ACTIONS ================= */

  async function refresh() {
    await load();
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-6">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Medidas Disciplinares
              </h1>

              <p className="text-sm text-muted">
                Histórico disciplinar dos colaboradores
              </p>
            </div>

            <button
              onClick={() => navigate("/medidas-disciplinares/novo")}
              className="
                flex items-center gap-2
                px-5 py-2.5
                bg-[#FA4C00]
                hover:bg-[#ff5a1a]
                rounded-xl
                text-sm font-medium
              "
            >
              <Plus size={16} />
              Nova Medida
            </button>
          </div>

          {/* 🔎 FILTROS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* DATA */}
            <div className="bg-surface px-4 py-2 rounded-xl">
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="bg-transparent outline-none text-sm text-white"
              />
            </div>

            {/* COLABORADOR */}
            <div className="bg-surface px-4 py-2 rounded-xl flex items-center gap-2">
              <Search size={14} className="text-[#6B7280]" />

              <input
                type="text"
                placeholder="Buscar colaborador"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="
                  bg-transparent
                  outline-none
                  text-sm
                  text-white
                  placeholder-[#6B7280]
                "
              />
            </div>

            <button
              onClick={load}
              className="
                px-4 py-2
                rounded-xl
                bg-surface
                hover:bg-surface-2
                text-sm
              "
            >
              Filtrar
            </button>
          </div>

          {/* LISTA */}

          {loading ? (
            <div className="text-muted">
              Carregando medidas disciplinares…
            </div>
          ) : medidas.length === 0 ? (
            <div className="text-muted">
              Nenhuma medida disciplinar encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {medidas.map((m) => (
                <MedidaDisciplinarCard
                  key={m.idMedida}
                  medida={m}
                  onAtualizado={refresh}
                />
              ))}
            </div>
          )}
        </main>
      </MainLayout>
    </div>
  );
}