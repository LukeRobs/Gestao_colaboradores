import { useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Pencil, Printer,
  Users, CalendarDays, Clock, Timer, Building2, User, CheckCircle2,
  XCircle, AlertTriangle,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { Drawer } from "../../components/UIComponents/Drawer";
import { StatusSolicitacaoBadge } from "./solicitacoes/index";
import { SolicitacoesTreinamentoAPI } from "../../services/solicitacoesTreinamento";
import { AuthContext } from "../../context/AuthContext";
import { printAtaTreinamento } from "../../utils/printAtaTreinamento";
import "./calendario.css";

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

const STATUS_COLOR = {
  PENDENTE: "#FF9F0A",
  APROVADA: "#34C759",
  NEGADA: "#FF453A",
};

const STATUS_LABEL = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovado",
  NEGADA: "Negado",
};

const VIEW_OPTIONS = [
  { key: "month", label: "Mensal" },
  { key: "week", label: "Semanal" },
  { key: "agenda", label: "Agenda" },
];

const MESSAGES = {
  allDay: "Dia inteiro",
  previous: "Anterior",
  next: "Próximo",
  today: "Hoje",
  month: "Mensal",
  week: "Semanal",
  day: "Diário",
  agenda: "Agenda",
  date: "Data",
  time: "Hora",
  event: "Treinamento",
  noEventsInRange: "Nenhum treinamento neste período.",
  showMore: (total) => `+${total} mais`,
};

function toEventDate(dataTreinamento, horario) {
  const dateOnly = dataTreinamento.slice(0, 10);
  const [h = "00", m = "00"] = (horario || "00:00").split(":");
  return new Date(`${dateOnly}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
}

/* ─── TOOLBAR CUSTOMIZADA ───────────────────────────── */
function CalendarToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 bg-surface-2 rounded-xl p-1">
          <button
            onClick={() => onNavigate("PREV")}
            aria-label="Período anterior"
            className="p-2 rounded-lg text-muted hover:text-page hover:bg-surface-3 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onNavigate("TODAY")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-page hover:bg-surface-3 active:scale-95 transition-all cursor-pointer"
          >
            Hoje
          </button>
          <button
            onClick={() => onNavigate("NEXT")}
            aria-label="Próximo período"
            className="p-2 rounded-lg text-muted hover:text-page hover:bg-surface-3 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <h2 className="text-lg font-semibold capitalize">{label}</h2>
      </div>

      <div className="flex items-center gap-0.5 bg-surface-2 rounded-xl p-1 self-start sm:self-auto">
        {VIEW_OPTIONS.map((v) => (
          <button
            key={v.key}
            onClick={() => onView(v.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              view === v.key
                ? "bg-[#FA4C00] text-white shadow-sm shadow-[#FA4C00]/30"
                : "text-muted hover:text-page hover:bg-surface-3"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── CHIP DE EVENTO (Mensal/Semanal) ───────────────── */
function EventChip({ event }) {
  const cor = STATUS_COLOR[event.resource.status] || STATUS_COLOR.PENDENTE;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cor }} />
      <span className="truncate">{event.title}</span>
    </div>
  );
}

/* ─── LINHA DE EVENTO (Agenda) ──────────────────────── */
function AgendaEventRow({ event }) {
  const cor = STATUS_COLOR[event.resource.status] || STATUS_COLOR.PENDENTE;
  const s = event.resource;
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
      <div className="min-w-0">
        <p className="font-semibold truncate" style={{ color: cor }}>{event.title}</p>
        <p className="text-xs text-muted truncate">
          {s.processo}{s.setor?.nomeSetor ? ` • ${s.setor.nomeSetor}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ─── TILE DE INFORMAÇÃO (Drawer) ───────────────────── */
function InfoTile({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 bg-surface-2 rounded-xl p-3">
      <div className="p-1.5 rounded-lg bg-[#FA4C00]/10 text-[#FA4C00] shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-page truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────── */
function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-default flex items-center justify-between">
      <div>
        <p className="text-xs text-muted mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      </div>
      <div className="p-2.5 rounded-xl" style={{ background: `${color}1A` }}>
        {icon}
      </div>
    </div>
  );
}

export default function CalendarioTreinamentos() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const carregarEventos = useCallback(async (start, end) => {
    setLoading(true);
    try {
      const inicio = format(start, "yyyy-MM-dd");
      const fim = format(end, "yyyy-MM-dd");
      const solicitacoes = await SolicitacoesTreinamentoAPI.calendario(inicio, fim);
      setEvents(
        (solicitacoes || []).map((s) => ({
          id: s.idSolicitacao,
          title: s.tema,
          start: toEventDate(s.dataTreinamento, s.horarioInicio),
          end: toEventDate(s.dataTreinamento, s.horarioFim),
          resource: s,
        }))
      );
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login"); }
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  const handleRangeChange = useCallback((range) => {
    let start, end;
    if (Array.isArray(range)) {
      start = range[0];
      end = range[range.length - 1];
    } else {
      start = range.start;
      end = range.end;
    }
    carregarEventos(start, end);
  }, [carregarEventos]);

  // carga inicial (mês corrente)
  useMemo(() => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    carregarEventos(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirEvento = async (event) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const detalhe = await SolicitacoesTreinamentoAPI.obter(event.id);
      setSelecionada(detalhe);
    } catch {
      setSelecionada(event.resource);
    } finally {
      setDetailLoading(false);
    }
  };

  const eventPropGetter = useCallback((event) => {
    const cor = STATUS_COLOR[event.resource.status] || STATUS_COLOR.PENDENTE;
    return {
      style: {
        backgroundColor: `${cor}1A`,
        color: cor,
        borderLeft: `3px solid ${cor}`,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 6px",
      },
    };
  }, []);

  const counts = useMemo(() => {
    return events.reduce(
      (acc, e) => {
        const st = e.resource.status;
        acc[st] = (acc[st] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, PENDENTE: 0, APROVADA: 0, NEGADA: 0 }
    );
  }, [events]);

  const imprimirLista = () => {
    if (!selecionada) return;
    printAtaTreinamento({
      dataTreinamento: selecionada.dataTreinamento,
      soc: selecionada.setor?.nomeSetor || "-",
      processo: selecionada.processo,
      tema: selecionada.tema,
      liderResponsavel: selecionada.solicitante,
      local: null,
      horarioInicio: selecionada.horarioInicio,
      horarioFim: selecionada.horarioFim,
      tempoPrevistoMinutos: selecionada.tempoPrevistoMinutos,
      observacoes: selecionada.observacoes,
      setores: selecionada.setor ? [{ setor: selecionada.setor }] : [],
      participantes: selecionada.participantes || [],
    });
  };

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 md:p-8 space-y-6">
          {/* ── HEADER ── */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/treinamentos/solicitacoes")} className="p-2.5 rounded-xl bg-surface-2 text-muted hover:text-page transition-all cursor-pointer">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">Calendário de Treinamentos</h1>
              <p className="text-sm text-muted mt-0.5">Visualize as solicitações de treinamento por data</p>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<CalendarDays size={22} className="text-[#FA4C00]" />} label="Total no período" value={counts.total} color="#FA4C00" />
            <StatCard icon={<Clock size={22} style={{ color: STATUS_COLOR.PENDENTE }} />} label="Pendentes" value={counts.PENDENTE} color={STATUS_COLOR.PENDENTE} />
            <StatCard icon={<CheckCircle2 size={22} style={{ color: STATUS_COLOR.APROVADA }} />} label="Aprovados" value={counts.APROVADA} color={STATUS_COLOR.APROVADA} />
            <StatCard icon={<XCircle size={22} style={{ color: STATUS_COLOR.NEGADA }} />} label="Negados" value={counts.NEGADA} color={STATUS_COLOR.NEGADA} />
          </div>

          {/* ── LEGENDA ── */}
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(STATUS_LABEL).map(([status, label]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: `${STATUS_COLOR[status]}14`,
                  borderColor: `${STATUS_COLOR[status]}33`,
                  color: STATUS_COLOR[status],
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
                {label}
              </span>
            ))}
          </div>

          {/* ── CALENDÁRIO ── */}
          <div className="bg-surface rounded-3xl border border-default p-4 sm:p-5 relative shadow-sm">
            {loading && (
              <div className="absolute top-5 right-5 flex items-center gap-1.5 text-xs text-muted bg-surface-2 px-2.5 py-1 rounded-full z-10">
                <div className="w-3 h-3 rounded-full border-2 border-[#FA4C00] border-t-transparent animate-spin" />
                Atualizando
              </div>
            )}
            <div className="rbc-dark-theme" style={{ height: 700 }}>
              <BigCalendar
                localizer={localizer}
                culture="pt-BR"
                messages={MESSAGES}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onRangeChange={handleRangeChange}
                views={["month", "week", "agenda"]}
                eventPropGetter={eventPropGetter}
                onSelectEvent={abrirEvento}
                components={{
                  toolbar: CalendarToolbar,
                  event: EventChip,
                  agenda: { event: AgendaEventRow },
                }}
                popup
              />
            </div>
          </div>
        </main>
      </MainLayout>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selecionada?.tema || "Solicitação"}
        icon={<Users size={18} className="text-[#FA4C00]" />}
        footer={selecionada && !detailLoading ? (
          <>
            {selecionada.treinamentoCriado && (
              <button
                onClick={() => navigate(`/treinamentos/${selecionada.treinamentoCriado.idTreinamento}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm font-medium transition-colors cursor-pointer"
              >
                <ExternalLink size={15} /> Visualizar Treinamento
              </button>
            )}
            {selecionada.status === "PENDENTE" && (
              <button
                onClick={() => navigate(`/treinamentos/solicitacoes/${selecionada.idSolicitacao}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm font-medium transition-colors cursor-pointer"
              >
                <Pencil size={15} /> Editar
              </button>
            )}
            <button
              onClick={imprimirLista}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FA4C00]/10 hover:bg-[#FA4C00]/20 text-[#FA4C00] text-sm font-medium transition-colors cursor-pointer"
            >
              <Printer size={15} /> Imprimir Lista de Presença
            </button>
          </>
        ) : null}
      >
        {detailLoading || !selecionada ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-6 w-24 bg-surface-2 rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface-2 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <StatusSolicitacaoBadge status={selecionada.status} />

            {selecionada.status === "NEGADA" && selecionada.motivoNegativa && (
              <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#FF453A]">Motivo da negativa</p>
                  <p className="text-xs text-muted mt-0.5">{selecionada.motivoNegativa}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <InfoTile icon={<Building2 size={15} />} label="Processo" value={selecionada.processo} />
              <InfoTile icon={<CalendarDays size={15} />} label="Data" value={selecionada.dataTreinamento?.slice(0, 10).split("-").reverse().join("/")} />
              <InfoTile icon={<Clock size={15} />} label="Horário" value={`${selecionada.horarioInicio} - ${selecionada.horarioFim}`} />
              <InfoTile icon={<Timer size={15} />} label="Tempo" value={selecionada.tempoPrevistoMinutos ? `${selecionada.tempoPrevistoMinutos} min` : null} />
              <InfoTile icon={<User size={15} />} label="Solicitante" value={selecionada.solicitante?.name} />
              <InfoTile icon={<Building2 size={15} />} label="Setor" value={selecionada.setor?.nomeSetor} />
              <InfoTile icon={<Users size={15} />} label="Turno" value={selecionada.turno?.nomeTurno} />
              <InfoTile icon={<Users size={15} />} label="Participantes" value={selecionada.participantes?.length ?? 0} />
            </div>

            {selecionada.observacoes && (
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-page">{selecionada.observacoes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
