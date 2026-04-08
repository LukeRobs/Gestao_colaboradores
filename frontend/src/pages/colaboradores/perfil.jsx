import { AuthContext } from "../../context/AuthContext";
import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Shuffle,
  Trash2,
  FileText,
  Phone,
  Mail,
  IdCard,
  Building2,
  MapPin,
  Users,
  Briefcase,
  Clock,
  Calendar,
  ShieldAlert,
  HeartPulse,
  BookOpen,
  AlertTriangle,
  UserCheck,
  ChevronRight,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";
import api from "../../services/api";

/* ─── helpers ─── */
function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

function fmt(date, opts = {}) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC", ...opts });
}

function fmtTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

const STATUS_CONFIG = {
  ATIVO:     { label: "Ativo",     bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  INATIVO:   { label: "Inativo",   bg: "bg-red-500/15",     text: "text-red-400",     dot: "bg-red-400"     },
  FERIAS:    { label: "Férias",    bg: "bg-blue-500/15",    text: "text-blue-400",    dot: "bg-blue-400"    },
  AFASTADO:  { label: "Afastado",  bg: "bg-amber-500/15",   text: "text-amber-400",   dot: "bg-amber-400"   },
};

/* ─── main component ─── */
export default function PerfilColaborador() {
  const { opsId } = useParams();
  const navigate = useNavigate();
  const { permissions } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [colaborador, setColaborador] = useState(null);
  const [medidas, setMedidas] = useState([]);
  const [acidentes, setAcidentes] = useState([]);
  const [vinculoOrganizacional, setVinculoOrganizacional] = useState({});
  const [indicadores, setIndicadores] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [colabRes, mdRes, acRes] = await Promise.all([
          api.get(`/colaboradores/${opsId}`),
          api.get(`/medidas-disciplinares?opsId=${opsId}`),
          api.get(`/acidentes/colaborador/${opsId}`),
        ]);
        const payload = colabRes.data.data;
        setColaborador(payload.colaborador);
        setMedidas(mdRes.data.data || []);
        setAcidentes(acRes.data.data || []);
        setVinculoOrganizacional(payload.vinculoOrganizacional || {});
        setIndicadores(payload.indicadores || null);
      } catch (err) {
        console.error("Erro perfil colaborador:", err);
        navigate("/colaboradores");
      } finally {
        setLoading(false);
      }
    }
    if (opsId) load();
  }, [opsId, navigate]);

  async function handleDelete() {
    if (!window.confirm("Tem certeza que deseja excluir este colaborador?")) return;
    await api.delete(`/colaboradores/${opsId}`);
    navigate("/colaboradores");
  }

  if (loading) return <LoadingScreen message="Carregando perfil do colaborador..." />;
  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-muted">
        Colaborador não encontrado
      </div>
    );
  }

  const vinculo = vinculoOrganizacional;
  const atestad = indicadores?.atestados  || { total: 0, ativos: 0, finalizados: 0, itens: [] };
  const faltas   = indicadores?.faltas     || { total: 0, itens: [] };
  const treinos  = indicadores?.treinamentos || { total: 0, itens: [] };
  const statusCfg = STATUS_CONFIG[colaborador.status] || STATUS_CONFIG.INATIVO;

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-16">

          {/* ── HERO CARD ── */}
          <div className="relative overflow-hidden rounded-2xl border border-default bg-surface">
            {/* gradient accent top */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FA4C00] via-orange-400 to-transparent" />

            <div className="p-6 md:p-8">
              {/* back + actions row */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigate("/colaboradores")}
                  className="flex items-center gap-2 text-sm text-muted hover:text-page transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  Colaboradores
                </button>

                {(permissions.isAdmin || permissions.isAltaGestao) && (
                  <div className="flex items-center gap-2">
                    <ActionBtn
                      icon={<Pencil size={14} />}
                      label="Editar"
                      onClick={() => navigate(`/colaboradores/${opsId}/editar`)}
                    />
                    <ActionBtn
                      icon={<Shuffle size={14} />}
                      label="Movimentar"
                      onClick={() => navigate(`/colaboradores/${opsId}/movimentar`)}
                    />
                    {permissions.isAdmin && (
                      <ActionBtn
                        icon={<Trash2 size={14} />}
                        label="Excluir"
                        danger
                        onClick={handleDelete}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* identity block */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* avatar */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FA4C00] to-orange-700 flex items-center justify-center shadow-lg shadow-orange-900/30">
                    <span className="text-white text-2xl font-bold tracking-wide">
                      {getInitials(colaborador.nomeCompleto)}
                    </span>
                  </div>
                </div>

                {/* name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-xl md:text-2xl font-semibold truncate">
                      {colaborador.nomeCompleto}
                    </h1>
                    {/* status pill */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="flex items-center gap-1.5">
                      <IdCard size={13} />
                      {colaborador.opsId}
                    </span>
                    {vinculo.cargo && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase size={13} />
                        {vinculo.cargo}
                      </span>
                    )}
                    {vinculo.estacao && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} />
                        {vinculo.estacao}
                      </span>
                    )}
                    {vinculo.turno && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {vinculo.turno}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── GRID: DADOS PESSOAIS + EMERGÊNCIA ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProfileSection title="Dados Pessoais" icon={<UserCheck size={15} />}>
              <InfoRow icon={<IdCard size={14} />}    label="CPF"       value={colaborador.cpf} />
              <InfoRow icon={<Mail size={14} />}       label="E-mail"    value={colaborador.email} />
              <InfoRow icon={<Phone size={14} />}      label="Telefone"  value={colaborador.telefone} />
              <InfoRow icon={<Users size={14} />}      label="Gênero"    value={colaborador.genero} />
              <InfoRow icon={<IdCard size={14} />}     label="Matrícula" value={colaborador.matricula} />
            </ProfileSection>

            <ProfileSection title="Contato de Emergência" icon={<Phone size={15} />}>
              <InfoRow icon={<Users size={14} />} label="Nome"     value={colaborador.contatoEmergenciaNome} />
              <InfoRow icon={<Phone size={14} />} label="Telefone" value={colaborador.contatoEmergenciaTelefone} />
            </ProfileSection>
          </div>

          {/* ── VÍNCULO ORGANIZACIONAL ── */}
          <ProfileSection title="Vínculo Organizacional" icon={<Building2 size={15} />}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <OrgInfo label="Empresa"  value={vinculo.empresa  || colaborador.empresa?.razaoSocial} />
              <OrgInfo label="Regional" value={vinculo.regional} />
              <OrgInfo label="Estação"  value={vinculo.estacao} />
              <OrgInfo label="Setor"    value={vinculo.setor    || colaborador.setor?.nomeSetor} />
              <OrgInfo label="Cargo"    value={vinculo.cargo    || colaborador.cargo?.nomeCargo} />
              <OrgInfo label="Turno"    value={vinculo.turno    || colaborador.turno?.nomeTurno} />
              <OrgInfo label="Líder"    value={vinculo.lider} span />
            </div>
          </ProfileSection>

          {/* ── JORNADA ── */}
          <ProfileSection title="Jornada" icon={<Calendar size={15} />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <OrgInfo label="Escala"         value={vinculo.escala || colaborador.escala?.nomeEscala} />
              <OrgInfo label="Data de Admissão" value={fmt(colaborador.dataAdmissao)} />
              <OrgInfo label="Início da Jornada" value={fmtTime(colaborador.horarioInicioJornada)} />
              {colaborador.status === "INATIVO" && (
                <OrgInfo label="Data de Demissão" value={fmt(colaborador.dataDesligamento)} highlight="text-red-400" />
              )}
            </div>
          </ProfileSection>

          {/* ── INDICADORES DE SAÚDE ── */}
          <ProfileSection title="Indicadores de Saúde" icon={<HeartPulse size={15} />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Atestados" value={atestad.total}       color="text-page"         bg="bg-surface-2"      icon={<FileText size={16} className="text-muted" />} />
              <StatCard label="Em Andamento"    value={atestad.ativos}      color="text-amber-400"    bg="bg-amber-500/8"    icon={<Clock size={16} className="text-amber-400" />} />
              <StatCard label="Finalizados"     value={atestad.finalizados} color="text-emerald-400"  bg="bg-emerald-500/8"  icon={<UserCheck size={16} className="text-emerald-400" />} />
              <StatCard label="Faltas"          value={faltas.total}        color="text-red-400"      bg="bg-red-500/8"      icon={<AlertTriangle size={16} className="text-red-400" />} />
            </div>
          </ProfileSection>

          {/* ── HISTÓRICO DE SAÚDE ── */}
          <div className="bg-surface border border-default rounded-2xl overflow-hidden">
            {/* section header */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-default">
              <span className="text-muted"><FileText size={15} /></span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Histórico de Saúde</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-default">

              {/* ── ATESTADOS ── */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <FileText size={13} className="text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold">Atestados</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    {atestad.itens.length} registro(s)
                  </span>
                </div>

                {atestad.itens.length > 0 ? (
                  <div className="relative">
                    {/* timeline line */}
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-default" />

                    <div className="space-y-4">
                      {atestad.itens.map((at) => {
                        const isAtivo      = at.status === "ATIVO";
                        const isFinalizado = at.status === "FINALIZADO";
                        const dotColor  = isAtivo ? "bg-amber-400" : isFinalizado ? "bg-emerald-400" : "bg-red-400";
                        const badgeColor = isAtivo
                          ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                          : isFinalizado
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                          : "bg-red-500/10 border-red-500/25 text-red-400";
                        return (
                          <div key={at.idAtestado} className="flex gap-4 pl-1">
                            {/* dot */}
                            <div className="relative z-10 mt-3 shrink-0">
                              <div className={`w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center ${dotColor}`}>
                                <div className="w-2 h-2 rounded-full bg-surface" />
                              </div>
                            </div>

                            {/* card */}
                            <div className="flex-1 bg-page border border-default rounded-xl p-4 hover:border-blue-500/30 transition-colors">
                              {/* top row */}
                              <div className="flex items-center justify-between mb-3">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                                  {at.status}
                                </span>
                                <span className="text-xs font-medium text-muted bg-surface-2 px-2 py-0.5 rounded-lg">
                                  {at.diasAfastamento} dia(s)
                                </span>
                              </div>

                              {/* dates row */}
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1 bg-surface-2 rounded-lg px-3 py-2">
                                  <p className="text-xs text-muted mb-0.5">Início</p>
                                  <p className="text-sm font-semibold">{fmt(at.dataInicio)}</p>
                                </div>
                                <ChevronRight size={14} className="text-muted shrink-0" />
                                <div className="flex-1 bg-surface-2 rounded-lg px-3 py-2">
                                  <p className="text-xs text-muted mb-0.5">Fim</p>
                                  <p className="text-sm font-semibold">{fmt(at.dataFim)}</p>
                                </div>
                              </div>

                              {/* CID + obs */}
                              {(at.cid || at.observacao) && (
                                <div className="pt-3 border-t border-default space-y-1.5">
                                  {at.cid && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted">CID</span>
                                      <span className="text-xs font-semibold bg-surface-2 px-2 py-0.5 rounded">{at.cid}</span>
                                    </div>
                                  )}
                                  {at.observacao && (
                                    <p className="text-xs text-muted leading-relaxed">{at.observacao}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState text="Nenhum atestado registrado." />
                )}
              </div>

              {/* ── FALTAS ── */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                      <AlertTriangle size={13} className="text-red-400" />
                    </div>
                    <span className="text-sm font-semibold">Faltas</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                    {faltas.itens.length} registro(s)
                  </span>
                </div>

                {faltas.itens.length > 0 ? (
                  <div className="space-y-2">
                    {faltas.itens.map((f) => (
                      <div
                        key={f.idFrequencia}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                          f.temMD
                            ? "border-orange-500/30 bg-orange-500/8 hover:bg-orange-500/12"
                            : "border-default bg-page hover:border-red-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${f.temMD ? "bg-orange-400" : "bg-red-400"}`} />
                          <span className="text-sm font-semibold">{fmt(f.data)}</span>
                        </div>
                        {f.temMD ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400">
                            <ShieldAlert size={11} />
                            MD aplicada
                          </span>
                        ) : (
                          <span className="text-xs text-muted bg-surface-2 px-2.5 py-1 rounded-full">
                            Sem MD
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Nenhuma falta registrada." />
                )}
              </div>

            </div>
          </div>

          {/* ── MEDIDAS DISCIPLINARES ── */}
          <ProfileSection title="Medidas Disciplinares" icon={<ShieldAlert size={15} />}>
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-sm font-semibold text-orange-400">{medidas.length}</span>
                <span className="text-xs text-muted ml-1.5">registrada(s)</span>
              </div>
            </div>

            {medidas.length === 0 ? (
              <EmptyState text="Nenhuma medida disciplinar registrada." />
            ) : (
              <div className="space-y-3">
                {medidas.map((md) => (
                  <div key={md.idMedida} className="flex items-start gap-4 bg-page border border-default rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold">{md.tipoMedida}</p>
                        <p className="text-xs text-muted">{new Date(md.dataAplicacao).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className="text-sm text-muted">{md.motivo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ProfileSection>

          {/* ── ACIDENTES ── */}
          <ProfileSection title="Acidentes de Trabalho" icon={<AlertTriangle size={15} />}>
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-sm font-semibold text-red-400">{acidentes.length}</span>
                <span className="text-xs text-muted ml-1.5">registrado(s)</span>
              </div>
            </div>

            {acidentes.length === 0 ? (
              <EmptyState text="Nenhum acidente registrado para este colaborador." />
            ) : (
              <div className="space-y-3">
                {acidentes.map((ac) => (
                  <div key={ac.idAcidente} className="flex items-start gap-4 bg-page border border-default rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                      <AlertTriangle size={14} className="text-red-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{ac.tipoOcorrencia}</p>
                        <p className="text-xs text-muted">{new Date(ac.dataOcorrencia).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className="text-xs text-muted">{ac.localOcorrencia}</p>
                      <p className="text-sm mt-1">{ac.situacaoGeradora}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">{ac.tipoLesao}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">{ac.parteCorpoAtingida}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ProfileSection>

          {/* ── TREINAMENTOS ── */}
          <ProfileSection title="Treinamentos" icon={<BookOpen size={15} />}>
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-sm font-semibold text-blue-400">{treinos.total}</span>
                <span className="text-xs text-muted ml-1.5">realizado(s)</span>
              </div>
            </div>

            {treinos.total === 0 ? (
              <EmptyState text="Nenhum treinamento registrado para este colaborador." />
            ) : (
              <div className="space-y-2">
                {treinos.itens.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-page border border-default rounded-xl p-4 hover:border-blue-500/30 transition-colors cursor-default">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.tema}</p>
                      <p className="text-xs text-muted mt-0.5">{new Date(t.data).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </ProfileSection>

        </main>
      </div>
    </div>
  );
}

/* ─── sub-components ─── */

function ProfileSection({ title, icon, children }) {
  return (
    <div className="bg-surface border border-default rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-default">
        <span className="text-muted">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-default last:border-0">
      <span className="text-muted mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function OrgInfo({ label, value, highlight, span }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight || ""}`}>{value || "—"}</p>
    </div>
  );
}

function StatCard({ label, value, color, bg, icon }) {
  return (
    <div className={`rounded-xl p-4 border border-default ${bg}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value ?? 0}</p>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{children}</p>
  );
}

function EmptyState({ text }) {
  return (
    <p className="text-sm text-muted py-2">{text}</p>
  );
}

function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
        danger
          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
          : "bg-surface-2 hover:bg-surface border border-default"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
