import { useEffect, useState, useContext } from "react";
import { Search, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { SugestoesAPI } from "../../services/medidasDisciplinares";
import { ColaboradoresAPI } from "../../services/colaboradores";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

const STATUS_LABEL = {
  PENDENTE:  { label: "Pendente",  color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  APROVADA:  { label: "Aprovada",  color: "text-green-400 bg-green-400/10",  icon: CheckCircle },
  REJEITADA: { label: "Rejeitada", color: "text-red-400 bg-red-400/10",      icon: XCircle },
};

const CONSEQUENCIA_LABEL = {
  ADVERTENCIA_ESCRITA: "Advertência Escrita",
  SUSPENSAO: "Suspensão",
  DEMISSAO: "Demissão",
};

function StatusBadge({ status }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, color: "text-gray-400 bg-gray-400/10", icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function CounterCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] flex items-center gap-3 px-5 py-4 rounded-xl border transition-all cursor-pointer
        ${active ? "border-[#FA4C00] bg-[#FA4C00]/10" : "border-default bg-surface hover:border-[#3A3A3C]"}`}
    >
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={16} />
      </div>
      <div className="text-left">
        <p className="text-2xl font-semibold">{value ?? "—"}</p>
        <p className="text-xs text-[#6B7280]">{label}</p>
      </div>
    </button>
  );
}

export default function SugestoesMedidaDisciplinar() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isLideranca = user?.role === "LIDERANCA";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contadores, setContadores] = useState({ PENDENTE: 0, APROVADA: 0, REJEITADA: 0 });
  const [acao, setAcao] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [backfillando, setBackfillando] = useState(false);

  async function executarBackfill() {
    setBackfillando(true);
    const toastId = toast.loading("Varrendo faltas dos últimos 31 dias...");
    try {
      const res = await SugestoesAPI.backfill();
      const { sugestoesDisparadas, sugestoesInvalidadas } = res.data?.data ?? {};
      const partes = [];
      if (sugestoesDisparadas > 0) partes.push(`${sugestoesDisparadas} nova(s) sugestão(ões) gerada(s)`);
      if (sugestoesInvalidadas > 0) partes.push(`${sugestoesInvalidadas} sugestão(ões) invalidada(s) por falta alterada`);

      if (partes.length > 0) {
        toast.success(partes.join(" · "), { id: toastId, duration: 5000 });
      } else {
        toast.success("Painel atualizado — nenhuma sugestão nova encontrada.", { id: toastId, duration: 4000 });
      }
      load();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao executar varredura.", { id: toastId });
    } finally {
      setBackfillando(false);
    }
  }

  // listas para selects
  const [turnos, setTurnos] = useState([]);
  const [lideres, setLideres] = useState([]);

  // filtros
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  // liderança vê só os seus; admin/gestão pode filtrar livremente
  const [filtroLider, setFiltroLider] = useState(isLideranca ? (user?.opsId ?? "") : "");

  // carrega turnos e líderes uma vez
  useEffect(() => {
    api.get("/turnos").then((r) => setTurnos(r.data?.data || [])).catch(() => {});
    ColaboradoresAPI.listarLideres().then(setLideres).catch(() => {});
  }, []);

  async function load(overrides = {}) {
    setLoading(true);
    try {
      const params = {};
      const status = overrides.status !== undefined ? overrides.status : filtroStatus;
      if (status)           params.status    = status;
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim)    params.dataFim    = filtroDataFim;
      if (filtroTurno)      params.turno      = filtroTurno;
      if (filtroLider)      params.lider      = filtroLider;

      const contadorParams = {};
      if (filtroDataInicio) contadorParams.dataInicio = filtroDataInicio;
      if (filtroDataFim)    contadorParams.dataFim    = filtroDataFim;
      if (filtroTurno)      contadorParams.turno      = filtroTurno;
      if (filtroLider)      contadorParams.lider      = filtroLider;

      const [data, ctrs] = await Promise.all([
        SugestoesAPI.listar(params),
        SugestoesAPI.contadores(contadorParams),
      ]);
      setSugestoes(data);
      setContadores(ctrs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const sugestoesFiltradas = sugestoes.filter((s) => {
    if (!filtroNome) return true;
    return (
      s.colaborador?.nomeCompleto?.toLowerCase().includes(filtroNome.toLowerCase()) ||
      s.colaborador?.opsId?.toLowerCase().includes(filtroNome.toLowerCase())
    );
  });

  function limparFiltros() {
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroStatus("");
    setFiltroTurno("");
    setFiltroNome("");
    // liderança não pode limpar o filtro de líder (sempre vê só os seus)
    if (!isLideranca) setFiltroLider("");
  }

  function handleCounterClick(status) {
    const novoStatus = filtroStatus === status ? "" : status;
    setFiltroStatus(novoStatus);
    load({ status: novoStatus });
  }

  async function confirmarAcao() {
    if (!acao) return;
    setSalvando(true);
    try {
      if (acao.tipo === "aprovar") {
        await SugestoesAPI.aprovar(acao.id, {});
      } else {
        await SugestoesAPI.rejeitar(acao.id, { motivo: motivoRejeicao });
      }
      setAcao(null);
      setMotivoRejeicao("");
      await load();
    } catch (err) {
      console.error(err);
      alert("Erro ao processar ação");
    } finally {
      setSalvando(false);
    }
  }

  const temFiltroAtivo = filtroDataInicio || filtroDataFim || filtroStatus || filtroTurno || filtroLider || filtroNome;

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-6xl mx-auto space-y-6">

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Sugestões de Medida Disciplinar</h1>
              <p className="text-sm text-muted">Faltas injustificadas detectadas automaticamente</p>
            </div>
            {!isLideranca && (
              <button
                onClick={executarBackfill}
                disabled={backfillando}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-default hover:border-[#FA4C00] text-sm text-muted hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={14} className={backfillando ? "animate-spin" : ""} />
                {backfillando ? "Varrendo..." : "Varrer faltas"}
              </button>
            )}
          </div>

          {/* CONTADORES */}
          <div className="flex flex-wrap gap-3">
            <CounterCard
              label="Pendentes"
              value={contadores.PENDENTE}
              color="text-yellow-400 bg-yellow-400/10"
              icon={Clock}
              active={filtroStatus === "PENDENTE"}
              onClick={() => handleCounterClick("PENDENTE")}
            />
            <CounterCard
              label="Aprovadas"
              value={contadores.APROVADA}
              color="text-green-400 bg-green-400/10"
              icon={CheckCircle}
              active={filtroStatus === "APROVADA"}
              onClick={() => handleCounterClick("APROVADA")}
            />
            <CounterCard
              label="Rejeitadas"
              value={contadores.REJEITADA}
              color="text-red-400 bg-red-400/10"
              icon={XCircle}
              active={filtroStatus === "REJEITADA"}
              onClick={() => handleCounterClick("REJEITADA")}
            />
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-surface px-4 py-2 rounded-xl flex items-center gap-2">
              <Search size={14} className="text-[#6B7280]" />
              <input
                type="text"
                placeholder="Buscar colaborador ou OpsId"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="bg-transparent outline-none text-sm text-white placeholder-[#6B7280] w-48"
              />
            </div>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-surface px-4 py-2 rounded-xl text-sm text-white outline-none cursor-pointer"
            >
              <option value="">Todos os status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADA">Aprovada</option>
              <option value="REJEITADA">Rejeitada</option>
            </select>

            <select
              value={filtroTurno}
              onChange={(e) => setFiltroTurno(e.target.value)}
              className="bg-surface px-4 py-2 rounded-xl text-sm text-white outline-none cursor-pointer"
            >
              <option value="">Todos os turnos</option>
              {turnos.map((t) => (
                <option key={t.idTurno} value={t.idTurno}>{t.nomeTurno}</option>
              ))}
            </select>

            {/* select de líder só aparece para admin/gestão */}
            {!isLideranca && (
            <select
              value={filtroLider}
              onChange={(e) => setFiltroLider(e.target.value)}
              className="bg-surface px-4 py-2 rounded-xl text-sm text-white outline-none cursor-pointer max-w-[200px]"
            >
              <option value="">Todos os líderes</option>
              {lideres.map((l) => (
                <option key={l.opsId} value={l.opsId}>{l.nomeCompleto}</option>
              ))}
            </select>
            )}

            <div className="bg-surface px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">De</span>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="bg-transparent outline-none text-sm text-white"
              />
            </div>

            <div className="bg-surface px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">Até</span>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="bg-transparent outline-none text-sm text-white"
              />
            </div>

            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-[#FA4C00] hover:bg-[#ff5a1a] text-sm font-medium cursor-pointer"
            >
              Filtrar
            </button>

            {temFiltroAtivo && (
              <button
                onClick={() => { limparFiltros(); setTimeout(load, 0); }}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-2 text-sm text-muted cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* CONTAGEM RESULTADO */}
          {!loading && (
            <p className="text-sm text-muted">
              {sugestoesFiltradas.length} sugestão(ões) encontrada(s)
            </p>
          )}

          {/* TABELA */}
          {loading ? (
            <div className="text-muted">Carregando…</div>
          ) : sugestoesFiltradas.length === 0 ? (
            <div className="text-muted">Nenhuma sugestão encontrada.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-default">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Colaborador</th>
                    <th className="text-left px-4 py-3 font-medium">OpsId</th>
                    <th className="text-left px-4 py-3 font-medium">Data Ref.</th>
                    <th className="text-left px-4 py-3 font-medium">Violação</th>
                    <th className="text-left px-4 py-3 font-medium">Consequência</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {sugestoesFiltradas.map((s) => (
                    <tr key={s.idSugestao} className="bg-page hover:bg-surface transition-colors">
                      <td className="px-4 py-3 font-medium">{s.colaborador?.nomeCompleto ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{s.colaborador?.opsId ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        {s.dataReferencia ? new Date(s.dataReferencia).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">Falta Injustificada</td>
                      <td className="px-4 py-3 text-muted">
                        {CONSEQUENCIA_LABEL[s.consequencia] ?? s.consequencia}
                        {s.diasSuspensao ? ` (${s.diasSuspensao}d)` : ""}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        {s.status === "PENDENTE" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAcao({ id: s.idSugestao, tipo: "aprovar" })}
                              className="px-3 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium cursor-pointer"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => setAcao({ id: s.idSugestao, tipo: "rejeitar" })}
                              className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium cursor-pointer"
                            >
                              Rejeitar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#6B7280]">
                            {user?.role === "ADMIN" ? (s.aprovadoPorEmail ?? "—") : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* MODAL CONFIRMAÇÃO */}
      {acao && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-4 border border-default">
            <h2 className="text-lg font-semibold">
              {acao.tipo === "aprovar" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
            </h2>
            <p className="text-sm text-muted">
              {acao.tipo === "aprovar"
                ? "Ao aprovar, uma Medida Disciplinar será gerada automaticamente para este colaborador."
                : "Informe o motivo da rejeição desta sugestão."}
            </p>
            {acao.tipo === "rejeitar" && (
              <textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                rows={3}
                className="w-full bg-page border border-default rounded-xl px-4 py-2 text-sm text-white placeholder-[#6B7280] outline-none resize-none"
              />
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setAcao(null); setMotivoRejeicao(""); }}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-[#3A3A3C] text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAcao}
                disabled={salvando}
                className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                  acao.tipo === "aprovar"
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {salvando ? "Salvando…" : acao.tipo === "aprovar" ? "Aprovar" : "Rejeitar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
