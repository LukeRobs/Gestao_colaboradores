import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AlocarColaboradorModal } from "../../components/mapaOperacional/AlocarColaboradorModal";
import { AutoAlocacaoDetalheModal } from "../../components/mapaOperacional/AutoAlocacaoDetalheModal";
import { LaborManualSection } from "../../components/mapaOperacional/LaborManualSection";
import { MapaEsteiraComPescas } from "../../components/mapaOperacional/MapaEsteiraComPescas";
import { FaixaAvisos } from "../../components/mapaOperacional/avisos/FaixaAvisos";
import { NovoAvisoModal } from "../../components/mapaOperacional/avisos/NovoAvisoModal";
import { avisosPorBraco } from "../../components/mapaOperacional/avisos/avisosConfig";
import { useAvisos } from "../../components/mapaOperacional/avisos/useAvisos";
import { SinergiasNaArea } from "../../components/mapaOperacional/sinergia/SinergiasNaArea";
import { codigoDaEsteira } from "../../components/mapaOperacional/sinergia/status";
import {
  Aviso,
  DiaNavegador,
  Esqueleto,
  FaixaIndicadores,
  PageHeader,
  TurnoTabs,
} from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, LABORS_MANUAIS, ehTurnoFuturo, formatNumero, somarDias } from "../../components/mapaOperacional/uiTokens";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

const POLL_INTERVAL_MS = 20000;
const TURNOS = ["T1", "T2", "T3"];
const NOMES_LABOR = Object.fromEntries(LABORS_MANUAIS.map((l) => [l.value, l.label]));

// Num turno passado o log traz cada passagem por um braço; no quadro vale a última de cada pessoa.
function ultimasPescas(linhas, aoVivo) {
  if (aoVivo) return linhas;
  const porPessoa = new Map();
  linhas.forEach((l) => {
    const chave = l.opsId || l.idAlocacao;
    const atual = porPessoa.get(chave);
    if (!atual || new Date(l.inicio) > new Date(atual.inicio)) porPessoa.set(chave, l);
  });
  return [...porPessoa.values()];
}

const pescasDoBraco = (pescas, braco) => pescas.filter((p) => p.braco === braco.numero && p.lado === braco.lado);

function LegendaItem({ cor, tracejado = false, rotulo, total }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-[4px] border-[1.5px]"
        style={{ borderColor: cor, background: tracejado ? "transparent" : `${cor}26` }}
      />
      {rotulo}
      {total !== undefined && <span className="tabular-nums text-page font-medium">{total}</span>}
    </span>
  );
}

function EsqueletoPagina() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando esteira">
      <Esqueleto className="h-24" />
      <Esqueleto className="h-80" />
      <Esqueleto className="h-64" />
    </div>
  );
}

export default function EsteiraDetalhe() {
  const { idEsteira } = useParams();
  const [params, setParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [esteira, setEsteira] = useState(null);
  const [todasEsteiras, setTodasEsteiras] = useState([]); // nomes, pros avisos de outras áreas
  const [modalAviso, setModalAviso] = useState(null); // { alvoInicial? }
  const { avisos, recarregar: recarregarAvisos } = useAvisos();
  const [dados, setDados] = useState(null); // { idEsteira, turno, data, alocacoes, producao }
  const [erro, setErro] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [modal, setModal] = useState(null); // { braco, alocacaoAtual }
  const [modalAuto, setModalAuto] = useState(null); // { braco, grupo }
  // Preferência de cada pessoa neste navegador: cartão de fanouts ao passar o mouse nos braços.
  const [fanoutsAoPassarMouse, setFanoutsAoPassarMouse] = useState(() => {
    try {
      return localStorage.getItem("label_fanouts_hover") !== "0";
    } catch {
      return true;
    }
  });
  const alternarFanoutsHover = () =>
    setFanoutsAoPassarMouse((atual) => {
      try {
        localStorage.setItem("label_fanouts_hover", atual ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
      return !atual;
    });
  const [fanouts, setFanouts] = useState(null); // { "3-A": ["LPE-93", ...] } — configurados em Operação > Label > Configuração
  const [turnoAtual, setTurnoAtual] = useState(null); // turno/dia operacional real, vindo do backend

  // Turno e dia ficam na URL (sobrevivem ao F5 e podem ser compartilhados); sem eles vale o "agora".
  const turnoParam = params.get("turno");
  const dataParam = params.get("data");
  const turnoSelecionado = TURNOS.includes(turnoParam) ? turnoParam : (turnoAtual?.turno ?? null);
  const dataSelecionada = /^\d{4}-\d{2}-\d{2}$/.test(dataParam || "") ? dataParam : (turnoAtual?.diaOperacionalStr ?? null);

  const estaNoTurnoAtual =
    !!turnoAtual && turnoSelecionado === turnoAtual.turno && dataSelecionada === turnoAtual.diaOperacionalStr;
  // Turno que ainda não começou: dá para pré-alocar as funções (as pessoas entram sozinhas quando ele começar).
  const ehFuturo = ehTurnoFuturo(turnoAtual, dataSelecionada, turnoSelecionado);

  const atualizarParams = (mudancas) => {
    const proximo = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => (v ? proximo.set(k, v) : proximo.delete(k)));
    setParams(proximo, { replace: true });
  };

  useEffect(() => {
    MapaOperacionalAPI.obterTurnoAtual()
      .then(setTurnoAtual)
      .catch(() => setErro("Não foi possível carregar o turno atual."));
  }, []);

  // Configuração da esteira (braços) — só muda quando troca de esteira.
  useEffect(() => {
    let ativo = true;
    MapaOperacionalAPI.listarEsteiras()
      .then((lista) => {
        if (!ativo) return;
        setTodasEsteiras(lista);
        const encontrada = lista.find((e) => String(e.idEsteira) === String(idEsteira));
        if (encontrada) setEsteira(encontrada);
        else setErro("Esteira não encontrada.");
      })
      .catch((e) => ativo && setErro(e.response?.data?.message || "Erro ao carregar esteira"));
    return () => {
      ativo = false;
    };
  }, [idEsteira]);

  // Fanouts por braço: mudam raramente (só pela tela de configuração), então carregam uma vez por esteira.
  useEffect(() => {
    let ativo = true;
    MapaOperacionalAPI.listarFanouts({ escopo: "ESTEIRA", idEsteira })
      .then((r) => ativo && setFanouts(Object.fromEntries(r.posicoes.map((p) => [`${p.braco}-${p.lado}`, p.fanouts]))))
      .catch(() => ativo && setFanouts(null));
    return () => {
      ativo = false;
    };
  }, [idEsteira]);

  const carregar = useCallback(async () => {
    if (!turnoSelecionado || !dataSelecionada) return;
    try {
      const paramsTurno = { turno: turnoSelecionado, data: dataSelecionada };
      const [manuais, autos, producaoTurno, agendadas] = await Promise.all([
        MapaOperacionalAPI.listarAlocacoes(idEsteira, paramsTurno),
        MapaOperacionalAPI.listarAutoAlocacoes(idEsteira, paramsTurno).catch(() => []),
        MapaOperacionalAPI.obterProducaoTurno(idEsteira, paramsTurno).catch(() => null),
        ehFuturo || estaNoTurnoAtual
          ? MapaOperacionalAPI.listarAgendadas({ ...paramsTurno, idEsteira }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setDados({
        idEsteira: String(idEsteira),
        turno: turnoSelecionado,
        data: dataSelecionada,
        alocacoes: [...manuais, ...autos],
        agendadas,
        producao: producaoTurno?.producaoAcumulada,
      });
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e.response?.data?.message || "Não foi possível carregar as alocações");
    }
  }, [idEsteira, turnoSelecionado, dataSelecionada, ehFuturo, estaNoTurnoAtual]);

  useEffect(() => {
    const primeira = setTimeout(carregar, 0);
    return () => clearTimeout(primeira);
  }, [carregar]);

  // Ao vivo e em turno futuro: recarrega a cada 20 s e confere se o turno virou (o futuro vira o atual sozinho).
  useEffect(() => {
    if (!estaNoTurnoAtual && !ehFuturo) return undefined;
    const intervalo = setInterval(() => {
      if (document.hidden) return;
      MapaOperacionalAPI.obterTurnoAtual()
        .then((t) => setTurnoAtual((prev) => (prev && prev.turno === t.turno && prev.diaOperacionalStr === t.diaOperacionalStr ? prev : t)))
        .catch(() => {});
      carregar();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalo);
  }, [estaNoTurnoAtual, ehFuturo, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const voltarParaAgora = () => atualizarParams({ turno: "", data: "" });

  const esteiraAtual = esteira && String(esteira.idEsteira) === String(idEsteira) ? esteira : null;
  const dadosAtuais =
    dados && dados.idEsteira === String(idEsteira) && dados.turno === turnoSelecionado && dados.data === dataSelecionada
      ? dados
      : null;
  // Turno futuro ainda não tem ninguém alocado: as alocações abertas agora pertencem ao turno em andamento.
  const alocacoes = ehFuturo ? [] : dadosAtuais?.alocacoes || [];
  // Pré-alocações pendentes no formato das alocações manuais (idAlocacao = id da pré-alocação).
  const preAlocadas = (dadosAtuais?.agendadas || [])
    .filter((a) => a.status === "PENDENTE")
    .map((a) => ({ idAlocacao: a.idAgendada, labor: a.labor, diarista: a.diarista, colaborador: a.colaborador, opsId: a.colaborador?.opsId }));
  const naoEntraram = (dadosAtuais?.agendadas || []).filter((a) => a.status === "FALHOU");

  function handleBracoClick(braco, alocacaoAtual) {
    if (alocacaoAtual && alocacaoAtual.origem === "AUTO") {
      // Detalhe automático é só leitura por natureza — pode abrir tanto ao
      // vivo quanto num turno histórico persistido.
      setModalAuto({ braco, grupo: alocacaoAtual });
      return;
    }
    if (!estaNoTurnoAtual) return; // alocar/encerrar manualmente só no turno ao vivo
    setModal({ braco, alocacaoAtual });
  }

  // Alocações num braço/lado (packing + automático) vão pro desenho da
  // esteira; as sem braço (Pesca, Gol, Indução...) vão pra seção de
  // alocações manuais abaixo.
  // A Pesca tem quadro próprio (cada pesca fica num braço e é movida entre eles), então
  // não entra no desenho, que mostra só packing; também fica fora da lista de funções.
  const alocacoesBraco = alocacoes.filter((a) => a.braco != null && a.labor !== "PESCA");
  const alocacoesLabor = alocacoes.filter((a) => a.braco == null && a.labor !== "PESCA");
  const pescas = ultimasPescas(alocacoes.filter((a) => a.labor === "PESCA"), estaNoTurnoAtual);

  const bracoNaoAuto = alocacoesBraco.filter((a) => a.origem !== "AUTO");
  const totalManual = bracoNaoAuto.filter((a) => !a.diarista).length;
  const totalDiaristaBraco = bracoNaoAuto.filter((a) => a.diarista).length;
  const totalAuto = alocacoesBraco
    .filter((a) => a.origem === "AUTO")
    .reduce((soma, g) => soma + (g.totalColaboradores || 0), 0);
  const totalLaborManual = [...alocacoesLabor, ...pescas].filter((a) => !a.diarista).length;
  const totalDiaristaLabor = [...alocacoesLabor, ...pescas].filter((a) => a.diarista).length;
  const totalDiarista = totalDiaristaBraco + totalDiaristaLabor;
  const totalHC = totalManual + totalDiarista + totalAuto + totalLaborManual;

  // Produção da hora só existe ao vivo (lida direto da planilha, coluna que
  // já reseta sozinha a cada hora) — turno histórico não tem como
  // reconstruir isso retroativamente. Produção do turno já vem acumulada do
  // backend, então funciona tanto ao vivo quanto num turno/dia passado.
  const producaoHora = estaNoTurnoAtual
    ? alocacoesBraco.filter((a) => a.origem === "AUTO").reduce((s, g) => s + (g.producaoHoraAtualTotal || 0), 0)
    : undefined;
  const producaoTurno = dadosAtuais?.producao;
  const produtividade = producaoTurno !== undefined && totalHC > 0 ? producaoTurno / totalHC : undefined;

  // Avisos (estilo Waze) só valem ao vivo: no turno histórico/futuro não aparecem.
  const avisosVivos = estaNoTurnoAtual ? avisos : [];
  const avisosDaEsteira = avisosVivos.filter((a) => a.alvoTipo !== "DOCA" && String(a.idEsteira) === String(idEsteira));
  const avisosOutrasAreas = avisosVivos.filter((a) => a.alvoTipo === "DOCA" || String(a.idEsteira) !== String(idEsteira));
  const rotuloOutraArea = (a) => (a.alvoTipo === "DOCA" ? "Docas" : todasEsteiras.find((e) => e.idEsteira === a.idEsteira)?.nome || "Outra esteira");
  const pessoasParaAviso = [...new Map(
    [...alocacoesBraco, ...alocacoesLabor, ...pescas]
      .filter((a) => a.origem !== "AUTO" && a.opsId && !a.diarista)
      .map((a) => [a.opsId, { opsId: a.opsId, nome: a.colaborador?.nomeCompleto || a.opsId }])
  ).values()];

  const carregando = !esteiraAtual || !dadosAtuais;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1600px] mx-auto">
          <PageHeader
            titulo={esteiraAtual?.nome || "Esteira"}
            subtitulo="Alocação de colaboradores por braço, em tempo real"
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <TurnoTabs
              turno={turnoSelecionado}
              turnoAgora={turnoAtual && dataSelecionada === turnoAtual.diaOperacionalStr ? turnoAtual.turno : null}
              onChange={(t) => atualizarParams({ turno: t })}
            />
            <DiaNavegador
              data={dataSelecionada}
              maximo={turnoAtual ? somarDias(turnoAtual.diaOperacionalStr, 1) : undefined}
              onChange={(d) => atualizarParams({ data: d })}
            />
            {estaNoTurnoAtual && esteiraAtual && (
              <button
                type="button"
                onClick={() => setModalAviso({})}
                className={`ml-auto h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#D98A07] text-[#1F1300] text-sm font-bold shadow-sm transition-colors cursor-pointer ${FOCO}`}
              >
                <Megaphone size={17} strokeWidth={2.5} aria-hidden="true" /> Sinalizar ocorrência
              </button>
            )}
          </div>

          <FaixaAvisos avisos={avisosDaEsteira} nomesLabor={NOMES_LABOR} titulo="Avisos nesta esteira" onMudou={recarregarAvisos} />
          <FaixaAvisos avisos={avisosOutrasAreas} nomesLabor={NOMES_LABOR} titulo="Avisos em outras áreas da Label" rotuloArea={rotuloOutraArea} onMudou={recarregarAvisos} />

          {!estaNoTurnoAtual && turnoAtual && !erro && (
            <Aviso
              acao={
                <button type="button" onClick={voltarParaAgora} className={`${BTN_SECUNDARIO} h-9`}>
                  Voltar para agora
                </button>
              }
            >
              {ehFuturo
                ? "Turno futuro: pré-aloque as funções (Gol, Indução, Endereçamento...). As pessoas entram sozinhas quando o turno começar. Braços, pesca e packing automático só no turno em andamento."
                : "Turno histórico: somente leitura e sem produtividade retroativa."}
            </Aviso>
          )}

          {estaNoTurnoAtual && naoEntraram.length > 0 && (
            <Aviso tipo="alerta">
              {naoEntraram.length === 1 ? "1 pré-alocação não entrou" : `${naoEntraram.length} pré-alocações não entraram`}:{" "}
              {naoEntraram.map((a) => `${a.diarista ? "Diarista" : a.colaborador?.nomeCompleto} (${a.motivoFalha})`).join("; ")}
            </Aviso>
          )}

          {erro && (
            <Aviso
              tipo="erro"
              acao={
                <button type="button" onClick={atualizarAgora} className={`${BTN_SECUNDARIO} h-9`}>
                  Tentar de novo
                </button>
              }
            >
              {erro}
              {dadosAtuais && " Mostrando os últimos dados carregados."}
            </Aviso>
          )}

          {carregando ? (
            !erro && <EsqueletoPagina />
          ) : (
            <>
              <FaixaIndicadores
                rotulo="Indicadores da esteira"
                itens={[
                  { rotulo: "Total HC", valor: formatNumero(totalHC), destaque: true },
                  { rotulo: "Packing automático", valor: formatNumero(totalAuto), cor: "#22C55E" },
                  {
                    rotulo: "Produção da hora",
                    valor: formatNumero(producaoHora),
                    apoio: producaoHora === undefined ? "Só ao vivo" : undefined,
                  },
                  { rotulo: "Produção do turno", valor: formatNumero(producaoTurno) },
                  {
                    rotulo: "Produtividade (un/HC)",
                    valor: produtividade !== undefined ? produtividade.toFixed(1) : "—",
                  },
                ]}
              />

              <section aria-label="Mapa da esteira" className="bg-surface rounded-2xl border border-default p-5 sm:p-6">
                <div className="flex items-center justify-between gap-x-6 gap-y-2 flex-wrap mb-5 text-xs text-muted">
                  <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                    <LegendaItem cor="#FA4C00" rotulo="Manual" total={totalManual} />
                    <LegendaItem cor="#A855F7" rotulo="Diarista" total={totalDiarista} />
                    <LegendaItem cor="#22C55E" rotulo="Automático (Workstation)" total={totalAuto} />
                    <LegendaItem cor="#2563EB" rotulo="Pesca" total={pescas.length} />
                    <LegendaItem cor="var(--color-border)" tracejado rotulo="Livre" />
                  </div>
                  <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                    {fanouts && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={fanoutsAoPassarMouse}
                        onClick={alternarFanoutsHover}
                        className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-default hover:bg-surface-2 cursor-pointer text-xs transition-colors motion-reduce:transition-none ${FOCO}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`relative h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${fanoutsAoPassarMouse ? "bg-[#FA4C00]" : "bg-surface-3"}`}
                        >
                          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all motion-reduce:transition-none ${fanoutsAoPassarMouse ? "left-3.5" : "left-0.5"}`} />
                        </span>
                        Fanouts ao passar o mouse
                      </button>
                    )}
                    {estaNoTurnoAtual && <span>Clique em um braço para alocar ou encerrar</span>}
                  </div>
                </div>
                <MapaEsteiraComPescas
                  esteira={esteiraAtual}
                  alocacoes={alocacoesBraco}
                  pescas={pescas}
                  fanouts={fanouts}
                  mostrarFanouts={fanoutsAoPassarMouse}
                  avisosPorBraco={avisosPorBraco(avisosDaEsteira, idEsteira)}
                  somenteLeitura={!estaNoTurnoAtual}
                  onBracoClick={handleBracoClick}
                  versao={atualizadoEm?.getTime()}
                  dia={dataSelecionada}
                  onChanged={carregar}
                />
              </section>

              {estaNoTurnoAtual && codigoDaEsteira(esteiraAtual.nome) && (
                <SinergiasNaArea codigo={codigoDaEsteira(esteiraAtual.nome)} titulo="Em sinergia nesta esteira" />
              )}

              <LaborManualSection
                esteira={esteiraAtual}
                alocacoes={ehFuturo ? preAlocadas : alocacoesLabor}
                somenteLeitura={!estaNoTurnoAtual && !ehFuturo}
                agendamento={ehFuturo ? { turno: turnoSelecionado, data: dataSelecionada } : null}
                onAllocated={carregar}
                avisos={avisosDaEsteira}
                onSinalizar={estaNoTurnoAtual ? (labor) => setModalAviso({ alvoInicial: { alvoTipo: "FUNCAO", labor: labor.value } }) : null}
              />
            </>
          )}
        </main>
      </MainLayout>

      {modal && esteiraAtual && (
        <AlocarColaboradorModal
          esteira={esteiraAtual}
          braco={modal.braco}
          alocacaoAtual={modal.alocacaoAtual}
          pescas={pescasDoBraco(pescas, modal.braco)}
          fanouts={fanouts?.[`${modal.braco.numero}-${modal.braco.lado}`]}
          todasPescas={pescas}
          onClose={() => setModal(null)}
          onAllocated={carregar}
        />
      )}

      {modalAviso && esteiraAtual && (
        <NovoAvisoModal
          esteira={esteiraAtual}
          alvoInicial={modalAviso.alvoInicial}
          pessoas={pessoasParaAviso}
          onClose={() => setModalAviso(null)}
          onCriado={recarregarAvisos}
        />
      )}

      {modalAuto && esteiraAtual && (
        <AutoAlocacaoDetalheModal
          esteira={esteiraAtual}
          braco={modalAuto.braco}
          grupo={modalAuto.grupo}
          pescas={pescasDoBraco(pescas, modalAuto.braco)}
          fanouts={fanouts?.[`${modalAuto.braco.numero}-${modalAuto.braco.lado}`]}
          todasPescas={pescas}
          editavel={estaNoTurnoAtual}
          onChanged={carregar}
          onClose={() => setModalAuto(null)}
        />
      )}
    </div>
  );
}
