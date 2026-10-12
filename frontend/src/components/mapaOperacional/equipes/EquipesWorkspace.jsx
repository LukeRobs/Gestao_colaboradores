import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, SearchX } from "lucide-react";
import toast from "react-hot-toast";
import { confirmDialog } from "../../ConfirmDialog";
import { Aviso, EstadoVazio, Esqueleto, TurnoTabs } from "../ui";
import { BTN_PRIMARIO, BTN_SECUNDARIO, INPUT } from "../uiTokens";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";
import { TimesAPI } from "../../../services/times";
import { TimeCard } from "./TimeCard";
import { TimeFormModal } from "./TimeFormModal";
import { AdicionarIntegranteModal } from "./AdicionarIntegranteModal";

// Mesmo ritmo das demais telas do Label: quem mexe nos times aparece para todos sem F5.
const POLL_INTERVAL_MS = 20000;

const SECOES = [
  { operacao: "INBOUND", titulo: "Recebimento" },
  { operacao: "OUTBOUND", titulo: "Expedição" },
];

function SecaoOperacao({ titulo, operacao, times, buscando, onNovo, children }) {
  return (
    <section aria-label={`Equipes de ${titulo}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {titulo} <span className="ml-1 text-sm font-normal text-muted tabular-nums">{times.length}</span>
        </h2>
        <button type="button" onClick={() => onNovo(operacao)} className={`${BTN_SECUNDARIO} h-10`}>
          <Plus size={15} aria-hidden="true" /> Novo time
        </button>
      </div>

      {times.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-default px-6 py-8 text-center text-sm text-muted">
          {buscando ? `Nenhum time de ${titulo} corresponde à busca.` : `Nenhum time de ${titulo} neste turno.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">{children}</div>
      )}
    </section>
  );
}

export function EquipesWorkspace({ onChanged }) {
  const [times, setTimes] = useState(null); // todos os times ativos, de todos os turnos
  const [erro, setErro] = useState(false);
  const [turno, setTurno] = useState(null);
  const [turnoAgora, setTurnoAgora] = useState(null);
  const [busca, setBusca] = useState("");
  const [formulario, setFormulario] = useState(null); // { time? , operacao? }
  const [idTimeAdicionar, setIdTimeAdicionar] = useState(null);

  // Abre no turno atual (se falhar, T1).
  useEffect(() => {
    let ativo = true;
    MapaOperacionalAPI.obterTurnoAtual()
      .then((info) => {
        if (!ativo) return;
        setTurnoAgora(info.turno);
        setTurno(info.turno);
      })
      .catch(() => ativo && setTurno("T1"));
    return () => {
      ativo = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      setTimes(await TimesAPI.listar());
      setErro(false);
    } catch {
      setErro(true);
      setTimes((anterior) => anterior ?? []);
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(carregar, 0);
    const intervalo = setInterval(() => {
      if (!document.hidden) carregar();
    }, POLL_INTERVAL_MS);
    const aoVoltar = () => {
      if (!document.hidden) carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar]);

  const atualizar = useCallback(() => {
    carregar();
    onChanged?.();
  }, [carregar, onChanged]);

  // Quem já está em algum time (de qualquer turno): trava a escolha duplicada no modal de adicionar.
  const ocupantes = useMemo(() => {
    const mapa = new Map();
    (times || []).forEach((t) => t.integrantes.forEach((i) => mapa.set(i.colaborador.opsId, { idTime: t.idTime, nome: t.nome, turno: t.turno })));
    return mapa;
  }, [times]);

  const termo = busca.trim().toLowerCase();
  const doTurno = useMemo(() => (times || []).filter((t) => t.turno === turno), [times, turno]);
  const visiveis = useMemo(
    () =>
      termo
        ? doTurno.filter((t) => t.nome.toLowerCase().includes(termo) || t.integrantes.some((i) => i.colaborador.nomeCompleto.toLowerCase().includes(termo)))
        : doTurno,
    [doTurno, termo]
  );

  const resumo = useMemo(
    () => ({
      times: doTurno.length,
      pessoas: doTurno.reduce((soma, t) => soma + t.integrantes.length, 0),
      emDoca: doTurno.filter((t) => t.docaAtual != null).length,
    }),
    [doTurno]
  );

  async function excluir(time) {
    const ok = await confirmDialog(`Excluir o time "${time.nome}"? Os integrantes ficam livres para entrar em outro time.`, { danger: true });
    if (!ok) return;
    try {
      await TimesAPI.excluir(time.idTime);
      toast.success("Time excluído");
      atualizar();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao excluir time");
    }
  }

  const timeAdicionar = idTimeAdicionar != null ? (times || []).find((t) => t.idTime === idTimeAdicionar) : null;
  const pronto = times !== null && turno !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        {turno && <TurnoTabs turno={turno} turnoAgora={turnoAgora} onChange={setTurno} />}

        <div className="relative flex-1 min-w-[200px] sm:max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar time ou integrante"
            placeholder="Buscar time ou pessoa"
            className={`${INPUT} pl-10`}
          />
        </div>

        <button type="button" onClick={() => setFormulario({ operacao: "INBOUND" })} className={`${BTN_PRIMARIO} ml-auto`}>
          <Plus size={15} aria-hidden="true" /> Novo time
        </button>
      </div>

      {pronto && (
        <p className="text-sm text-muted tabular-nums" aria-live="polite">
          {resumo.times} {resumo.times === 1 ? "time" : "times"} · {resumo.pessoas} {resumo.pessoas === 1 ? "pessoa" : "pessoas"} · {resumo.emDoca} em doca agora
        </p>
      )}

      {erro && (
        <Aviso
          tipo="erro"
          acao={
            <button type="button" onClick={carregar} className={`${BTN_SECUNDARIO} h-9`}>
              Tentar de novo
            </button>
          }
        >
          Não foi possível carregar as equipes.{times?.length ? " Mostrando os últimos dados carregados." : ""}
        </Aviso>
      )}

      {!pronto ? (
        <div aria-busy="true" aria-label="Carregando equipes" className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Esqueleto key={i} className="h-64" />
          ))}
        </div>
      ) : termo && visiveis.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-default">
          <EstadoVazio
            icone={<SearchX size={28} aria-hidden="true" />}
            titulo="Nada encontrado"
            descricao={`Nenhum time ou pessoa corresponde à busca no ${turno}.`}
            acao={
              <button type="button" onClick={() => setBusca("")} className={`${BTN_SECUNDARIO} h-10 mt-2`}>
                Limpar busca
              </button>
            }
          />
        </div>
      ) : (
        SECOES.map(({ operacao, titulo }) => {
          const daSecao = visiveis.filter((t) => t.operacao === operacao);
          const fifo = daSecao.filter((t) => t.tipo === "FIFO");
          const operacionais = daSecao.filter((t) => t.tipo !== "FIFO");
          return (
            <SecaoOperacao key={operacao} titulo={titulo} operacao={operacao} times={daSecao} buscando={!!termo} onNovo={(op) => setFormulario({ operacao: op })}>
              {[...fifo, ...operacionais].map((t) => (
                <TimeCard
                  key={t.idTime}
                  time={t}
                  onEditar={() => setFormulario({ time: t })}
                  onExcluir={() => excluir(t)}
                  onAdicionar={() => setIdTimeAdicionar(t.idTime)}
                  onAtualizado={atualizar}
                />
              ))}
            </SecaoOperacao>
          );
        })
      )}

      {formulario && (
        <TimeFormModal
          time={formulario.time}
          operacaoInicial={formulario.operacao}
          turnoInicial={turno}
          onClose={() => setFormulario(null)}
          onSalvo={atualizar}
        />
      )}

      {timeAdicionar && <AdicionarIntegranteModal time={timeAdicionar} ocupantes={ocupantes} onClose={() => setIdTimeAdicionar(null)} onAtualizado={atualizar} />}
    </div>
  );
}
