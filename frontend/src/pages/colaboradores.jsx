import { useEffect, useState, useCallback, useContext } from "react";
import { Plus, Search, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import toast from "react-hot-toast";

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
  const [setorSelecionado, setSetorSelecionado] = useState("TODOS");

  const [lideres, setLideres] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [backfillNcLoading, setBackfillNcLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const navigate = useNavigate();
  const { permissions } = useContext(AuthContext);

  /* ================= CARREGAR FILTROS DA ESTAÇÃO ================= */
  useEffect(() => {
    ColaboradoresAPI.listarFiltros()
      .then(({ escalas, turnos, setores, cargos }) => {
        setEscalas(escalas);
        setTurnos(turnos);
        setSetores(setores);
        setCargos(cargos);
      })
      .catch(() => {});
  }, []);

  /* ================= CARREGAR LÍDERES ================= */
  useEffect(() => {
    ColaboradoresAPI.listarLideres()
      .then(setLideres)
      .catch(() => {});
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
        idCargo: cargoSelecionado !== "TODOS" ? Number(cargoSelecionado) : undefined,
        idSetor: setorSelecionado !== "TODOS" ? Number(setorSelecionado) : undefined,
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
    setorSelecionado,
  ]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleSetorChange = (val) => {
    setSetorSelecionado(val);
    setPage(1);
  };

  const handleBackfillNc = async () => {
    if (!window.confirm("Preencher NC para todos os colaboradores admitidos neste mês (dias anteriores à admissão)? Esta ação não pode ser desfeita.")) return;
    try {
      setBackfillNcLoading(true);
      await ColaboradoresAPI.backfillNcPreAdmissao();
      toast.success("Backfill NC iniciado. Verifique os logs para acompanhar.");
    } catch {
      toast.error("Erro ao executar backfill NC.");
    } finally {
      setBackfillNcLoading(false);
    }
  };

  const handleExportarCsv = async () => {
    try {
      setExportando(true);
      const params = {
        search: query || undefined,
        turno: turnoSelecionado !== "TODOS" ? turnoSelecionado : undefined,
        escala: escalaSelecionada !== "TODOS" ? escalaSelecionada : undefined,
        idLider: liderSelecionado !== "TODOS" ? liderSelecionado : undefined,
        status: statusSelecionado !== "TODOS" ? statusSelecionado : undefined,
        idCargo: cargoSelecionado !== "TODOS" ? Number(cargoSelecionado) : undefined,
        idSetor: setorSelecionado !== "TODOS" ? Number(setorSelecionado) : undefined,
      };
      const res = await ColaboradoresAPI.exportarCsv(params);
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao exportar CSV.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Colaboradores</h1>
            <p className="text-sm text-muted">
              Gestão e controle de colaboradores ativos
            </p>
          </div>

          {/* FILTROS */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">

              {/* BUSCA */}
              <div className="flex items-center gap-2 bg-surface border border-default px-4 py-2 rounded-xl col-span-2 sm:col-span-3 lg:col-span-2 xl:col-span-2">
                <Search size={16} className="text-muted shrink-0" />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="bg-transparent outline-none text-sm text-page w-full placeholder:text-muted"
                />
              </div>

              {/* TURNO */}
              <select
                value={turnoSelecionado}
                onChange={(e) => handleTurnoChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page"
              >
                <option value="TODOS">Turnos</option>
                {turnos.map((t) => (
                  <option key={t.idTurno} value={t.nomeTurno}>{t.nomeTurno}</option>
                ))}
              </select>

              {/* ESCALA */}
              <select
                value={escalaSelecionada}
                onChange={(e) => handleEscalaChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page"
              >
                <option value="TODOS">Escalas</option>
                {escalas.map((e) => (
                  <option key={e.idEscala} value={e.nomeEscala}>{e.nomeEscala}</option>
                ))}
              </select>

              {/* SETOR */}
              <select
                value={setorSelecionado}
                onChange={(e) => handleSetorChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page"
              >
                <option value="TODOS">Setores</option>
                {setores.map((s) => (
                  <option key={s.idSetor} value={s.idSetor}>{s.nomeSetor}</option>
                ))}
              </select>

              {/* CARGO */}
              <select
                value={cargoSelecionado}
                onChange={(e) => handleCargoChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page"
              >
                <option value="TODOS">Cargos</option>
                {cargos.map((c) => (
                  <option key={c.idCargo} value={c.idCargo}>{c.nomeCargo}</option>
                ))}
              </select>

              {/* STATUS */}
              <select
                value={statusSelecionado}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page"
              >
                <option value="TODOS">Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="AFASTADO">Afastado</option>
                <option value="FERIAS">Férias</option>
              </select>
            </div>

            {/* LINHA 2: líder + ações */}
            <div className="flex flex-wrap items-center gap-3">
              {/* LÍDER */}
              <select
                value={liderSelecionado}
                onChange={(e) => handleLiderChange(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-xl text-sm text-page flex-1 min-w-[180px] max-w-xs"
              >
                <option value="TODOS">Líderes</option>
                {lideres.map((l) => (
                  <option key={l.opsId} value={l.opsId}>{l.nomeCompleto}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 ml-auto">
                {/* EXPORTAR CSV */}
                <button
                  onClick={handleExportarCsv}
                  disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-default hover:bg-surface-2 hover:border-[#FA4C00]/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-muted rounded-xl transition"
                >
                  <Download size={15} />
                  {exportando ? "Gerando CSV…" : "Exportar CSV"}
                </button>

                {/* BACKFILL NC — apenas ADMIN */}
                {permissions.isAdmin && (
                  <button
                    onClick={handleBackfillNc}
                    disabled={backfillNcLoading}
                    title="Preenche NC no banco para dias anteriores à admissão (mês atual)"
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-default hover:bg-surface-2 hover:border-yellow-500/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-muted rounded-xl transition"
                  >
                    {backfillNcLoading ? "Processando…" : "Preencher NC"}
                  </button>
                )}

                {/* NOVO COLABORADOR */}
                {(permissions.isAdmin || permissions.isAltaGestao) && (
                  <button
                    onClick={() => navigate("/colaboradores/novo")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] text-white rounded-xl font-medium text-sm"
                  >
                    <Plus size={16} />
                    Novo Colaborador
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* LISTA */}
          <div className="bg-surface rounded-2xl overflow-hidden">
            {loading ? (
              <LoadingScreen />
            ) : (
              <>
                <EmployeeTable
                  employees={employees}
                  onView={(emp) => {
                    console.log("VIEW CLICK:", emp);
                    navigate(`/colaboradores/${emp.opsId}`);
                  }}
                  onDelete={
                    permissions.isAdmin
                      ? async (emp) => {
                          if (!window.confirm(`Excluir ${emp.nomeCompleto}?`)) return;
                          try {
                            await ColaboradoresAPI.excluir(emp.opsId);
                            load();
                          } catch {
                            alert("Erro ao excluir colaborador.");
                          }
                        }
                      : null
                  }
                />
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
      </MainLayout>
    </div>
  );
}