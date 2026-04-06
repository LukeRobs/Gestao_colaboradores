import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import TurnoModal from "../../components/TurnoModal";
import TurnoTable from "../../components/TurnoTable";
import { TurnosAPI } from "../../services/turnos";

export default function TurnosPage() {
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await TurnosAPI.listar();
      setTurnos(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Erro ao carregar turnos", err);
      setTurnos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = turnos.filter((t) =>
    t.nomeTurno.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
          <section className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Turnos</h1>
              <p className="text-sm text-[#BFBFC3]">Gestão de turnos e horários de trabalho</p>
            </div>
            <button
              onClick={() => { setSelected(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FA4C00] hover:bg-[#e64500] text-white text-sm font-medium"
            >
              <Plus size={16} />
              Novo Turno
            </button>
          </section>

          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BFBFC3]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar turno"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#1A1A1C] border border-[#3D3D40] text-sm text-white placeholder:text-[#BFBFC3] focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          <section className="bg-[#1A1A1C] rounded-xl border border-[#3D3D40] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-[#BFBFC3]">Carregando turnos...</div>
            ) : (
              <TurnoTable
                turnos={filtered}
                onEdit={(t) => { setSelected(t); setModalOpen(true); }}
                onDelete={async (t) => {
                  if (!window.confirm(`Excluir o turno "${t.nomeTurno}"?`)) return;
                  try {
                    await TurnosAPI.excluir(t.idTurno);
                    load();
                  } catch (err) {
                    alert(err?.response?.data?.message || "Erro ao excluir turno");
                  }
                }}
              />
            )}
          </section>
        </main>
      </div>

      {modalOpen && (
        <TurnoModal
          turno={selected}
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            try {
              if (selected) {
                await TurnosAPI.atualizar(selected.idTurno, data);
              } else {
                await TurnosAPI.criar(data);
              }
              setModalOpen(false);
              load();
            } catch (err) {
              alert(err?.response?.data?.message || "Erro ao salvar turno");
            }
          }}
        />
      )}
    </div>
  );
}
