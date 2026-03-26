import { useEffect, useState } from "react";
import { Check, X, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import api from "../../services/api";

export default function SugestoesMedidaDisciplinar() {

  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  /* =======================
     FILTROS
  ======================= */

  const [dataFiltro, setDataFiltro] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [liderFiltro, setLiderFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [lideres, setLideres] = useState([]);
  const [liderOpen, setLiderOpen] = useState(false);
  const [contadores, setContadores] = useState({ PENDENTE: 0, REJEITADA: 0, APROVADA: 0 });

  /* =======================
     LOAD LÍDERES
  ======================= */

  useEffect(() => {
    api.get("/colaboradores/lideres")
      .then((res) => setLideres(res.data?.data || []))
      .catch(() => {});
  }, []);

  /* =======================
     LOAD
  ======================= */

  async function load() {

    setLoading(true);

    try {

      const params = new URLSearchParams();

      if (dataFiltro) params.append("data", dataFiltro);
      if (turnoFiltro) params.append("turno", turnoFiltro);
      if (liderFiltro) params.append("lider", liderFiltro);
      if (statusFiltro) params.append("status", statusFiltro);

      // contadores com os mesmos filtros (exceto status)
      const contadorParams = new URLSearchParams();
      if (dataFiltro) contadorParams.append("data", dataFiltro);
      if (turnoFiltro) contadorParams.append("turno", turnoFiltro);
      if (liderFiltro) contadorParams.append("lider", liderFiltro);

      const [resFiltrado, resContadores] = await Promise.all([
        api.get(`/medidas-disciplinares/sugestoes?${params.toString()}`),
        api.get(`/medidas-disciplinares/sugestoes/contadores?${contadorParams.toString()}`),
      ]);

      setSugestoes(resFiltrado.data.data || []);

      const c = resContadores.data?.data || {};
      setContadores({
        PENDENTE:  c.PENDENTE  ?? 0,
        REJEITADA: c.REJEITADA ?? 0,
        APROVADA:  c.APROVADA  ?? 0,
      });

    } catch (err) {

      console.error(err);
      alert("Erro ao carregar sugestões");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {
    load();
  }, []);

  /* =======================
     APROVAR
  ======================= */

  async function aprovar(sugestao) {

    if (processingId) return;

    if (!window.confirm("Aprovar esta medida disciplinar?")) return;

    try {

      setProcessingId(sugestao.idSugestao);

      const res = await api.post(
        `/medidas-disciplinares/sugestoes/${sugestao.idSugestao}/aprovar`
      );

      const medida = res.data.data;

      alert("Medida disciplinar criada com sucesso");

      navigate(`/medidas-disciplinares/${medida.idMedida}`);

    } catch (err) {

      console.error(err);
      alert("Erro ao aprovar sugestão");

    } finally {

      setProcessingId(null);

    }

  }

  /* =======================
     REJEITAR
  ======================= */

  async function rejeitar(id) {

    if (processingId) return;

    if (!window.confirm("Rejeitar esta sugestão?")) return;

    try {

      setProcessingId(id);

      await api.post(`/medidas-disciplinares/sugestoes/${id}/rejeitar`);

      await load();

      alert("Sugestão rejeitada com sucesso.");

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data?.message || "Erro ao rejeitar sugestão"
      );

    } finally {

      setProcessingId(null);

    }

  }

  const liderSelecionado = lideres.find((l) => l.opsId === liderFiltro);

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>

        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-6">

          <div>
            <h1 className="text-2xl font-semibold">
              Sugestões de Medida Disciplinar
            </h1>

            <p className="text-sm text-[#BFBFC3]">
              Violações detectadas automaticamente pelo sistema
            </p>
          </div>

          {/* =======================
              CONTADORES
          ======================= */}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#BFBFC3] uppercase tracking-wider mb-1">Pendentes</p>
                <p className="text-2xl font-bold text-white">{contadores.PENDENTE}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              </div>
            </div>

            <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#BFBFC3] uppercase tracking-wider mb-1">Rejeitadas</p>
                <p className="text-2xl font-bold text-white">{contadores.REJEITADA}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#EF4444]/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              </div>
            </div>

            <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#BFBFC3] uppercase tracking-wider mb-1">Aprovadas</p>
                <p className="text-2xl font-bold text-white">{contadores.APROVADA}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
              </div>
            </div>
          </div>

          {/* =======================
              FILTROS
          ======================= */}

          <div className="flex flex-wrap items-center gap-3 bg-[#1A1A1C] border border-[#3D3D40] rounded-xl p-4">

            <Filter size={16} className="text-[#BFBFC3]" />

            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="bg-[#0D0D0D] border border-[#3D3D40] rounded-lg px-3 py-2 text-sm"
            />

            <select
              value={turnoFiltro}
              onChange={(e) => setTurnoFiltro(e.target.value)}
              className="bg-[#0D0D0D] border border-[#3D3D40] rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[#FA4C00]/50 active:scale-95 transition-all duration-150"
            >
              <option value="">Todos Turnos</option>
              <option value="1">T1</option>
              <option value="2">T2</option>
              <option value="3">T3</option>
            </select>

            {/* ── DROPDOWN LIDERANÇA ── */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLiderOpen((o) => !o)}
                className={`flex items-center gap-2 bg-[#0D0D0D] border rounded-lg px-3 py-2 text-sm min-w-[180px] justify-between cursor-pointer hover:border-[#FA4C00]/50 active:scale-95 transition-all duration-150 ${liderFiltro ? "border-[#FA4C00]/60 text-white" : "border-[#3D3D40] text-[#BFBFC3]"}`}
              >
                <span className="truncate max-w-[150px]">
                  {liderSelecionado
                    ? liderSelecionado.nomeCompleto.split(" ").slice(0, 2).join(" ")
                    : "Liderança"}
                </span>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>

              {liderOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 bg-[#1A1A1C] border border-[#3D3D40] rounded-xl shadow-2xl"
                  style={{ minWidth: 220, maxHeight: 260, overflowY: "auto", scrollbarWidth: "none" }}
                >
                  <div
                    onClick={() => { setLiderFiltro(""); setLiderOpen(false); }}
                    className={`px-4 py-2.5 text-sm cursor-pointer border-b border-[#3D3D40] ${!liderFiltro ? "text-[#FA4C00] font-semibold" : "text-[#BFBFC3] hover:bg-[#2A2A2C]"}`}
                  >
                    Todos
                  </div>
                  {lideres.map((l) => (
                    <div
                      key={l.opsId}
                      onClick={() => { setLiderFiltro(l.opsId); setLiderOpen(false); }}
                      className={`px-4 py-2.5 text-sm cursor-pointer ${liderFiltro === l.opsId ? "text-[#FA4C00] font-semibold" : "text-[#BFBFC3] hover:bg-[#2A2A2C]"}`}
                    >
                      {l.nomeCompleto}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── STATUS ── */}
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="bg-[#0D0D0D] border border-[#3D3D40] rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[#FA4C00]/50 active:scale-95 transition-all duration-150"
            >
              <option value="">Pendentes + Rejeitadas ({contadores.PENDENTE + contadores.REJEITADA})</option>
              <option value="PENDENTE">Pendentes ({contadores.PENDENTE})</option>
              <option value="REJEITADA">Rejeitadas ({contadores.REJEITADA})</option>
              <option value="APROVADA">Aprovadas ({contadores.APROVADA})</option>
            </select>

            <button
              onClick={load}
              className="px-4 py-2 bg-[#FA4C00] hover:bg-[#e64500] active:bg-[#cc3d00] active:scale-95 rounded-lg text-sm transition-all duration-150 cursor-pointer"
            >
              Filtrar
            </button>

          </div>

          {/* =======================
              LISTA
          ======================= */}

          {loading ? (
            <div className="text-[#BFBFC3]">
              Carregando sugestões...
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="text-[#BFBFC3]">
              Nenhuma sugestão disponível
            </div>
          ) : (
            <div className="space-y-4">

              {sugestoes.map((s) => (

                <SugestaoCard
                  key={s.idSugestao}
                  sugestao={s}
                  onAprovar={() => aprovar(s)}
                  onRejeitar={rejeitar}
                  processing={processingId === s.idSugestao}
                />

              ))}

            </div>
          )}

        </main>

      </MainLayout>

    </div>
  );
}

/* CARD */

function SugestaoCard({ sugestao, onAprovar, onRejeitar, processing }) {

  const colaborador = sugestao.colaborador;
  const data = new Date(sugestao.dataReferencia).toLocaleDateString("pt-BR");
  const status = sugestao.status;

  return (

    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl p-5 flex items-center justify-between gap-4">

      <div className="space-y-1 min-w-0">

        <p className="font-medium">
          {colaborador?.nomeCompleto || "-"}
        </p>

        <p className="text-sm text-[#BFBFC3]">
          {String(sugestao.violacao || "-").replaceAll("_", " ")}
        </p>

        <p className="text-xs text-[#6B7280]">
          Data: {data}
        </p>

        <p className="text-xs text-[#FA4C00]">
          Consequência sugerida: {sugestao.consequencia}
        </p>

        {status === "REJEITADA" && (
          <span className="inline-block mt-1 text-xs px-2 py-1 rounded bg-red-900/40 text-red-300">
            {sugestao.aprovadoPor?.startsWith("SISTEMA")
              ? `⚙️ ${sugestao.aprovadoPor}`
              : "Recusado"}
          </span>
        )}

      </div>

      {status === "PENDENTE" && (

        <div className="flex gap-3 shrink-0">

          <button
            onClick={() => onRejeitar(sugestao.idSugestao)}
            disabled={processing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A2A2C] hover:bg-[#3A3A3C] active:bg-[#4A4A4C] active:scale-95 text-sm disabled:opacity-50 transition-all duration-150 cursor-pointer"
          >
            <X size={16} />
            {processing ? "Processando..." : "Rejeitar"}
          </button>

          <button
            disabled={processing}
            onClick={onAprovar}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FA4C00] hover:bg-[#e64500] active:bg-[#cc3d00] active:scale-95 text-sm disabled:opacity-50 transition-all duration-150 cursor-pointer"
          >
            <Check size={16} />
            {processing ? "Processando..." : "Aprovar"}
          </button>

        </div>

      )}

    </div>

  );

}