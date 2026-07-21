import { useEffect, useState, useCallback, useContext } from "react";
import { Plus, Search, Download, Sheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import toast from "react-hot-toast";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import EmployeeTable from "../components/EmployeeTable";
import Pagination from "../components/Pagination";
import LoadingScreen from "../components/LoadingScreen";
import MultiSelect from "../components/MultiSelect";
import { ColaboradoresAPI } from "../services/colaboradores";
import { ExportColaboradoresAPI } from "../services/exportColaboradores";

const STATUS_OPTIONS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "AFASTADO", label: "Afastado" },
  { value: "FERIAS", label: "Férias" },
  { value: "CIPA", label: "CIPA" },
  { value: "GESTANTE", label: "Gestante" },
];

/* Monta os parâmetros de query a partir dos filtros (multi-select) selecionados */
function montarFiltrosParams({ turnos, escalas, lideres, status, cargos, setores }) {
  const statusPuros = status.filter((s) => s !== "CIPA" && s !== "GESTANTE");

  return {
    turno: turnos.length ? turnos.join(",") : undefined,
    escala: escalas.length ? escalas.join(",") : undefined,
    idLider: lideres.length ? lideres.join(",") : undefined,
    idCargo: cargos.length ? cargos.join(",") : undefined,
    idSetor: setores.length ? setores.join(",") : undefined,
    status: statusPuros.length ? statusPuros.join(",") : undefined,
    cipa: status.includes("CIPA") ? "true" : undefined,
    gestante: status.includes("GESTANTE") ? "true" : undefined,
  };
}

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [turnosSelecionados, setTurnosSelecionados] = useState([]);
  const [escalasSelecionadas, setEscalasSelecionadas] = useState([]);
  const [lideresSelecionados, setLideresSelecionados] = useState([]);
  const [statusSelecionados, setStatusSelecionados] = useState([]);
  const [cargosSelecionados, setCargosSelecionados] = useState([]);
  const [setoresSelecionados, setSetoresSelecionados] = useState([]);

  const [lideres, setLideres] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [backfillNcLoading, setBackfillNcLoading] = useState(false);

  /* ---- export automático para Google Sheets (só ADMIN) ---- */
  const [exportSheetsStatus, setExportSheetsStatus] = useState(null);
  const [segundosParaProximoExport, setSegundosParaProximoExport] = useState(null);
  const [exportandoSheets, setExportandoSheets] = useState(false);

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

  /* ================= EXPORT SHEETS: STATUS + CONTADOR ================= */
  const carregarExportSheetsStatus = useCallback(async () => {
    try {
      const status = await ExportColaboradoresAPI.status();
      setExportSheetsStatus(status);
    } catch {
      // silencioso: card fica oculto/sem dados se a chamada falhar
    }
  }, []);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    carregarExportSheetsStatus();
    const intervalo = setInterval(carregarExportSheetsStatus, 60000);
    return () => clearInterval(intervalo);
  }, [permissions.isAdmin, carregarExportSheetsStatus]);

  useEffect(() => {
    if (!permissions.isAdmin || !exportSheetsStatus?.proximaExecucao) {
      setSegundosParaProximoExport(null);
      return;
    }

    function calcularSegundos() {
      const alvo = new Date(exportSheetsStatus.proximaExecucao).getTime();
      return Math.max(0, Math.round((alvo - Date.now()) / 1000));
    }

    setSegundosParaProximoExport(calcularSegundos());
    const timer = setInterval(() => {
      setSegundosParaProximoExport(calcularSegundos());
    }, 1000);
    return () => clearInterval(timer);
  }, [permissions.isAdmin, exportSheetsStatus?.proximaExecucao]);

  function formatarContadorHoras(segundos) {
    if (segundos === null) return "--";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }

  const handleExportarSheetsAgora = async () => {
    try {
      setExportandoSheets(true);
      await ExportColaboradoresAPI.exportarAgora();
      toast.success("Exportação para o Sheets concluída.");
      await carregarExportSheetsStatus();
    } catch {
      toast.error("Erro ao exportar colaboradores para o Sheets.");
    } finally {
      setExportandoSheets(false);
    }
  };

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page,
        limit,
        search: query || undefined,
        ...montarFiltrosParams({
          turnos: turnosSelecionados,
          escalas: escalasSelecionadas,
          lideres: lideresSelecionados,
          status: statusSelecionados,
          cargos: cargosSelecionados,
          setores: setoresSelecionados,
        }),
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
    turnosSelecionados,
    escalasSelecionadas,
    lideresSelecionados,
    statusSelecionados,
    cargosSelecionados,
    setoresSelecionados,
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

  const handleTurnoChange = (vals) => {
    setTurnosSelecionados(vals);
    setPage(1);
  };

  const handleEscalaChange = (vals) => {
    setEscalasSelecionadas(vals);
    setPage(1);
  };

  const handleLiderChange = (vals) => {
    setLideresSelecionados(vals);
    setPage(1);
  };

  const handleStatusChange = (vals) => {
    setStatusSelecionados(vals);
    setPage(1);
  };

  const handleCargoChange = (vals) => {
    setCargosSelecionados(vals);
    setPage(1);
  };

  const handleSetorChange = (vals) => {
    setSetoresSelecionados(vals);
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
        ...montarFiltrosParams({
          turnos: turnosSelecionados,
          escalas: escalasSelecionadas,
          lideres: lideresSelecionados,
          status: statusSelecionados,
          cargos: cargosSelecionados,
          setores: setoresSelecionados,
        }),
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
              <MultiSelect
                label="Turnos"
                selected={turnosSelecionados}
                onChange={handleTurnoChange}
                options={turnos.map((t) => ({ value: t.nomeTurno, label: t.nomeTurno }))}
              />

              {/* ESCALA */}
              <MultiSelect
                label="Escalas"
                selected={escalasSelecionadas}
                onChange={handleEscalaChange}
                options={escalas.map((e) => ({ value: e.nomeEscala, label: e.nomeEscala }))}
              />

              {/* SETOR */}
              <MultiSelect
                label="Setores"
                selected={setoresSelecionados}
                onChange={handleSetorChange}
                options={setores.map((s) => ({ value: s.idSetor, label: s.nomeSetor }))}
              />

              {/* CARGO */}
              <MultiSelect
                label="Cargos"
                selected={cargosSelecionados}
                onChange={handleCargoChange}
                options={cargos.map((c) => ({ value: c.idCargo, label: c.nomeCargo }))}
              />

              {/* STATUS */}
              <MultiSelect
                label="Status"
                selected={statusSelecionados}
                onChange={handleStatusChange}
                options={STATUS_OPTIONS}
              />
            </div>

            {/* LINHA 2: líder + ações */}
            <div className="flex flex-wrap items-center gap-3">
              {/* LÍDER */}
              <MultiSelect
                label="Líderes"
                selected={lideresSelecionados}
                onChange={handleLiderChange}
                options={lideres.map((l) => ({ value: l.opsId, label: l.nomeCompleto }))}
                className="flex-1 min-w-[180px] max-w-xs"
              />


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

                {/* EXPORT AUTOMÁTICO PARA SHEETS — apenas ADMIN */}
                {permissions.isAdmin && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-surface border border-default rounded-xl text-xs text-muted">
                    <Sheet size={15} className="text-[#0F9D58] shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span>
                        Última exportação:{" "}
                        {exportSheetsStatus?.ultimaExecucao
                          ? new Date(exportSheetsStatus.ultimaExecucao).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--"}
                      </span>
                      <span>Próxima em {formatarContadorHoras(segundosParaProximoExport)}</span>
                    </div>
                    <button
                      onClick={handleExportarSheetsAgora}
                      disabled={exportandoSheets}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-default hover:border-[#0F9D58]/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-page transition"
                    >
                      {exportandoSheets ? "Exportando…" : "Exportar agora"}
                    </button>
                  </div>
                )}

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