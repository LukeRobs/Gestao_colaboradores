import { useEffect, useRef, useState } from "react";
import { CircleAlert, MapPinOff, X } from "lucide-react";
import { AbasSegmentadas, Aviso, Esqueleto } from "../../components/mapaOperacional/ui";
import { FOCO, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { PlanejamentoInboundAPI } from "../../services/planejamentoInbound";
import { Campo, Pilula } from "./FilaPecas";
import { PilulaEta, PilulaSituacao } from "./InboundPecas";
import MiniMapaViagem from "./MiniMapaViagem";
import { FAIXAS_SPP, PERFIS_PACOTE, fmtDataHora, fmtDesvio, fmtDuracao, fmtHoraIso, fmtIdade, nomePlacas } from "./inboundUtils";

function Barras({ itens, cor = "#FA4C00", sufixo = "" }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 text-muted">{i.rotulo}</span>
          <div className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${i.valor ? Math.max(3, Math.round((i.valor / max) * 100)) : 0}%`, background: cor }} />
          </div>
          <span className="w-16 text-right tabular-nums font-semibold">{formatNumero(i.valor)}{sufixo}</span>
        </li>
      ))}
    </ul>
  );
}

function Indicador({ rotulo, valor, apoio, cor }) {
  return (
    <div className="rounded-xl border border-default bg-surface-2 p-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</dd>
      {apoio && <p className="text-xs text-muted mt-0.5">{apoio}</p>}
    </div>
  );
}

function Resumo({ v }) {
  const passos = [
    { rotulo: "ETA planejado (destino)", valor: fmtDataHora(v.prazoEta) },
    { rotulo: "ETA real (chegada)", valor: fmtDataHora(v.etaReal) },
    { rotulo: "Fim da descarga", valor: fmtDataHora(v.descarga) },
    { rotulo: "ETA atualizado (Google Maps)", valor: fmtDataHora(v.etaGoogle) },
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Indicador rotulo="Desvio do ETA" valor={fmtDesvio(v.desvioEtaMin)} cor={v.classeEta === "ATRASADA" ? "#FF453A" : v.classeEta === "NO_PRAZO" ? "#22C55E" : undefined} apoio={v.atrasada ? `atrasada há ${fmtDuracao(v.atrasoMin)}` : v.tendeAtrasar ? "tende a atrasar" : undefined} />
        <Indicador rotulo="Pacotes" valor={`${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)}`} apoio={v.pacotesEstimado ? "estimado pela origem" : "informado"} />
        <Indicador rotulo="TOs" valor={formatNumero(v.tos)} apoio={v.tosSaca ? `${formatNumero(v.tosSaca)} sacas` : undefined} />
        <Indicador rotulo="Turno" valor={v.turno || "—"} apoio={v.tempoTransito ? `trânsito ${v.tempoTransito.slice(0, -3)} h` : undefined} />
      </dl>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <dl className="grid grid-cols-2 gap-4 content-start">
          <Campo rotulo="Origem">{v.origem}</Campo>
          <Campo rotulo="Tipo de origem">{v.tipoOrigem}</Campo>
          <Campo rotulo="Solicitação">{v.solicitacao}</Campo>
          <Campo rotulo="Transportadora">{v.transportadora}</Campo>
          <Campo rotulo="Veículo">{v.veiculo}</Campo>
          <Campo rotulo="Placas" mono>{nomePlacas(v.placas)}</Campo>
          <Campo rotulo="Motorista">{v.motorista}</Campo>
          <Campo rotulo="Status no SPX">{v.statusSpx || v.statusPlanilha}</Campo>
        </dl>
        <section aria-label="Horários">
          <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Horários no destino</h3>
          <ul className="space-y-2">
            {passos.map((p) => (
              <li key={p.rotulo} className="flex items-center gap-2 text-sm">
                <span className="text-muted">{p.rotulo}</span>
                <span className="ml-auto tabular-nums font-medium">{p.valor}</span>
              </li>
            ))}
          </ul>
          <h3 className="text-xs uppercase tracking-wide text-muted mt-5 mb-2">Origem</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm"><span className="text-muted">ETA planejado na origem</span><span className="ml-auto tabular-nums font-medium">{fmtDataHora(v.prazoEtaOrigem)}</span></li>
            <li className="flex items-center gap-2 text-sm"><span className="text-muted">CPT planejado</span><span className="ml-auto tabular-nums font-medium">{fmtDataHora(v.prazoCptOrigem)}</span></li>
            <li className="flex items-center gap-2 text-sm"><span className="text-muted">CPT realizado</span><span className="ml-auto tabular-nums font-medium">{fmtDataHora(v.cptRealizado)}</span></li>
            <li className="flex items-center gap-2 text-sm"><span className="text-muted">Status do CPT</span><span className="ml-auto font-medium">{v.statusCpt || "—"}</span></li>
            <li className="flex items-center gap-2 text-sm"><span className="text-muted">Selo liberado no destino</span><span className="ml-auto tabular-nums font-medium">{fmtDataHora(v.liberacaoSeloEm)}</span></li>
          </ul>
        </section>
      </div>

      {v.motivoCancelamento && <Aviso tipo="alerta">Motivo do cancelamento: {v.motivoCancelamento}</Aviso>}
    </div>
  );
}

function Carga({ v }) {
  const bandas = v.spp ? FAIXAS_SPP.map((f, i) => ({ rotulo: f, valor: v.spp.bandas[i] || 0 })) : null;
  const perfil = v.perfil ? PERFIS_PACOTE.map((p) => ({ rotulo: p.rotulo, valor: v.perfil[p.chave] || 0 })) : null;
  const semCarga = !v.pacotesInformado && !(v.spp?.tos > 0);
  const aindaNaoCarregada = v.situacao === "PROGRAMADA";
  return (
    <div className="space-y-6">
      {semCarga && (
        <Aviso tipo="info">
          {aindaNaoCarregada
            ? "A carga desta viagem ainda não foi informada: a origem só registra pacotes e TOs depois de carregar o veículo. O número de pacotes abaixo é uma estimativa pela origem."
            : v.situacao === "CANCELADA" || v.situacao === "NO_SHOW"
              ? "Viagem sem carga: foi cancelada ou o veículo não compareceu."
              : "A planilha não trouxe os dados de carga desta viagem."}
        </Aviso>
      )}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Indicador rotulo="Pacotes" valor={`${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)}`} apoio={v.pacotesEstimado ? "estimado pela mediana da origem" : "informado pela planilha"} />
        <Indicador rotulo="TOs" valor={formatNumero(v.spp?.tos || 0)} />
        <Indicador rotulo="TOs de saca" valor={formatNumero(v.spp?.sacasTos || 0)} />
        <Indicador rotulo="Sacas (pacotes)" valor={formatNumero(v.spp?.sacas || 0)} />
      </dl>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section aria-label="SPP">
          <h3 className="text-xs uppercase tracking-wide text-muted mb-1">TOs por faixa de SPP</h3>
          <p className="text-xs text-muted mb-3">SPP = pacotes por TO, em faixas.</p>
          {bandas && bandas.some((b) => b.valor > 0) ? <Barras itens={bandas} /> : <p className="text-sm text-muted">Sem SPP informado para esta viagem.</p>}
        </section>
        <section aria-label="Perfil de pacote">
          <h3 className="text-xs uppercase tracking-wide text-muted mb-1">Perfil de pacote</h3>
          <p className="text-xs text-muted mb-3">Tamanho dos pacotes (PP, P, M, G…).</p>
          {perfil && perfil.some((b) => b.valor > 0) ? (
            <Barras itens={perfil} cor="#8B5CF6" />
          ) : (
            <p className="text-sm text-muted">Perfil de pacote (PP/P/M/G) indisponível: a planilha não está recebendo esse dado para viagens atuais.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Telemetria({ v }) {
  const t = v.telemetria || [];
  const a = t[0];
  if (!a) {
    return (
      <div className="flex flex-col items-center text-center gap-2 px-6 py-12 text-muted">
        <MapPinOff size={28} aria-hidden="true" />
        <p className="font-medium text-page">Sem telemetria para esta viagem</p>
        <p className="text-sm max-w-sm">A planilha ainda não recebeu posição deste veículo. Isso é comum em viagens que ainda não saíram da origem.</p>
      </div>
    );
  }
  const idade = v.leituraIdadeMin; // calculado no servidor (a tela não lê o relógio ao desenhar)
  return (
    <div className="space-y-5">
      {a.ocorrencia && (
        <div role="alert" className="flex gap-2 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-3 py-2.5 text-sm text-[#F59E0B]">
          <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span><b>{a.ocorrencia}</b>{a.descricaoOcorrencia ? ` — ${a.descricaoOcorrencia}` : ""}</span>
        </div>
      )}
      <MiniMapaViagem viagem={v} />
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Indicador rotulo="Situação" valor={a.status || "—"} apoio={`ignição ${a.ignicao ? a.ignicao.toLowerCase() : "—"}`} />
        <Indicador rotulo="Velocidade" valor={`${a.velocidadeKmh || 0} km/h`} />
        <Indicador rotulo="Última leitura" valor={fmtIdade(idade)} apoio={fmtDataHora(a.em)} cor={idade != null && idade > 180 ? "#F59E0B" : undefined} />
        <Indicador rotulo="ETA Google Maps" valor={fmtHoraIso(a.etaGoogle)} apoio={a.etaGoogle ? fmtDataHora(a.etaGoogle) : "não informado"} />
      </dl>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Campo rotulo="Localização">{a.local}</Campo>
        <Campo rotulo="Progressão" mono>{a.progressaoPct ? `${a.progressaoPct}%` : null}</Campo>
        <Campo rotulo="Distância faltante" mono>{a.distanciaFaltanteKm ? `${formatNumero(a.distanciaFaltanteKm)} km` : null}</Campo>
        <Campo rotulo="Paradas">{a.statusParadas}</Campo>
        <Campo rotulo="Parada atual" mono>{a.paradaAtual}</Campo>
        <Campo rotulo="Paradas totais" mono>{a.paradasTotais}</Campo>
        <Campo rotulo="Paradas programadas" mono>{a.paradasProgramadas}</Campo>
        <Campo rotulo="Coordenadas" mono>{`${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`}</Campo>
      </dl>
      <section aria-label="Leituras recentes">
        <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Leituras recentes ({t.length})</h3>
        <div className="overflow-auto max-h-56 rounded-xl border border-default scroll-tema">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2 text-muted uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2">Quando</th>
                <th className="text-left font-medium px-3 py-2">Situação</th>
                <th className="text-right font-medium px-3 py-2">km/h</th>
                <th className="text-left font-medium px-3 py-2">Local</th>
                <th className="text-left font-medium px-3 py-2">Ocorrência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {t.slice(0, 15).map((o) => (
                <tr key={o.em + o.lat + o.lng}>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDataHora(o.em)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.status || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{o.velocidadeKmh || 0}</td>
                  <td className="px-3 py-2">{o.local || "—"}</td>
                  <td className="px-3 py-2 text-muted">{o.ocorrencia || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Modal com tudo de uma viagem (LH): resumo, carga (pacotes, SPP, perfil) e telemetria. Carrega o detalhe ao abrir. */
export default function ViagemInboundModal({ lh, onClose }) {
  const [v, setV] = useState(null);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState("RESUMO");
  const fechar = useRef(null);

  useEffect(() => {
    let vivo = true;
    PlanejamentoInboundAPI.viagem(lh)
      .then((d) => vivo && setV(d))
      .catch((e) => vivo && setErro(e.response?.status === 404 ? "Viagem não encontrada na planilha." : "Não foi possível carregar a viagem."));
    return () => {
      vivo = false;
    };
  }, [lh]);

  useEffect(() => {
    fechar.current?.focus();
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="vi-titulo" className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-surface border border-default shadow-2xl scroll-tema" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-surface border-b border-default">
          <div className="flex items-start gap-3 px-6 pt-4 pb-3">
            <div className="min-w-0">
              <h2 id="vi-titulo" className="font-semibold tabular-nums text-lg text-[#FA4C00] truncate">{lh}</h2>
              <p className="text-sm text-muted mt-0.5">{v ? [v.origem, v.veiculo, nomePlacas(v.placas) !== "—" ? nomePlacas(v.placas) : null].filter(Boolean).join(" · ") : "Carregando…"}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {v && <PilulaSituacao situacao={v.situacao} />}
              {v?.classeEta && <PilulaEta classe={v.classeEta} />}
              {v?.atrasada && <Pilula cor="#FF453A" icone={<CircleAlert size={12} aria-hidden="true" />}>Atrasada {fmtDuracao(v.atrasoMin)}</Pilula>}
              <button ref={fechar} type="button" onClick={onClose} aria-label="Fechar detalhe" className={`h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer ${FOCO}`}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="px-6 pb-3 max-w-md">
            <AbasSegmentadas
              rotulo="Seção da viagem"
              valor={aba}
              onChange={setAba}
              opcoes={[
                { valor: "RESUMO", rotulo: "Resumo" },
                { valor: "CARGA", rotulo: "Carga" },
                { valor: "TELEMETRIA", rotulo: v?.telemetria?.length ? `Telemetria (${v.telemetria.length})` : "Telemetria" },
              ]}
            />
          </div>
        </div>

        <div className="p-6">
          {erro ? (
            <Aviso tipo="erro">{erro}</Aviso>
          ) : !v ? (
            <div aria-busy="true" className="space-y-3">
              <Esqueleto className="h-20" />
              <Esqueleto className="h-48" />
            </div>
          ) : aba === "RESUMO" ? (
            <Resumo v={v} />
          ) : aba === "CARGA" ? (
            <Carga v={v} />
          ) : (
            <Telemetria v={v} />
          )}
        </div>
      </div>
    </div>
  );
}
