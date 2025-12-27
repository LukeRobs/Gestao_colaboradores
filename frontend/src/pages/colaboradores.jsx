import { useEffect, useState, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import EmployeeTable from "../components/EmployeeTable";
import Pagination from "../components/Pagination";
import { ColaboradoresAPI } from "../services/colaboradores";

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [turnoSelecionado, setTurnoSelecionado] = useState("TODOS");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Estados para paginação
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
  setLoading(true);
  try {
    const params = {
      page,
      limit,
      search: query || undefined,
      turno: turnoSelecionado !== "TODOS" ? turnoSelecionado : undefined,
    };

    const res = await ColaboradoresAPI.listar(params);

    setEmployees(res.data);
    setTotalItems(res.pagination.total);
    setTotalPages(
      Math.max(1, Math.ceil(res.pagination.total / limit))
    );
  } catch (error) {
    console.error("Erro ao carregar colaboradores:", error);
    setEmployees([]);
    setTotalItems(0);
    setTotalPages(1);
  } finally {
    setLoading(false);
  }
}, [page, limit, query, turnoSelecionado]);


  useEffect(() => {
    load();
  }, [load]);

  const turnos = ["TODOS", "T1", "T2", "T3"];

  // Handlers para paginação
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1); // Reset para página 1 ao mudar limit
  };

  // Handler para query (reset página)
  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
    setPage(1);
  };

  // Handler para turno (reset página)
  const handleTurnoChange = (newTurno) => {
    setTurnoSelecionado(newTurno);
    setPage(1);
  };

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
            <h1 className="text-2xl font-semibold">Colaboradores</h1>
            <p className="text-sm text-[#BFBFC3]">
              Gestão e controle de colaboradores ativos
            </p>
          </div>

          {/* FILTROS + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4">

            <div className="flex items-center gap-3 flex-wrap">
              {/* BUSCA */}
              <div className="flex items-center gap-2 bg-[#1A1A1C] px-4 py-2 rounded-xl">
                <Search size={16} className="text-[#BFBFC3]" />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="bg-transparent outline-none text-sm text-white placeholder-[#BFBFC3]"
                />
              </div>

              {/* TURNO */}
              <select
                value={turnoSelecionado}
                onChange={(e) => handleTurnoChange(e.target.value)}
                className="
                  bg-[#1A1A1C]
                  text-sm
                  px-4 py-2
                  rounded-xl
                  text-[#BFBFC3]
                  outline-none
                  hover:bg-[#2A2A2C]
                "
              >
                {turnos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* NOVO COLABORADOR */}
            <button
              onClick={() => navigate("/colaboradores/novo")}
              className="
                inline-flex items-center gap-2
                px-5 py-2.5
                bg-[#FA4C00]
                hover:bg-[#ff5a1a]
                text-sm font-medium
                rounded-xl
                transition
              "
            >
              <Plus size={16} />
              Novo Colaborador
            </button>
          </div>

          {/* LISTA */}
          <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-[#BFBFC3]">
                Carregando colaboradores…
              </div>
            ) : employees.length === 0 ? (
              <div className="p-6 text-center text-[#BFBFC3]">
                Nenhum colaborador encontrado. <br />
                Tente ajustar os filtros ou a busca.
              </div>
            ) : (
              <>
                <EmployeeTable
                  employees={employees}
                  onView={(emp) =>
                    navigate(`/colaboradores/${emp.opsId}`)
                  }
                  onDelete={async (emp) => {
                    if (!window.confirm(`Excluir ${emp.nomeCompleto}?`)) return;
                    try {
                      await ColaboradoresAPI.excluir(emp.opsId);
                      load();
                    } catch {
                      alert("Erro ao excluir colaborador.");
                    }
                  }}
                />
                {/* PAGINAÇÃO - SEMPRE MOSTRADA, MESMO COM 1 PÁGINA */}
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  limit={limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                />
              </>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}