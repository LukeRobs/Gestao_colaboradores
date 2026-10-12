import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SearchX, Truck, Users } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { EquipesWorkspace } from "../../components/mapaOperacional/equipes/EquipesWorkspace";
import { DocaDetalheModal } from "../../components/mapaOperacional/DocaDetalheModal";
import {
  AbasPagina,
  AbasSegmentadas,
  Aviso,
  EstadoVazio,
  Esqueleto,
  FaixaIndicadores,
  PageHeader,
} from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT } from "../../components/mapaOperacional/uiTokens";
import { DocasAPI } from "../../services/docas";

const POLL_INTERVAL_MS = 20000;
const FILTROS = [
  { valor: "TODAS", rotulo: "Todas" },
  { valor: "INBOUND", rotulo: "Recebimento" },
  { valor: "OUTBOUND", rotulo: "Expedição" },
];
const NOME_OPERACAO = { INBOUND: "Recebimento", OUTBOUND: "Expedição" };
const ABAS = [
  { valor: "docas", rotulo: "Docas", icone: <Truck size={15} aria-hidden="true" /> },
  { valor: "equipes", rotulo: "Equipes", icone: <Users size={15} aria-hidden="true" /> },
];

const COR = { livre: "#22C55E", ocupada: "#FF453A", indisponivel: "#8B8B93" };

/**
 * O filtro de operação só muda a leitura, nunca a disponibilidade real: uma
 * doca ocupada por outra operação aparece como indisponível no filtro.
 */
function statusVisual(doca, filtro) {
  if (!doca.ocupada) return { chave: "livre", curto: "Disponível", completo: "Disponível" };
  const operacao = NOME_OPERACAO[doca.operacao] || "Em uso";
  if (filtro === "TODAS" || doca.operacao === filtro) {
    return { chave: "ocupada", curto: operacao, completo: `Ocupada, ${operacao}` };
  }
  return { chave: "indisponivel", curto: "Indisponível", completo: `Indisponível, ocupada por ${operacao}` };
}

function CardDoca({ doca, filtro, onClick }) {
  const status = statusVisual(doca, filtro);
  const cor = COR[status.chave];
  const nomeOcupante =
    doca.alocacao?.time?.nome || (doca.alocacao?.diarista ? "Diarista" : doca.alocacao?.colaborador?.nomeCompleto);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Doca ${doca.numero}: ${status.completo}${nomeOcupante ? `, ${nomeOcupante}` : ""}`}
      title={status.completo}
      className={`text-left bg-surface rounded-xl border p-3.5 min-h-[92px] flex flex-col gap-1 transition-colors cursor-pointer ${FOCO} ${
        status.chave === "indisponivel" ? "border-default opacity-60 hover:opacity-100" : "hover:bg-surface-2"
      }`}
      style={status.chave === "indisponivel" ? undefined : { borderColor: `${cor}59` }}
    >
      <span className="text-sm font-semibold">Doca {doca.numero}</span>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: status.chave === "indisponivel" ? undefined : cor }}>
        <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
        <span className={status.chave === "indisponivel" ? "text-muted" : ""}>{status.curto}</span>
      </span>
      {doca.ocupada && nomeOcupante && <span className="text-xs truncate">{nomeOcupante}</span>}
      {doca.sheet?.fisicamenteOcupada && (
        <span className="text-xs text-muted flex items-center gap-1 mt-auto tabular-nums">
          <Truck size={12} aria-hidden="true" /> {doca.sheet.placa} · {doca.sheet.duracao}
        </span>
      )}
    </button>
  );
}

function LegendaPonto({ cor, rotulo }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: cor }} />
      {rotulo}
    </span>
  );
}

export default function GestaoDocas() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState("TODAS");
  const [somenteLivres, setSomenteLivres] = useState(false);
  const [busca, setBusca] = useState("");
  const [docaSelecionada, setDocaSelecionada] = useState(null);
  // A aba fica na URL (?aba=equipes): dá para compartilhar o link e o F5 não perde o lugar.
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "equipes" ? "equipes" : "docas";
  const trocarAba = (valor) => setParams(valor === "docas" ? {} : { aba: valor }, { replace: true });

  const carregar = useCallback(async () => {
    try {
      setDados(await DocasAPI.listar());
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e.response?.data?.message || "Não foi possível carregar as docas");
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(carregar, 0);
    const intervalo = setInterval(() => {
      if (!document.hidden) carregar();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
    };
  }, [carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const buscaNorm = busca.trim().toLowerCase();
  const docas = dados?.docas || [];
  const docasFiltradas = docas.filter((d) => {
    if (somenteLivres && d.ocupada) return false;
    if (!buscaNorm) return true;
    return (
      String(d.numero).includes(buscaNorm) ||
      d.sheet?.placa?.toLowerCase().includes(buscaNorm) ||
      d.sheet?.motorista?.toLowerCase().includes(buscaNorm)
    );
  });
  const filtrosAtivos = !!buscaNorm || somenteLivres;

  const limparFiltros = () => {
    setBusca("");
    setSomenteLivres(false);
  };

  const ind = dados?.indicadores;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
          <PageHeader
            titulo="Gestão de Docas"
            subtitulo="Controle e alocação operacional das docas"
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

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
              {dados && " Mostrando os últimos dados carregados."}
            </Aviso>
          )}

          <AbasPagina rotulo="Visão da página" opcoes={ABAS} valor={aba} onChange={trocarAba} />

          {aba === "equipes" ? (
            <EquipesWorkspace onChanged={carregar} />
          ) : (
            <>
          {ind && (
            <FaixaIndicadores
              rotulo="Indicadores das docas"
              itens={[
                { rotulo: "Total", valor: ind.total },
                { rotulo: "Disponíveis", valor: ind.disponiveis, cor: COR.livre },
                { rotulo: "Ocupadas", valor: ind.ocupadas, cor: COR.ocupada },
                { rotulo: "Recebimento", valor: ind.recebimento },
                { rotulo: "Expedição", valor: ind.expedicao },
                { rotulo: "Bloqueadas", valor: ind.bloqueadas },
              ]}
            />
          )}


            <section aria-label="Docas" className="space-y-4 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-full sm:w-72">
                  <AbasSegmentadas rotulo="Operação" opcoes={FILTROS} valor={filtro} onChange={setFiltro} />
                </div>

                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    aria-label="Buscar doca por número, placa ou motorista"
                    placeholder="Doca, placa ou motorista"
                    className={`${INPUT} pl-10`}
                  />
                </div>

                <button
                  type="button"
                  aria-pressed={somenteLivres}
                  onClick={() => setSomenteLivres((v) => !v)}
                  className={`h-11 px-4 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
                    somenteLivres
                      ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#22C55E]"
                      : "border-default bg-surface hover:bg-surface-2 text-muted hover:text-page"
                  }`}
                >
                  Só disponíveis
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted">
                <p className="tabular-nums" aria-live="polite">
                  {dados ? `${docasFiltradas.length} de ${docas.length} docas` : ""}
                </p>
                <div className="flex items-center gap-4">
                  <LegendaPonto cor={COR.livre} rotulo="Disponível" />
                  <LegendaPonto cor={COR.ocupada} rotulo="Ocupada" />
                  {filtro !== "TODAS" && <LegendaPonto cor={COR.indisponivel} rotulo="Ocupada por outra operação" />}
                </div>
              </div>

              {!dados ? (
                erro ? null : (
                  <div aria-busy="true" aria-label="Carregando docas" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Esqueleto key={i} className="h-[92px]" />
                    ))}
                  </div>
                )
              ) : docasFiltradas.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-default">
                  <EstadoVazio
                    icone={<SearchX size={28} aria-hidden="true" />}
                    titulo="Nenhuma doca encontrada"
                    descricao={somenteLivres ? "Não há docas disponíveis para esse filtro." : "Nenhuma doca corresponde à busca."}
                    acao={
                      filtrosAtivos && (
                        <button type="button" onClick={limparFiltros} className={`${BTN_SECUNDARIO} h-10 mt-2`}>
                          Limpar filtros
                        </button>
                      )
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-3">
                  {docasFiltradas.map((d) => (
                    <CardDoca key={d.numero} doca={d} filtro={filtro} onClick={() => setDocaSelecionada(d.numero)} />
                  ))}
                </div>
              )}
            </section>
            </>
          )}
        </main>
      </MainLayout>

      {docaSelecionada && (
        <DocaDetalheModal
          numero={docaSelecionada}
          onClose={() => setDocaSelecionada(null)}
          onChanged={() => {
            carregar();
          }}
        />
      )}
    </div>
  );
}
