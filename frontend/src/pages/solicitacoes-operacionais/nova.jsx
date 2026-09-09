import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import {
  ArrowLeft, CalendarOff, Clock3, Share2, ArrowLeftRight, Send, AlertTriangle,
  Hourglass, UserCog, CalendarClock, UserX, CheckCircle2, Upload,
  Repeat, Palmtree, PauseCircle, Building2,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";
import { SolicitacoesOperacionaisAPI } from "../../services/solicitacoesOperacionais";
import { BuscaColaboradorPorCpf } from "../../components/solicitacoesOperacionais/BuscaColaboradorPorCpf";
import { ImportarFolgaModal } from "../../components/solicitacoesOperacionais/ImportarFolgaModal";
import { ImportarSinergiaModal } from "../../components/solicitacoesOperacionais/ImportarSinergiaModal";
import { ImportarBancoHorasModal } from "../../components/solicitacoesOperacionais/ImportarBancoHorasModal";
import { ImportarInternalizacaoModal } from "../../components/solicitacoesOperacionais/ImportarInternalizacaoModal";
import { TIPO_DESLIGAMENTO_LABEL, MOTIVO_DESLIGAMENTO_LABEL } from "./shared";

const TIPOS = [
  { key: "FOLGA", label: "Folga", desc: "Solicitar folga para um colaborador em uma data específica", icon: CalendarOff },
  { key: "BANCO_HORAS", label: "Banco de Horas", desc: "Dia completo ou horas parciais, com hora de entrada", icon: Clock3 },
  { key: "SINERGIA", label: "Sinergia", desc: "Envio para FULL, tratativas ou outra operação", icon: Share2 },
  { key: "TROCA_DSR", label: "Troca de DSR", desc: "Inversão do DSR entre dois colaboradores", icon: ArrowLeftRight },
  { key: "HORA_EXTRA", label: "Hora Extra", desc: "Trabalho em dia de DSR, com hora de entrada e saída", icon: Hourglass },
  { key: "TROCA_GESTAO", label: "Troca de Gestão", desc: "Alterar o líder responsável pelo colaborador", icon: UserCog },
  { key: "TROCA_ESCALA", label: "Troca de Escala", desc: "Alterar a escala de trabalho do colaborador", icon: CalendarClock },
  { key: "DESLIGAMENTO", label: "Desligamento", desc: "Solicitar o desligamento de um colaborador ativo", icon: UserX },
  { key: "TROCA_TURNO", label: "Troca de Turno", desc: "Alterar o turno de trabalho do colaborador", icon: Repeat },
  { key: "FERIAS", label: "Férias", desc: "Período de férias, com data de início e fim", icon: Palmtree },
  { key: "AFASTAMENTO", label: "Afastamento", desc: "Período de afastamento, com data de início e fim", icon: PauseCircle },
  { key: "INTERNALIZACAO", label: "Internalização", desc: "Colaborador terceirizado passa a ser SPX (empresa e matrícula)", icon: Building2 },
];

const TIPOS_COM_DATA_GENERICA = ["FOLGA", "BANCO_HORAS", "SINERGIA", "HORA_EXTRA"];

// Retorna a duração em minutos entre entrada e saída, considerando turnos
// que atravessam a meia-noite (ex.: T3, entrada 21:00 / saída 05:55).
function duracaoMinutos(horaEntrada, horaSaida) {
  const [hE, mE] = horaEntrada.split(":").map(Number);
  const [hS, mS] = horaSaida.split(":").map(Number);
  let minutos = (hS * 60 + mS) - (hE * 60 + mE);
  if (minutos <= 0) minutos += 24 * 60;
  return minutos;
}

function jornadaHeInvalida(horaEntrada, horaSaida) {
  if (!horaEntrada || !horaSaida) return false;
  const minutos = duracaoMinutos(horaEntrada, horaSaida);
  return minutos <= 0 || minutos > 16 * 60;
}

function fieldCls() {
  return "w-full px-3 py-2.5 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all";
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}

export default function NovaSolicitacaoOperacional() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tipo, setTipo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucessoMsg, setSucessoMsg] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [importarAberto, setImportarAberto] = useState(false);
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* colaborador principal */
  const [colaborador, setColaborador] = useState(null);
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");

  /* banco de horas */
  const [bhDiaCompleto, setBhDiaCompleto] = useState(true);
  const [bhQuantidadeHoras, setBhQuantidadeHoras] = useState("");
  const [bhHoraEntrada, setBhHoraEntrada] = useState("");

  /* sinergia */
  const [sinergiaDestino, setSinergiaDestino] = useState("");

  /* troca de dsr */
  const [colaborador2, setColaborador2] = useState(null);
  const [dsrDataAtual1, setDsrDataAtual1] = useState("");
  const [dsrDataNova1, setDsrDataNova1] = useState("");
  const [dsrDataAtual2, setDsrDataAtual2] = useState("");
  const [dsrDataNova2, setDsrDataNova2] = useState("");

  /* hora extra */
  const [heHoraEntrada, setHeHoraEntrada] = useState("");
  const [heHoraSaida, setHeHoraSaida] = useState("");

  /* troca de gestão */
  const [novoLiderOpsId, setNovoLiderOpsId] = useState("");
  const [lideres, setLideres] = useState([]);
  const [carregandoLideres, setCarregandoLideres] = useState(false);

  /* troca de escala */
  const [novaIdEscala, setNovaIdEscala] = useState("");
  const [escalas, setEscalas] = useState([]);
  const [carregandoEscalas, setCarregandoEscalas] = useState(false);

  /* desligamento */
  const [dataDesligamentoSolicitada, setDataDesligamentoSolicitada] = useState("");
  const [motivoDesligamentoSolicitado, setMotivoDesligamentoSolicitado] = useState("");
  const [tipoDesligamentoSolicitado, setTipoDesligamentoSolicitado] = useState("");

  /* troca de turno */
  const [novoIdTurno, setNovoIdTurno] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [carregandoTurnos, setCarregandoTurnos] = useState(false);

  /* férias / afastamento (campos compartilhados — mutuamente exclusivos por tipo) */
  const [dataInicioAusencia, setDataInicioAusencia] = useState("");
  const [dataFimAusencia, setDataFimAusencia] = useState("");

  /* internalização */
  const [internalizacaoNovaIdEmpresa, setInternalizacaoNovaIdEmpresa] = useState("");
  const [internalizacaoNovaMatricula, setInternalizacaoNovaMatricula] = useState("");
  const [empresasInternalizacao, setEmpresasInternalizacao] = useState([]);
  const [carregandoEmpresasInternalizacao, setCarregandoEmpresasInternalizacao] = useState(false);
  const [elegibilidadeInternalizacao, setElegibilidadeInternalizacao] = useState(null);
  const [verificandoElegibilidade, setVerificandoElegibilidade] = useState(false);
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);

  const resetForm = () => {
    setColaborador(null); setData(""); setMotivo("");
    setBhDiaCompleto(true); setBhQuantidadeHoras(""); setBhHoraEntrada("");
    setSinergiaDestino("");
    setColaborador2(null); setDsrDataAtual1(""); setDsrDataNova1(""); setDsrDataAtual2(""); setDsrDataNova2("");
    setHeHoraEntrada(""); setHeHoraSaida("");
    setNovoLiderOpsId(""); setLideres([]);
    setNovaIdEscala(""); setEscalas([]);
    setDataDesligamentoSolicitada(""); setMotivoDesligamentoSolicitado(""); setTipoDesligamentoSolicitado("");
    setNovoIdTurno(""); setTurnos([]);
    setDataInicioAusencia(""); setDataFimAusencia("");
    setInternalizacaoNovaIdEmpresa(""); setInternalizacaoNovaMatricula(""); setEmpresasInternalizacao([]);
    setElegibilidadeInternalizacao(null); setConfirmarMesmoAssim(false);
    setErro(null);
    setSucessoMsg(null);
  };

  useEffect(() => {
    if (!sucessoMsg) return;
    const t = setTimeout(() => setSucessoMsg(null), 5000);
    return () => clearTimeout(t);
  }, [sucessoMsg]);

  const escolherTipo = (t) => {
    resetForm();
    setTipo(t);
  };

  /* carrega líderes elegíveis quando o colaborador é definido (Troca de Gestão) */
  useEffect(() => {
    if (tipo !== "TROCA_GESTAO" || !colaborador?.opsId) return;
    setCarregandoLideres(true);
    api.get("/colaboradores/lideres")
      .then((res) => setLideres((res.data?.data || res.data || []).filter((l) => l.opsId !== colaborador.opsId)))
      .catch(() => setLideres([]))
      .finally(() => setCarregandoLideres(false));
  }, [tipo, colaborador?.opsId]);

  /* carrega escalas ativas da estação quando o colaborador é definido (Troca de Escala) */
  useEffect(() => {
    if (tipo !== "TROCA_ESCALA" || !colaborador?.opsId) return;
    setCarregandoEscalas(true);
    SolicitacoesOperacionaisAPI.listarEscalasAtivas(colaborador.opsId)
      .then((lista) => setEscalas((lista || []).filter((e) => e.idEscala !== colaborador.idEscala)))
      .catch(() => setEscalas([]))
      .finally(() => setCarregandoEscalas(false));
  }, [tipo, colaborador?.opsId, colaborador?.idEscala]);

  /* carrega turnos ativos da estação quando o colaborador é definido (Troca de Turno) */
  useEffect(() => {
    if (tipo !== "TROCA_TURNO" || !colaborador?.opsId) return;
    setCarregandoTurnos(true);
    SolicitacoesOperacionaisAPI.listarTurnosAtivos(colaborador.opsId)
      .then((lista) => setTurnos(lista || []))
      .catch(() => setTurnos([]))
      .finally(() => setCarregandoTurnos(false));
  }, [tipo, colaborador?.opsId]);

  /* carrega empresas SPX/diretas quando o colaborador é definido (Internalização) */
  useEffect(() => {
    if (tipo !== "INTERNALIZACAO" || !colaborador?.opsId) return;
    setCarregandoEmpresasInternalizacao(true);
    SolicitacoesOperacionaisAPI.listarEmpresasInternalizacao(colaborador.opsId)
      .then((lista) => setEmpresasInternalizacao(lista || []))
      .catch(() => setEmpresasInternalizacao([]))
      .finally(() => setCarregandoEmpresasInternalizacao(false));
  }, [tipo, colaborador?.opsId]);

  /* verifica elegibilidade do colaborador para Internalização assim que ele é definido */
  useEffect(() => {
    setConfirmarMesmoAssim(false);
    if (tipo !== "INTERNALIZACAO" || !colaborador?.opsId) {
      setElegibilidadeInternalizacao(null);
      return;
    }
    setVerificandoElegibilidade(true);
    SolicitacoesOperacionaisAPI.verificarElegibilidadeInternalizacao(colaborador.opsId)
      .then((resultado) => setElegibilidadeInternalizacao(resultado))
      .catch(() => setElegibilidadeInternalizacao(null))
      .finally(() => setVerificandoElegibilidade(false));
  }, [tipo, colaborador?.opsId]);

  const inversaoValida = dsrDataAtual1 && dsrDataNova1 && dsrDataAtual2 && dsrDataNova2
    ? dsrDataAtual1 === dsrDataNova2 && dsrDataAtual2 === dsrDataNova1
    : true;

  const podeEnviar = (() => {
    if (!motivo.trim()) return false;
    if (tipo === "TROCA_DSR") {
      if (!colaborador || !colaborador2) return false;
      if (colaborador.opsId === colaborador2.opsId) return false;
      if (!dsrDataAtual1 || !dsrDataNova1 || !dsrDataAtual2 || !dsrDataNova2) return false;
      return inversaoValida;
    }
    if (!colaborador) return false;
    if (TIPOS_COM_DATA_GENERICA.includes(tipo)) {
      if (!data) return false;
      if (tipo === "BANCO_HORAS" && !bhDiaCompleto && (!bhQuantidadeHoras || !bhHoraEntrada)) return false;
      if (tipo === "SINERGIA" && !sinergiaDestino) return false;
      if (tipo === "HORA_EXTRA" && (!heHoraEntrada || !heHoraSaida || jornadaHeInvalida(heHoraEntrada, heHoraSaida))) return false;
      return true;
    }
    if (tipo === "TROCA_GESTAO") return !!novoLiderOpsId;
    if (tipo === "TROCA_ESCALA") return !!novaIdEscala;
    if (tipo === "DESLIGAMENTO") {
      return !!dataDesligamentoSolicitada && !!motivoDesligamentoSolicitado && !!tipoDesligamentoSolicitado;
    }
    if (tipo === "TROCA_TURNO") return !!novoIdTurno;
    if (tipo === "FERIAS" || tipo === "AFASTAMENTO") {
      if (!dataInicioAusencia || !dataFimAusencia) return false;
      return dataFimAusencia >= dataInicioAusencia;
    }
    if (tipo === "INTERNALIZACAO") {
      if (!internalizacaoNovaIdEmpresa || !internalizacaoNovaMatricula.trim()) return false;
      if (verificandoElegibilidade) return false;
      if (elegibilidadeInternalizacao && !elegibilidadeInternalizacao.elegivel && !confirmarMesmoAssim) return false;
      return true;
    }
    return false;
  })();

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const payload = { tipo, motivo: motivo.trim() };

      if (tipo === "TROCA_DSR") {
        payload.opsId = colaborador.opsId;
        payload.opsId2 = colaborador2.opsId;
        payload.dsrDataAtual1 = dsrDataAtual1;
        payload.dsrDataNova1 = dsrDataNova1;
        payload.dsrDataAtual2 = dsrDataAtual2;
        payload.dsrDataNova2 = dsrDataNova2;
      } else if (TIPOS_COM_DATA_GENERICA.includes(tipo)) {
        payload.opsId = colaborador.opsId;
        payload.data = data;
        if (tipo === "BANCO_HORAS") {
          payload.bhDiaCompleto = bhDiaCompleto;
          if (!bhDiaCompleto) {
            payload.bhQuantidadeHoras = Number(bhQuantidadeHoras);
            payload.bhHoraEntrada = bhHoraEntrada;
          }
        }
        if (tipo === "SINERGIA") {
          payload.sinergiaDestino = sinergiaDestino;
        }
        if (tipo === "HORA_EXTRA") {
          payload.heHoraEntrada = heHoraEntrada;
          payload.heHoraSaida = heHoraSaida;
        }
      } else if (tipo === "TROCA_GESTAO") {
        payload.opsId = colaborador.opsId;
        payload.novoLiderOpsId = novoLiderOpsId;
      } else if (tipo === "TROCA_ESCALA") {
        payload.opsId = colaborador.opsId;
        payload.novaIdEscala = Number(novaIdEscala);
      } else if (tipo === "DESLIGAMENTO") {
        payload.opsId = colaborador.opsId;
        payload.dataDesligamentoSolicitada = dataDesligamentoSolicitada;
        payload.motivoDesligamentoSolicitado = motivoDesligamentoSolicitado;
        payload.tipoDesligamentoSolicitado = tipoDesligamentoSolicitado;
      } else if (tipo === "TROCA_TURNO") {
        payload.opsId = colaborador.opsId;
        payload.novoIdTurno = Number(novoIdTurno);
      } else if (tipo === "FERIAS" || tipo === "AFASTAMENTO") {
        payload.opsId = colaborador.opsId;
        payload.dataInicio = dataInicioAusencia;
        payload.dataFim = dataFimAusencia;
      } else if (tipo === "INTERNALIZACAO") {
        payload.opsId = colaborador.opsId;
        payload.internalizacaoNovaIdEmpresa = Number(internalizacaoNovaIdEmpresa);
        payload.internalizacaoNovaMatricula = internalizacaoNovaMatricula.trim();
        payload.internalizacaoForcada = confirmarMesmoAssim;
      }

      const criada = await SolicitacoesOperacionaisAPI.criar(payload);

      if (tipo === "SINERGIA") {
        // Sinergia costuma ser lançada em sequência para vários colaboradores —
        // em vez de navegar pro detalhe, mantém a tela pronta pra próxima.
        setSucessoMsg(`Solicitação Nº ${criada.idSolicitacao} criada com sucesso para ${colaborador?.nomeCompleto || "o colaborador"}.`);
        setColaborador(null);
        setData("");
        setSinergiaDestino("");
        setMotivo("");
        setFormKey((k) => k + 1);
      } else {
        navigate(`/solicitacoes-operacionais/${criada.idSolicitacao}`);
      }
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login"); return; }
      setErro(e.response?.data?.message || "Erro ao criar solicitação");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => (tipo ? escolherTipo(null) : navigate("/solicitacoes-operacionais"))}
              className="p-2.5 rounded-xl bg-surface-2 text-muted hover:text-page transition-all cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold">Nova Solicitação</h1>
              <p className="text-sm text-muted mt-0.5">
                {tipo ? `Tipo selecionado: ${TIPOS.find((t) => t.key === tipo)?.label}` : "Escolha o tipo de solicitação operacional"}
              </p>
            </div>
          </div>

          {!tipo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => escolherTipo(t.key)}
                    className="text-left bg-surface rounded-2xl border border-default p-5 hover:border-[#FA4C00]/50 hover:bg-surface-2/50 transition-all cursor-pointer"
                  >
                    <div className="p-2.5 bg-[#FA4C00]/10 rounded-xl w-fit mb-3">
                      <Icon size={22} className="text-[#FA4C00]" />
                    </div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted mt-1">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {tipo && (
            <div className="bg-surface rounded-2xl border border-default p-6 space-y-5">
              {tipo === "TROCA_DSR" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Colaborador 1</p>
                      <BuscaColaboradorPorCpf onFound={setColaborador} onClear={() => setColaborador(null)} />
                      <Field label="Data atual do DSR">
                        <input type="date" value={dsrDataAtual1} onChange={(e) => setDsrDataAtual1(e.target.value)} className={fieldCls()} />
                      </Field>
                      <Field label="Nova data do DSR">
                        <input type="date" value={dsrDataNova1} onChange={(e) => setDsrDataNova1(e.target.value)} className={fieldCls()} />
                      </Field>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Colaborador 2</p>
                      <BuscaColaboradorPorCpf onFound={setColaborador2} onClear={() => setColaborador2(null)} />
                      <Field label="Data atual do DSR">
                        <input type="date" value={dsrDataAtual2} onChange={(e) => setDsrDataAtual2(e.target.value)} className={fieldCls()} />
                      </Field>
                      <Field label="Nova data do DSR">
                        <input type="date" value={dsrDataNova2} onChange={(e) => setDsrDataNova2(e.target.value)} className={fieldCls()} />
                      </Field>
                    </div>
                  </div>

                  <p className="text-xs text-muted bg-surface-2 rounded-xl px-3 py-2.5">
                    A troca precisa ser uma inversão exata: a nova data do DSR do Colaborador 1 deve ser igual à data atual do DSR do Colaborador 2, e vice-versa.
                  </p>

                  {!inversaoValida && (
                    <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                      <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FF453A]">
                        As datas informadas não formam uma inversão válida. A nova data do DSR de um colaborador deve ser a data atual do DSR do outro.
                      </p>
                    </div>
                  )}

                  {colaborador && colaborador2 && colaborador.opsId === colaborador2.opsId && (
                    <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                      <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FF453A]">Os dois colaboradores devem ser diferentes.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <BuscaColaboradorPorCpf key={formKey} onFound={setColaborador} onClear={() => setColaborador(null)} />

                  {TIPOS_COM_DATA_GENERICA.includes(tipo) && (
                    <Field label={tipo === "HORA_EXTRA" ? "Data (dia de DSR)" : "Data"}>
                      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={fieldCls()} />
                    </Field>
                  )}

                  {tipo === "BANCO_HORAS" && (
                    <>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={bhDiaCompleto} onChange={(e) => setBhDiaCompleto(e.target.checked)} className="accent-[#FA4C00]" />
                        Dia completo
                      </label>
                      {!bhDiaCompleto && (
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Quantidade de horas">
                            <input type="number" step="0.5" min="0" max="24" value={bhQuantidadeHoras} onChange={(e) => setBhQuantidadeHoras(e.target.value)} className={fieldCls()} />
                          </Field>
                          <Field label="Hora de entrada">
                            <input type="time" value={bhHoraEntrada} onChange={(e) => setBhHoraEntrada(e.target.value)} className={fieldCls()} />
                          </Field>
                        </div>
                      )}
                      {!bhDiaCompleto && (
                        <p className="text-xs text-muted bg-surface-2 rounded-xl px-3 py-2.5">
                          Com horas parciais, o colaborador continuará marcado como "Presente" no Controle de Presença, com a hora de entrada informada.
                        </p>
                      )}
                    </>
                  )}

                  {tipo === "SINERGIA" && (
                    <Field label="Destino">
                      <select value={sinergiaDestino} onChange={(e) => setSinergiaDestino(e.target.value)} className={`${fieldCls()} appearance-none cursor-pointer`}>
                        <option value="" disabled>Selecione o destino</option>
                        <option value="FULL">FULL</option>
                        <option value="TRATATIVAS">Tratativas</option>
                        <option value="OUTRA_OPERACAO">Outra Operação</option>
                        <option value="ALMOXARIFADO">Almoxarifado</option>
                        <option value="MEIO_AMBIENTE">Meio Ambiente</option>
                      </select>
                    </Field>
                  )}

                  {tipo === "HORA_EXTRA" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Hora de entrada">
                          <input type="time" value={heHoraEntrada} onChange={(e) => setHeHoraEntrada(e.target.value)} className={fieldCls()} />
                        </Field>
                        <Field label="Hora de saída">
                          <input type="time" value={heHoraSaida} onChange={(e) => setHeHoraSaida(e.target.value)} className={fieldCls()} />
                        </Field>
                      </div>
                      <p className="text-xs text-muted bg-surface-2 rounded-xl px-3 py-2.5">
                        Só é possível solicitar hora extra em um dia que seja DSR do colaborador. Após aprovada, o dia deixa de aparecer como DSR e passa a mostrar o horário trabalhado.
                      </p>
                      {jornadaHeInvalida(heHoraEntrada, heHoraSaida) && (
                        <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                          <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                          <p className="text-xs text-[#FF453A]">Jornada inválida. Verifique os horários informados (máximo de 16h).</p>
                        </div>
                      )}
                    </>
                  )}

                  {tipo === "TROCA_GESTAO" && (
                    <Field label="Novo líder">
                      <select
                        value={novoLiderOpsId}
                        onChange={(e) => setNovoLiderOpsId(e.target.value)}
                        disabled={!colaborador || carregandoLideres}
                        className={`${fieldCls()} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <option value="" disabled>
                          {!colaborador ? "Informe o CPF do colaborador primeiro" : carregandoLideres ? "Carregando líderes..." : "Selecione o novo líder"}
                        </option>
                        {lideres.map((l) => (
                          <option key={l.opsId} value={l.opsId}>
                            {l.nomeCompleto}{l.cargo?.nomeCargo ? ` — ${l.cargo.nomeCargo}` : ""}
                          </option>
                        ))}
                      </select>
                      {colaborador && !carregandoLideres && lideres.length === 0 && (
                        <p className="text-xs text-muted mt-1">Nenhum líder ativo encontrado na estação do colaborador.</p>
                      )}
                    </Field>
                  )}

                  {tipo === "TROCA_ESCALA" && (
                    <Field label="Nova escala">
                      <select
                        value={novaIdEscala}
                        onChange={(e) => setNovaIdEscala(e.target.value)}
                        disabled={!colaborador || carregandoEscalas}
                        className={`${fieldCls()} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <option value="" disabled>
                          {!colaborador ? "Informe o CPF do colaborador primeiro" : carregandoEscalas ? "Carregando escalas..." : "Selecione a nova escala"}
                        </option>
                        {escalas.map((e) => (
                          <option key={e.idEscala} value={e.idEscala}>
                            {e.nomeEscala}{e.descricao ? ` — ${e.descricao}` : ""}
                          </option>
                        ))}
                      </select>
                      {colaborador && !carregandoEscalas && escalas.length === 0 && (
                        <p className="text-xs text-muted mt-1">Nenhuma outra escala ativa disponível para a estação do colaborador.</p>
                      )}
                    </Field>
                  )}

                  {tipo === "DESLIGAMENTO" && (
                    <>
                      <Field label="Data de desligamento">
                        <input type="date" value={dataDesligamentoSolicitada} onChange={(e) => setDataDesligamentoSolicitada(e.target.value)} className={fieldCls()} />
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Tipo de desligamento">
                          <select value={tipoDesligamentoSolicitado} onChange={(e) => setTipoDesligamentoSolicitado(e.target.value)} className={`${fieldCls()} appearance-none cursor-pointer`}>
                            <option value="" disabled>Selecione</option>
                            {Object.entries(TIPO_DESLIGAMENTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </Field>
                        <Field label="Motivo do desligamento">
                          <select value={motivoDesligamentoSolicitado} onChange={(e) => setMotivoDesligamentoSolicitado(e.target.value)} className={`${fieldCls()} appearance-none cursor-pointer`}>
                            <option value="" disabled>Selecione</option>
                            {Object.entries(MOTIVO_DESLIGAMENTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                        <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#FF453A]">
                          Ao ser aprovada, o colaborador é desligado automaticamente: status muda para Inativo e os dias restantes do mês são preenchidos no Controle de Presença.
                        </p>
                      </div>
                    </>
                  )}

                  {tipo === "TROCA_TURNO" && (
                    <Field label="Novo turno">
                      <select
                        value={novoIdTurno}
                        onChange={(e) => setNovoIdTurno(e.target.value)}
                        disabled={!colaborador || carregandoTurnos}
                        className={`${fieldCls()} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <option value="" disabled>
                          {!colaborador ? "Informe o CPF do colaborador primeiro" : carregandoTurnos ? "Carregando turnos..." : "Selecione o novo turno"}
                        </option>
                        {turnos.map((t) => (
                          <option key={t.idTurno} value={t.idTurno}>{t.nomeTurno}</option>
                        ))}
                      </select>
                      {colaborador && !carregandoTurnos && turnos.length === 0 && (
                        <p className="text-xs text-muted mt-1">Nenhum turno ativo encontrado na estação do colaborador.</p>
                      )}
                    </Field>
                  )}

                  {(tipo === "FERIAS" || tipo === "AFASTAMENTO") && (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Data de início">
                        <input type="date" value={dataInicioAusencia} onChange={(e) => setDataInicioAusencia(e.target.value)} className={fieldCls()} />
                      </Field>
                      <Field label="Data de fim">
                        <input type="date" value={dataFimAusencia} onChange={(e) => setDataFimAusencia(e.target.value)} className={fieldCls()} />
                      </Field>
                    </div>
                  )}
                  {(tipo === "FERIAS" || tipo === "AFASTAMENTO") && dataInicioAusencia && dataFimAusencia && dataFimAusencia < dataInicioAusencia && (
                    <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                      <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FF453A]">A data de fim não pode ser anterior à data de início.</p>
                    </div>
                  )}

                  {tipo === "INTERNALIZACAO" && (
                    <>
                      <Field label="Nova empresa">
                        <select
                          value={internalizacaoNovaIdEmpresa}
                          onChange={(e) => setInternalizacaoNovaIdEmpresa(e.target.value)}
                          disabled={!colaborador || carregandoEmpresasInternalizacao}
                          className={`${fieldCls()} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <option value="" disabled>
                            {!colaborador ? "Informe o CPF do colaborador primeiro" : carregandoEmpresasInternalizacao ? "Carregando empresas..." : "Selecione a nova empresa"}
                          </option>
                          {empresasInternalizacao.map((e) => (
                            <option key={e.idEmpresa} value={e.idEmpresa}>{e.razaoSocial}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Nova matrícula">
                        <input
                          type="text"
                          value={internalizacaoNovaMatricula}
                          onChange={(e) => setInternalizacaoNovaMatricula(e.target.value)}
                          placeholder="Nova matrícula do colaborador"
                          className={fieldCls()}
                        />
                      </Field>

                      {colaborador && verificandoElegibilidade && (
                        <p className="text-xs text-muted bg-surface-2 rounded-xl px-3 py-2.5">Verificando elegibilidade do colaborador...</p>
                      )}

                      {colaborador && !verificandoElegibilidade && elegibilidadeInternalizacao?.elegivel && (
                        <div className="flex gap-2.5 rounded-xl border border-[#34C759]/30 bg-[#34C759]/5 p-3">
                          <CheckCircle2 size={15} className="text-[#34C759] shrink-0 mt-0.5" />
                          <p className="text-xs text-[#34C759]">
                            Colaborador atende aos critérios de internalização ({elegibilidadeInternalizacao.diasCasa} dias de casa).
                          </p>
                        </div>
                      )}

                      {colaborador && !verificandoElegibilidade && elegibilidadeInternalizacao && !elegibilidadeInternalizacao.elegivel && (
                        <div className="space-y-2.5">
                          <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                            <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                            <div className="text-xs text-[#FF453A]">
                              <p className="font-medium mb-1">Colaborador não atende aos critérios de internalização:</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {elegibilidadeInternalizacao.motivos.map((m, i) => <li key={i}>{m}</li>)}
                              </ul>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confirmarMesmoAssim}
                              onChange={(e) => setConfirmarMesmoAssim(e.target.checked)}
                              className="accent-[#FA4C00]"
                            />
                            Confirmo que quero solicitar a internalização mesmo assim
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <Field label="Motivo da solicitação">
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo da solicitação..."
                  rows={3}
                  className={`${fieldCls()} resize-none`}
                />
              </Field>

              {erro && (
                <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
                  <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#FF453A]">{erro}</p>
                </div>
              )}

              {sucessoMsg && (
                <div className="flex gap-2.5 rounded-xl border border-[#34C759]/30 bg-[#34C759]/5 p-3">
                  <CheckCircle2 size={15} className="text-[#34C759] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#34C759]">{sucessoMsg}</p>
                </div>
              )}

              <div className={`flex items-center pt-2 ${["FOLGA", "SINERGIA", "BANCO_HORAS", "INTERNALIZACAO"].includes(tipo) ? "justify-between" : "justify-end"}`}>
                {["FOLGA", "SINERGIA", "BANCO_HORAS", "INTERNALIZACAO"].includes(tipo) && (
                  <button
                    onClick={() => setImportarAberto(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm text-muted hover:text-page transition-colors cursor-pointer"
                  >
                    <Upload size={15} /> Importar em massa
                  </button>
                )}
                <div className="flex gap-3">
                  <button onClick={() => escolherTipo(null)} className="px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm transition-colors cursor-pointer">
                    Voltar
                  </button>
                  <button
                    onClick={enviar}
                    disabled={!podeEnviar || enviando}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      !podeEnviar || enviando ? "bg-[#FA4C00]/40 text-white/60 cursor-not-allowed" : "bg-[#FA4C00] hover:bg-[#D84300] text-white"
                    }`}
                  >
                    <Send size={15} /> {enviando ? "Enviando..." : "Enviar Solicitação"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {importarAberto && tipo === "FOLGA" && (
            <ImportarFolgaModal onClose={() => setImportarAberto(false)} />
          )}
          {importarAberto && tipo === "SINERGIA" && (
            <ImportarSinergiaModal onClose={() => setImportarAberto(false)} />
          )}
          {importarAberto && tipo === "BANCO_HORAS" && (
            <ImportarBancoHorasModal onClose={() => setImportarAberto(false)} />
          )}
          {importarAberto && tipo === "INTERNALIZACAO" && (
            <ImportarInternalizacaoModal onClose={() => setImportarAberto(false)} />
          )}
        </main>
      </MainLayout>
    </div>
  );
}
