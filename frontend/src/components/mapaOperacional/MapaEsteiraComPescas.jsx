import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, GripVertical, History, Plus } from "lucide-react";
import toast from "react-hot-toast";
import ConveyorSvg from "./ConveyorSvg";
import { AlocarLaborModal } from "./AlocarLaborModal";
import { MoverPescaModal } from "./MoverPescaModal";
import { useArrastar } from "./useArrastar";
import { BTN_SECUNDARIO, COR_PESCA, FOCO, rotuloPosicao } from "./uiTokens";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

const chaveDe = (braco, lado) => (braco == null ? "sem" : `${braco}-${lado}`);
const nomeDe = (p) => (p.diarista ? "Diarista" : p.colaborador?.nomeCompleto || p.opsId || "—");
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

function haQuanto(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

// Cada linha do log é uma passagem por um braço; a anterior da mesma pessoa vira o "de onde".
function derivarEventos(linhas) {
  const crono = [...linhas].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const ultimaPorPessoa = new Map();
  const eventos = crono.map((l) => {
    const anterior = l.opsId ? ultimaPorPessoa.get(l.opsId) : null;
    if (l.opsId) ultimaPorPessoa.set(l.opsId, l);
    return { ...l, de: anterior ? rotuloPosicao(anterior.braco, anterior.lado) : null, para: rotuloPosicao(l.braco, l.lado) };
  });
  return eventos.reverse();
}

function ChipPesca({ pesca, fantasma, movendo, somenteLeitura, onAbrir, onAlca }) {
  const nome = nomeDe(pesca);
  const semBraco = pesca.braco == null;
  const posicao = rotuloPosicao(pesca.braco, pesca.lado);
  return (
    <li className={`flex items-stretch rounded-xl border border-default bg-surface min-h-11 ${movendo || fantasma ? "opacity-40" : ""}`}>
      {!somenteLeitura && (
        <span
          onPointerDown={onAlca}
          title="Arraste até um braço do mapa"
          aria-hidden="true"
          className="w-10 shrink-0 grid place-items-center text-muted hover:text-page cursor-grab active:cursor-grabbing touch-none rounded-l-xl hover:bg-surface-2"
        >
          <GripVertical size={16} />
        </span>
      )}
      {somenteLeitura ? (
        <div className="min-w-0 px-3 py-2">
          <p className="text-sm font-medium truncate max-w-[240px]" title={nome}>{nome}</p>
          <p className="text-xs text-muted">{posicao}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`${nome}, ${posicao}. Abrir para mover ou encerrar`}
          className={`min-w-0 text-left pl-1 pr-3 py-1.5 rounded-r-xl cursor-pointer hover:bg-surface-2 ${FOCO}`}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {pesca.diarista && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#A855F7] shrink-0" />}
            <span className="truncate max-w-[220px]" title={nome}>{nome}</span>
          </span>
          <span className="flex items-center gap-2 text-xs tabular-nums">
            <span className={semBraco ? "text-[#F59E0B] font-medium" : "font-semibold"} style={semBraco ? undefined : { color: COR_PESCA }}>
              {posicao}
            </span>
            <span className="text-muted">{haQuanto(pesca.inicio)}</span>
          </span>
        </button>
      )}
    </li>
  );
}

/**
 * Mapa da esteira + pescas. A pesca fica num braço e é arrastada entre eles: o próprio mapa é a área de soltar.
 * Soltar na faixa "Pescas" tira a pessoa do braço. Cada passagem fica no log do dia (rastreabilidade).
 */
export function MapaEsteiraComPescas({ esteira, alocacoes, pescas, fanouts, mostrarFanouts, avisosPorBraco, somenteLeitura, onBracoClick, versao, dia, onChanged }) {
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [otimista, setOtimista] = useState({}); // idAlocacao -> chave de destino, enquanto a API responde
  const [movs, setMovs] = useState([]);
  const [verHistorico, setVerHistorico] = useState(false);
  const mapaRef = useRef(null);

  const destinos = useMemo(
    () => [
      { chave: "sem", rotulo: "Sem braço", braco: null, lado: null },
      ...(esteira.bracos || [])
        .filter((b) => b.habilitado)
        .sort((a, b) => a.numero - b.numero || String(a.lado).localeCompare(String(b.lado)))
        .map((b) => ({ chave: `${b.numero}-${b.lado}`, rotulo: `Braço ${b.numero}${b.lado}`, braco: b.numero, lado: b.lado })),
    ],
    [esteira.bracos]
  );

  const colunaDe = useCallback((p) => otimista[p.idAlocacao] ?? chaveDe(p.braco, p.lado), [otimista]);

  // O mapa já mostra a pesca no braço de destino antes de a API responder.
  const pescasNoMapa = useMemo(
    () =>
      pescas.map((p) => {
        const chave = colunaDe(p);
        const d = destinos.find((x) => x.chave === chave);
        return d ? { ...p, braco: d.braco, lado: d.lado } : p;
      }),
    [pescas, colunaDe, destinos]
  );

  useEffect(() => {
    let ativo = true;
    MapaOperacionalAPI.listarMovimentacoesPesca(esteira.idEsteira, { data: dia })
      .then((linhas) => ativo && setMovs(linhas))
      .catch(() => ativo && setMovs([]));
    return () => {
      ativo = false;
    };
  }, [esteira.idEsteira, dia, versao]);

  const eventos = useMemo(() => derivarEventos(movs), [movs]);

  const moverPara = useCallback(
    async (pesca, chaveDestino) => {
      if (colunaDe(pesca) === chaveDestino) return;
      const destino = destinos.find((d) => d.chave === chaveDestino);
      if (!destino) return;
      setOtimista((o) => ({ ...o, [pesca.idAlocacao]: chaveDestino }));
      try {
        await MapaOperacionalAPI.moverAlocacao(esteira.idEsteira, pesca.idAlocacao, { braco: destino.braco, lado: destino.lado });
        toast.success(`${nomeDe(pesca)} → ${destino.rotulo}`);
      } catch (e) {
        toast.error(e.response?.data?.message || "Não foi possível mover a pesca");
      } finally {
        await onChanged?.();
        setOtimista((o) => {
          const { [pesca.idAlocacao]: _descartado, ...resto } = o;
          return resto;
        });
      }
    },
    [destinos, colunaDe, esteira.idEsteira, onChanged]
  );

  const { arrastando, destino, iniciar } = useArrastar({ onSoltar: moverPara, containerRef: mapaRef, desabilitado: somenteLeitura });

  const ordenadas = useMemo(
    () => [...pescasNoMapa].sort((a, b) => (a.braco == null) - (b.braco == null) || (a.braco ?? 0) - (b.braco ?? 0) || String(a.lado).localeCompare(String(b.lado))),
    [pescasNoMapa]
  );
  const semBraco = pescasNoMapa.filter((p) => p.braco == null).length;
  const alvoFaixa = !!arrastando && destino === "sem";
  const destinosModal = destinos.map((d) => ({ chave: d.chave, rotulo: d.rotulo, total: pescasNoMapa.filter((p) => chaveDe(p.braco, p.lado) === d.chave).length }));
  const trilhaDe = (p) => (p.opsId ? movs.filter((m) => m.opsId === p.opsId).sort((a, b) => new Date(b.inicio) - new Date(a.inicio)) : []);

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="titulo-pesca"
        data-destino={somenteLeitura ? undefined : "sem"}
        className={`rounded-xl border p-3 sm:p-4 transition-colors motion-reduce:transition-none ${
          alvoFaixa ? "border-solid bg-[#2563EB]/10" : "border-dashed border-default bg-surface-2/40"
        }`}
        style={alvoFaixa ? { borderColor: COR_PESCA } : undefined}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="min-w-0">
            <h3 id="titulo-pesca" className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: COR_PESCA }} />
              Pescas <span className="text-xs font-medium text-muted tabular-nums">{pescas.length}</span>
              {semBraco > 0 && <span className="text-xs font-medium text-[#F59E0B]">{semBraco} sem braço</span>}
            </h3>
            {!somenteLeitura && (
              <p className="text-xs text-muted mt-0.5">
                {arrastando ? "Solte sobre um braço do mapa. Solte aqui para tirar do braço." : "Arraste uma pesca até um braço do mapa. Toque nela para escolher o braço numa lista."}
              </p>
            )}
          </div>
          {!somenteLeitura && (
            <button type="button" onClick={() => setModalAdicionar(true)} className={`${BTN_SECUNDARIO} h-10`}>
              <Plus size={15} aria-hidden="true" /> Adicionar pesca
            </button>
          )}
        </div>

        {ordenadas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma pesca alocada nesta esteira.</p>
        ) : (
          <ul aria-label="Pescas desta esteira" className="flex flex-wrap gap-2">
            {ordenadas.map((p) => (
              <ChipPesca
                key={p.idAlocacao}
                pesca={p}
                somenteLeitura={somenteLeitura}
                fantasma={arrastando?.item.idAlocacao === p.idAlocacao}
                movendo={!!otimista[p.idAlocacao]}
                onAbrir={() => setAberta(p)}
                onAlca={(ev) => iniciar(ev, p)}
              />
            ))}
          </ul>
        )}
      </section>

      <ConveyorSvg
        esteira={esteira}
        alocacoes={alocacoes}
        pescas={pescasNoMapa}
        arrastando={!!arrastando}
        destinoAtivo={destino}
        scrollRef={mapaRef}
        fanouts={fanouts}
        mostrarFanouts={mostrarFanouts}
        avisosPorBraco={avisosPorBraco}
        onBracoClick={onBracoClick}
        somenteLeitura={somenteLeitura}
      />

      <div className="rounded-xl border border-default">
        <button
          type="button"
          onClick={() => setVerHistorico((v) => !v)}
          aria-expanded={verHistorico}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted hover:text-page cursor-pointer rounded-xl ${FOCO}`}
        >
          <span className="flex items-center gap-2">
            <History size={15} aria-hidden="true" /> Movimentações de pesca do dia
            <span className="text-xs tabular-nums">{eventos.length}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${verHistorico ? "rotate-180" : ""}`} />
        </button>
        {verHistorico && (
          <ol className="divide-y divide-default border-t border-default max-h-72 overflow-y-auto">
            {eventos.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhuma movimentação ainda.</li>}
            {eventos.map((e) => (
              <li key={e.idAlocacao} className="px-4 py-2.5 text-sm flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{e.nome}</span>{" "}
                  <span className="text-muted">
                    {e.de ? `${e.de} → ${e.para}` : `entrou em ${e.para.toLowerCase()}`}
                    {e.registradoPor ? ` · por ${e.registradoPor}` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted tabular-nums shrink-0">{hora(e.inicio)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {arrastando && (
        <div
          aria-hidden="true"
          className="fixed z-[60] pointer-events-none px-3 py-2 rounded-lg border bg-surface text-sm font-medium shadow-xl max-w-[240px] truncate"
          style={{ left: arrastando.x + 12, top: arrastando.y + 12, borderColor: COR_PESCA }}
        >
          {nomeDe(arrastando.item)}
        </div>
      )}

      {modalAdicionar && (
        <AlocarLaborModal esteira={esteira} laborLabel="Pesca" laborValue="PESCA" onClose={() => setModalAdicionar(false)} onAllocated={onChanged} />
      )}

      {aberta && (
        <MoverPescaModal
          esteira={esteira}
          pesca={aberta}
          nome={nomeDe(aberta)}
          destinos={destinosModal}
          trilha={trilhaDe(aberta)}
          onClose={() => setAberta(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
