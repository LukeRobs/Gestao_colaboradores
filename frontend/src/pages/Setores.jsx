import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import SetorModal from "../components/SetorModal";
import SetorTable from "../components/SetorTable";
import { SetoresAPI } from "../services/setores";

export default function SetoresPage() {
  const [setores, setSetores] = useState([]); // sempre array
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await SetoresAPI.listar({
        limit: 1000,
        search: query || undefined,
      });

      // Garante SEMPRE array
      setSetores(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Erro ao listar setores:", err);
      alert("Erro ao carregar setores.");
      setSetores([]); // fallback seguro
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

  const handleEdit = (setor) => {
    setSelected(setor);
    setModalOpen(true);
  };

  const handleDelete = async (setor) => {
    if (!window.confirm(`Excluir o setor "${setor.nomeSetor}"?`)) return;

    try {
      await SetoresAPI.excluir(setor.idSetor);
      load();
    } catch (err) {
      console.error("Erro ao excluir setor:", err);
      alert("Erro ao excluir setor.");
    }
  };

  // ----- FILTRO SEGURO -----
  const filtered = (setores || []).filter((s) => {
    if (!query) return true;
    return s.nomeSetor.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <div className="p-6">
          {/* HEADER PAGE */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Setores
            </h1>

            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar setor..."
                className="px-4 py-2 rounded-xl border bg-white dark:bg-gray-800 dark:text-white"
              />

              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
              >
                <Plus className="w-4 h-4" />
                Adicionar Setor
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
            {loading ? (
              <p className="p-6 text-gray-500">Carregando setores...</p>
            ) : (
              <SetorTable
                setores={filtered}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <SetorModal
          key={selected?.idSetor || "new"}
          setor={selected}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (data) => {
            try {
              if (selected) {
                await SetoresAPI.atualizar(selected.idSetor, data);
              } else {
                await SetoresAPI.criar(data);
              }
              setModalOpen(false);
              setSelected(null);
              load();
            } catch (err) {
              console.error("Erro ao salvar setor:", err);
              alert("Erro ao salvar setor.");
            }
          }}
        />
      )}
    </div>
  );
}
