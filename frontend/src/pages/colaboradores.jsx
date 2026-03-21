import { useEffect, useState, useCallback, useContext } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import EmployeeTable from "../components/EmployeeTable";
import Pagination from "../components/Pagination";
import LoadingScreen from "../components/LoadingScreen";
import { ColaboradoresAPI } from "../services/colaboradores";

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [turnoSelecionado, setTurnoSelecionado] = useState("TODOS");
  const [escalaSelecionada, setEscalaSelecionada] = useState("TODOS");
  const [liderSelecionado, setLiderSelecionado] = useState("TODOS");
  const [statusSelecionado, setStatusSelecionado] = useState("TODOS");
  const [cargoSelecionado, setCargoSelecionado] = useState("TODOS");

  const [lideres, setLideres] = useState([]);
  const [cargos, setCargos] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();
  const { permissions } = useContext(AuthContext);

  /* ================= CARREGAR LÍDERES ================= */
  useEffect(() => {
    const carregarLideres = async () => {
      try {
        const lideresData = await ColaboradoresAPI.listarLideres();
        setLideres(lideresData);
      } catch (error) {
        console.error("Erro ao carregar líderes:", error);
      }
    };

    carregarLideres();
  }, []);

  /* ================= CARREGAR CARGOS ================= */
  useEffect(() => {
    const carregarCargos = async () => {
      try {
        const cargosData = await ColaboradoresAPI.listarCargos();
        console.log("CARGOS:", cargos);
        setCargos(cargosData);
      } catch (error) {
        console.error("Erro ao carregar cargos:", error);
      }
    };

    carregarCargos();
  }, []);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page,
        limit,
        search: query || undefined,
        turno: turnoSelecionado !== "TODOS" ? turnoSelecionado : undefined,
        escala: escalaSelecionada !== "TODOS" ? escalaSelecionada : undefined,
        idLider: liderSelecionado !== "TODOS" ? liderSelecionado : undefined,
        status: statusSelecionado !== "TODOS" ? statusSelecionado : undefined,
        idCargo:
          cargoSelecionado !== "TODOS"
            ? Number(cargoSelecionado)
            : undefined,
      };

      const res = await ColaboradoresAPI.listar(params);

      setEmployees(res.data);
      setTotalItems(res.pagination.total);
      setTotalPages(Math.max(1, Math.ceil(res.pagination.total / limit)));
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      setEmployees([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    query,
    turnoSelecionado,
    escalaSelecionada,
    liderSelecionado,
    statusSelecionado,
    cargoSelecionado,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const turnos = [
    { label: "Turnos", value: "TODOS" },
    { label: "T1", value: "T1" },
    { label: "T2", value: "T2" },
    { label: "T3", value: "T3" },
  ];

  /* ================= HANDLERS ================= */
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleQueryChange = (val) => {
    setQuery(val);
    setPage(1);
  };

  const handleTurnoChange = (val) => {
    setTurnoSelecionado(val);
    setPage(1);
  };

  const handleEscalaChange = (val) => {
    setEscalaSelecionada(val);
    setPage(1);
  };

  const handleLiderChange = (val) => {
    setLiderSelecionado(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusSelecionado(val);
    setPage(1);
  };

  const handleCargoChange = (val) => {
    setCargoSelecionado(val);
    setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Colaboradores</h1>
            <p className="text-sm text-[#BFBFC3]">
              Gestão e controle de colaboradores ativos
            </p>
          </div>

          {/* FILTROS */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 w-full xl:w-auto">
              
              {/* BUSCA */}
              <div className="flex items-center gap-2 bg-[#1A1A1C] px-4 py-2 rounded-xl">
                <Search size={16} className="text-[#BFBFC3]" />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="bg-transparent outline-none text-sm text-white w-full"
                />
              </div>

              {/* TURNO */}
              <select
                value={turnoSelecionado}
                onChange={(e) => handleTurnoChange(e.target.value)}
                className="bg-[#1A1A1C] px-4 py-2 rounded-xl text-sm"
              >
                {turnos.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* ESCALA */}
              <select
                value={escalaSelecionada}
                onChange={(e) => handleEscalaChange(e.target.value)}
                className="bg-[#1A1A1C] px-4 py-2 rounded-xl text-sm"
              >
                <option value="TODOS">Escalas</option>
                <option value="A">Escala A</option>
                <option value="B">Escala B</option>
                <option value="C">Escala C</option>
              </select>

              {/* CARGO (DINÂMICO 🔥) */}
              <select
                value={cargoSelecionado}
                onChange={(e) => handleCargoChange(e.target.value)}
                className="bg-[#1A1A1C] px-4 py-2 rounded-xl text-sm"
              >
                <option value="TODOS">Cargos</option>
                {cargos.map((cargo) => (
                  <option key={cargo.idCargo} value={cargo.idCargo}>
                    {cargo.nomeCargo}
                  </option>
                ))}
              </select>

              {/* LÍDER */}
              <select
                value={liderSelecionado}
                onChange={(e) => handleLiderChange(e.target.value)}
                className="bg-[#1A1A1C] px-4 py-2 rounded-xl text-sm"
              >
                <option value="TODOS">Líderes</option>
                {lideres.map((lider) => (
                  <option key={lider.opsId} value={lider.opsId}>
                    {lider.nomeCompleto}
                  </option>
                ))}
              </select>

              {/* STATUS */}
              <select
                value={statusSelecionado}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-[#1A1A1C] px-4 py-2 rounded-xl text-sm"
              >
                <option value="TODOS">Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="AFASTADO">Afastado</option>
                <option value="FERIAS">Férias</option>
              </select>
            </div>

            {/* BOTÃO */}
            {permissions.isAdmin && (
              <button
                onClick={() => navigate("/colaboradores/novo")}
                className="px-5 py-2.5 bg-[#FA4C00] rounded-xl"
              >
                <Plus size={16} />
                Novo Colaborador
              </button>
            )}
          </div>

          {/* LISTA */}
          <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden">
            {loading ? (
              <LoadingScreen />
            ) : (
              <>
                <EmployeeTable employees={employees} />
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