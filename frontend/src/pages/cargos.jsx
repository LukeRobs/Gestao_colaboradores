import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import LoadingScreen from "../components/LoadingScreen";
import CargoModal from "../components/CargoModal";
import CargoTable from "../components/CargoTable";
import { CargosAPI } from "../services/cargos";

export default function CargosPage() {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await CargosAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setCargos(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = cargos.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.nomeCargo.toLowerCase().includes(q) ||
      (c.nivel || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* HEADER */}
          <section className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cargos</h1>
              <p className="text-sm text-[#BFBFC3]">
                Gestão de cargos e níveis hierárquicos
              </p>
            </div>

            <button
              onClick={() => {
                setSelected(null);
                setModalOpen(true);
              }}
              className="
                flex items-center gap-2
                px-4 py-2 rounded-lg
                bg-[#FA4C00] hover:bg-[#e64500]
                text-white text-sm font-medium
              "
            >
              <Plus size={16} />
              Novo Cargo
            </button>
          </section>

          {/* FILTER */}
          <div className="relative w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFBFC3]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cargo ou nível"
              className="
                w-full pl-9 pr-4 py-2.5
                rounded-lg
                bg-[#1A1A1C]
                border border-[#3D3D40]
                text-sm text-white
                placeholder:text-[#BFBFC3]
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          {/* TABLE */}
          <section className="bg-[#1A1A1C] rounded-xl border border-[#3D3D40] overflow-hidden">
            {loading ? (
              <LoadingScreen message="Carregando cargos..." />
            ) : (
              <CargoTable
                cargos={filtered}
                onEdit={(c) => {
                  setSelected(c);
                  setModalOpen(true);
                }}
                onDelete={async (c) => {
                  if (!window.confirm(`Excluir ${c.nomeCargo}?`)) return;
                  try {
                    await CargosAPI.excluir(c.idCargo);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || "Erro ao excluir cargo");
                  }
                }}
              />
            )}
          </section>
        </main>
      </div>

      {modalOpen && (
        <CargoModal
          cargo={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            try {
              if (selected) {
                await CargosAPI.atualizar(selected.idCargo, data);
              } else {
                await CargosAPI.criar(data);
              }
              setModalOpen(false);
              load();
            } catch (err) {
              alert(err?.response?.data?.message || "Erro ao salvar cargo");
            }
          }}
        />
      )}
    </div>
  );
}
