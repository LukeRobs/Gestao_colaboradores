import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import SetorModal from "../components/SetorModal";
import SetorTable from "../components/SetorTable";
import { SetoresAPI } from "../services/setores";

export default function SetoresPage() {
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await SetoresAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setSetores(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Erro ao carregar setores", err);
      setSetores([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

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
              <h1 className="text-2xl font-bold">Setores</h1>
              <p className="text-sm text-[#BFBFC3]">
                Gestão de setores operacionais
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
              Novo Setor
            </button>
          </section>

          {/* SEARCH */}
          <div className="relative w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFBFC3]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar setor"
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
              <div className="p-8 text-center text-[#BFBFC3]">
                Carregando setores...
              </div>
            ) : setores.length === 0 ? (
              <div className="p-8 text-center text-[#BFBFC3]">
                Nenhum setor encontrado.
              </div>
            ) : (
              <SetorTable
                setores={setores}
                onEdit={(s) => {
                  setSelected(s);
                  setModalOpen(true);
                }}
                onDelete={async (s) => {
                  if (!window.confirm(`Excluir ${s.nomeSetor}?`)) return;
                  try {
                    await SetoresAPI.excluir(s.idSetor);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || "Erro ao excluir setor");
                  }
                }}
              />
            )}
          </section>
        </main>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <SetorModal
          setor={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            try {
              if (selected) {
                await SetoresAPI.atualizar(selected.idSetor, data);
              } else {
                await SetoresAPI.criar(data);
              }
              setModalOpen(false);
              load();
            } catch (err) {
              console.error("Erro ao salvar setor:", err);
              alert(err?.response?.data?.message || "Erro ao salvar setor");
            }
          }}
        />
      )}
    </div>
  );
}
