import { useEffect, useState, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import EstacaoModal from "../../../components/EstacaoModal";
import EstacaoTable from "../../../components/EstacaoTable";
import { EstacoesAPI } from "../../../services/estacoes";

export default function EstacoesPage() {
  const navigate = useNavigate();

  const [estacoes, setEstacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await EstacoesAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setEstacoes(list);
    } catch (err) {
      console.error("Erro ao carregar estações", err);
      alert("Erro ao carregar estações");
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Estações</h1>
              <p className="text-sm text-[#BFBFC3]">
                Gestão de estações e vínculo com regionais
              </p>
            </div>

            <button
              onClick={() => {
                setSelected(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-[#FA4C00] hover:bg-[#ff5a1a] text-sm font-medium"
            >
              <Plus size={16} />
              Nova Estação
            </button>
          </div>

          {/* SEARCH */}
          <div className="relative w-96">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFBFC3]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome da estação"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl
                bg-[#1A1A1C] border border-[#3D3D40]
                text-sm text-white placeholder:text-[#BFBFC3]
                focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          {/* TABLE */}
          <section className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-[#BFBFC3]">
                Carregando estações…
              </div>
            ) : estacoes.length === 0 ? (
              <div className="p-10 text-center text-[#BFBFC3]">
                Nenhuma estação cadastrada
              </div>
            ) : (
              <EstacaoTable
                estacoes={estacoes}
                onEdit={(estacao) => {
                  setSelected(estacao);
                  setModalOpen(true);
                }}
                onDelete={async (estacao) => {
                  if (
                    !window.confirm(
                      `Deseja excluir a estação "${estacao.nome}"?`
                    )
                  )
                    return;

                  await EstacoesAPI.excluir(estacao.idEstacao);
                  load();
                }}
              />
            )}
          </section>
        </main>
      </div>

      {modalOpen && (
        <EstacaoModal
          estacao={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            if (selected) {
              await EstacoesAPI.atualizar(selected.idEstacao, data);
            } else {
              await EstacoesAPI.criar(data);
            }
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
