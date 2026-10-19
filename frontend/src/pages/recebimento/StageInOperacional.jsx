import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Layers, Maximize2, Minimize2, Zap } from "lucide-react";
import { BTN_SECUNDARIO, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { EstadoVazio } from "../../components/mapaOperacional/ui";
import { LinhaSincronizacao, Pilula } from "./FilaPecas";
import { corAging, corOcupacao, fmtDur, resumoZonaOperacional, zonaCurta } from "./stageInUtils";

// Visão Operacional (para a TV do galpão): uma ficha por zona com os números do turno e a fila FIFO das ruas mais antigas.

function Metrica({ rotulo, valor, cor }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-3 text-center">
      <p className="text-xl font-semibold tabular-nums leading-none" style={cor ? { color: cor } : undefined}>{valor}</p>
      <p className="mt-1.5 text-[11px] text-muted">{rotulo}</p>
    </div>
  );
}

function FichaZona({ z, cor, indice }) {
  const corOcup = corOcupacao(z.ocupacao);
  const destaque = z.critica ? "border-[#FF453A]/60 shadow-[0_0_0_1px_rgba(255,69,58,0.25)]" : z.alerta ? "border-[#F59E0B]/50" : "border-default";
  return (
    <article aria-label={`Zona ${zonaCurta(z.nome)}`} className={`anim-in rounded-2xl border bg-surface overflow-hidden flex flex-col ${destaque}`} style={{ "--i": indice }}>
      <header className="flex items-center gap-3 px-5 py-4 border-b border-default" style={{ background: `${cor}14` }}>
        <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0" style={{ background: cor }} />
        <h3 className="text-base font-semibold truncate" title={z.nome}>{zonaCurta(z.nome)}</h3>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {z.critica && <Pilula cor="#FF453A">Crítico</Pilula>}
          {z.alerta && <Pilula cor="#F59E0B">Atenção</Pilula>}
          <span className="text-xs text-muted tabular-nums">{z.ruasAtivas} {z.ruasAtivas === 1 ? "rua" : "ruas"}</span>
        </span>
      </header>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Metrica rotulo="TOs" valor={formatNumero(z.tos)} cor={cor} />
          <Metrica rotulo="Pacotes" valor={z.pacotes > 0 ? formatNumero(z.pacotes) : "—"} />
          <Metrica rotulo="SPP" valor={z.spp ?? "—"} />
          <Metrica rotulo="Aging médio" valor={z.agingMedio ? fmtDur(z.agingMedio) : "—"} cor={z.agingMedio ? corAging(z.agingMedio) : undefined} />
          <Metrica rotulo="Pico de aging" valor={z.pico ? fmtDur(z.pico) : "—"} cor={z.pico ? corAging(z.pico) : undefined} />
          <Metrica rotulo="Ocupação" valor={`${z.ocupacao.toFixed(0)}%`} cor={corOcup} />
        </div>

        <div role="img" aria-label={`Ocupação da zona: ${z.ocupacao.toFixed(0)}%`} className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(z.ocupacao, 100)}%`, background: corOcup }} />
        </div>

        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            <Zap size={13} aria-hidden="true" className="text-[#FA4C00]" />
            FIFO · próximas ruas
          </h4>
          {z.fifo.length === 0 ? (
            <p className="text-sm text-muted py-2">Nenhuma rua com aging</p>
          ) : (
            <ol className="space-y-1.5">
              {z.fifo.map((r, i) => (
                <li key={r.nome} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2">
                  <span aria-hidden="true" className="grid place-items-center w-6 h-6 rounded-lg bg-surface text-xs font-semibold text-muted tabular-nums shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate" title={r.nome}>{r.nome}</span>
                      {r.area && <Pilula cor={r.area.cor}>{r.area.rotulo}</Pilula>}
                    </p>
                    <p className="text-[11px] text-muted tabular-nums truncate">
                      <b className="text-page">{r.tos}</b> TOs · <b className="text-page">{r.pacotes != null ? formatNumero(r.pacotes) : "—"}</b> pcts · SPP <b className="text-page">{r.spp != null ? Math.round(r.spp) : "—"}</b> · cap <b className="text-page">{r.capacidade}</b> ·{" "}
                      <b style={{ color: corOcupacao(r.ocupacao) }}>{r.ocupacao.toFixed(0)}%</b>
                    </p>
                  </div>
                  <Pilula cor={corAging(r.aging)} icone={<Clock size={11} aria-hidden="true" />}>{fmtDur(r.aging)}</Pilula>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
}

/** Painel Operacional: toolbar (sincronização + tela cheia) e a grade de fichas por zona, da mais crítica para a menos. */
export default function StageInOperacional({ ruas, cores, relatorio, sincronizacao }) {
  const raiz = useRef(null);
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    const aoMudar = () => setCheia(document.fullscreenElement === raiz.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else raiz.current?.requestFullscreen?.();
  };

  const zonas = useMemo(() => {
    const nomes = [...new Set(ruas.filter((r) => r.tos > 0).map((r) => r.zona))];
    return nomes.map((n) => resumoZonaOperacional(n, ruas, relatorio)).sort((a, b) => b.pico - a.pico);
  }, [ruas, relatorio]);

  return (
    <div ref={raiz} className={`space-y-4 bg-page ${cheia ? "p-6 overflow-auto h-screen" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <LinhaSincronizacao sincronizacao={sincronizacao} />
        {document.fullscreenEnabled && (
          <button type="button" onClick={alternarTelaCheia} className={BTN_SECUNDARIO}>
            {cheia ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            {cheia ? "Sair da tela cheia" : "Tela cheia"}
          </button>
        )}
      </div>

      {zonas.length === 0 ? (
        <div className="rounded-2xl border border-default bg-surface">
          <EstadoVazio icone={<Layers size={30} aria-hidden="true" />} titulo="Nenhuma zona ativa" descricao="Quando houver TOs alocadas nas ruas do staging, cada zona aparece aqui com o seu FIFO." />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
          {zonas.map((z, i) => (
            <FichaZona key={z.nome} z={z} cor={cores[z.nome]} indice={i} />
          ))}
        </div>
      )}
    </div>
  );
}
