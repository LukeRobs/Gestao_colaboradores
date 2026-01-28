// src/pages/DailyWorks/dwList.jsx
import { useEffect, useState, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

/* ==============================
   EMPRESAS FIXAS (OFICIAIS DW)
============================== */
const EMPRESAS_FIXAS = [
  { id: 12, nome: "SRM" },
  { id: 13, nome: "Fenix" },
  { id: 14, nome: "Horeca" },
];

export default function DwListPage() {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState("");
  const [turno, setTurno] = useState("TODOS");
  const [empresa, setEmpresa] = useState("TODAS");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        data: data || undefined,
        idTurno: turno !== "TODOS" ? turno : undefined,
        idEmpresa: empresa !== "TODAS" ? empresa : undefined,
      };

      const res = await api.get("/dw/lista", { params });
      setLista(res.data.data || []);
    } catch (error) {
      console.error("Erro ao carregar DW:", error);
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [data, turno, empresa]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Daily Works</h1>
            <p className="text-sm text-[#BFBFC3]">
              Controle de diaristas planejados x realizados
            </p>
          </div>

          {/* FILTROS + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* DATA */}
              <div className="bg-[#1A1A1C] px-4 py-2 rounded-xl">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="bg-transparent outline-none text-sm text-white"
                />
              </div>

              {/* TURNO */}
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="bg-[#1A1A1C] text-sm px-4 py-2 rounded-xl text-[#BFBFC3] outline-none hover:bg-[#2A2A2C]"
              >
                <option value="TODOS">Turnos</option>
                <option value="1">T1</option>
                <option value="2">T2</option>
                <option value="3">T3</option>
              </select>

              {/* EMPRESA */}
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="bg-[#1A1A1C] text-sm px-4 py-2 rounded-xl text-[#BFBFC3] outline-none hover:bg-[#2A2A2C]"
              >
                <option value="TODAS">Empresas</option>
                {EMPRESAS_FIXAS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>

              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1C] hover:bg-[#2A2A2C] text-sm rounded-xl"
              >
                <Search size={16} />
                Filtrar
              </button>
            </div>

            {/* NOVO DW */}
            <button
              onClick={() => navigate("/dw/novo")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] text-sm font-medium rounded-xl transition"
            >
              <Plus size={16} />
              Novo DW
            </button>
          </div>

          {/* LISTA */}
          <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-[#BFBFC3]">Carregando dados…</div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center text-[#BFBFC3]">
                Nenhum registro encontrado.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[#2A2A2C] text-[#BFBFC3]">
                  <tr>
                    <th className="px-6 py-4 text-left">Data</th>

                    {EMPRESAS_FIXAS.map((e) => (
                      <th key={e.id} className="px-6 py-4 text-center">
                        {e.nome}
                      </th>
                    ))}

                    <th className="px-6 py-4 text-center">Total Planejado</th>
                    <th className="px-6 py-4 text-center">Total Real</th>
                    <th className="px-6 py-4 text-center">Turno</th>
                  </tr>
                </thead>

                <tbody>
                  {lista.map((row, idx) => {
                    const atingiu = row.totalReal >= row.planejado;

                    return (
                      <tr
                        key={idx}
                        className="border-t border-[#2A2A2C] hover:bg-[#242426]"
                      >
                        <td className="px-6 py-4">{row.data}</td>

                        {EMPRESAS_FIXAS.map((emp) => (
                          <td key={emp.id} className="px-6 py-4 text-center font-semibold">
                            {row.empresas?.[emp.nome] || 0}
                          </td>
                        ))}

                        <td className="px-6 py-4 text-center font-semibold">
                          {row.planejado}
                        </td>

                        <td
                          className={`px-6 py-4 text-center font-semibold ${
                            atingiu ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {row.totalReal}
                        </td>

                        <td className="px-6 py-4 text-center font-semibold">
                          {row.turno}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
