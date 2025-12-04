import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import CargoModal from "../components/CargoModal";
import CargoTable from "../components/CargoTable";
import { CargosAPI } from "../services/cargos";
import { useNavigate } from "react-router-dom"; // ⬅ ADICIONADO

export default function CargosPage() {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate(); // ⬅ ADICIONADO

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await CargosAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setCargos(list);
    } catch (err) {
      console.error("Erro ao listar cargos:", err);
      alert("Erro ao carregar cargos.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (cargo) => {
    setSelected(cargo);
    setModalOpen(true);
  };

  const handleDelete = async (cargo) => {
    if (!window.confirm(`Excluir o cargo "${cargo.nomeCargo}"?`)) return;
    try {
      await CargosAPI.excluir(cargo.idCargo);
      load();
    } catch (err) {
      console.error("Erro ao excluir cargo:", err);
      alert("Erro ao excluir cargo.");
    }
  };

  const filtered = cargos.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.nomeCargo.toLowerCase().includes(q) ||
      (c.nivel || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      
      {/* SIDEBAR — AGORA COM NAVIGATE */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}   // ⬅ AQUI ESTAVA FALTANDO
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Cargos
            </h1>

            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cargo..."
                className="px-4 py-2 rounded-xl border bg-white dark:bg-gray-800 dark:text-white"
              />

              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
              >
                <Plus className="w-4 h-4" />
                Adicionar Cargo
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
            {loading ? (
              <p className="p-6 text-gray-500">Carregando cargos...</p>
            ) : (
              <CargoTable
                cargos={filtered}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <CargoModal
          key={selected?.idCargo || "new"}
          cargo={selected}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (data) => {
            try {
              if (selected) {
                await CargosAPI.atualizar(selected.idCargo, data);
              } else {
                await CargosAPI.criar(data);
              }
              setModalOpen(false);
              setSelected(null);
              load();
            } catch (err) {
              console.error("Erro ao salvar cargo:", err);
              alert("Erro ao salvar cargo.");
            }
          }}
        />
      )}
    </div>
  );
}
