import { useEffect, useState, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import RegionalModal from "../../../components/RegionalModal";
import RegionalTable from "../../../components/RegionalTable";
import { RegionaisAPI } from "../../../services/regionais";

export default function RegionaisPage() {
  const navigate = useNavigate();

  const [regionais, setRegionais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await RegionaisAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setRegionais(list);
    } catch (err) {
      console.error("Erro ao carregar regionais", err);
      alert("Erro ao carregar regionais");
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
              <h1 className="text-2xl font-semibold">Regionais</h1>
              <p className="text-sm text-[#BFBFC3]">
                Gestão de regionais e vínculo com empresas
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
              Nova Regional
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
              placeholder="Buscar por nome da regional"
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
                Carregando regionais…
              </div>
            ) : regionais.length === 0 ? (
              <div className="p-10 text-center text-[#BFBFC3]">
                Nenhuma regional cadastrada
              </div>
            ) : (
              <RegionalTable
                regionais={regionais}
                onEdit={(regional) => {
                  setSelected(regional);
                  setModalOpen(true);
                }}
                onDelete={async (regional) => {
                  if (
                    !window.confirm(
                      `Deseja excluir a regional "${regional.nome}"?`
                    )
                  )
                    return;

                  await RegionaisAPI.excluir(regional.idRegional);
                  load();
                }}
              />
            )}
          </section>
        </main>
      </div>

      {modalOpen && (
        <RegionalModal
          regional={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            if (selected) {
              await RegionaisAPI.atualizar(selected.idRegional, data);
            } else {
              await RegionaisAPI.criar(data);
            }
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
