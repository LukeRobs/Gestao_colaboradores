import { useState } from "react";
import { BellRing, Check, Clock, RefreshCw, User } from "lucide-react";
import toast from "react-hot-toast";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";
import { FOCO } from "../uiTokens";
import { DURACAO_PADRAO, descricaoAviso, gravidadeDe, haQuanto, maisGrave, minutosRestantes, motivoDe, rotuloAlvo } from "./avisosConfig";

const BTN_ACAO = `h-10 px-3.5 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${FOCO}`;

/**
 * Lista os avisos ativos (todos veem). Quem opera a Label pode:
 *  - "Ainda acontece": renova o prazo (mesmo alvo e motivo);
 *  - "Resolvido": encerra.
 * `somenteLeitura` esconde os botões. `rotuloArea(aviso)` mostra de onde é o aviso (outras esteiras/docas).
 */
export function FaixaAvisos({ avisos, nomesLabor, titulo = "Avisos ativos", somenteLeitura = false, onMudou, acaoExtra = null, rotuloArea = null }) {
  const [ocupado, setOcupado] = useState(null); // `${idAviso}:encerrar|renovar`
  if (!avisos.length) return null;

  const cor = gravidadeDe(maisGrave(avisos)).cor;

  async function agir(aviso, tipo) {
    setOcupado(`${aviso.idAviso}:${tipo}`);
    try {
      if (tipo === "encerrar") {
        await MapaOperacionalAPI.encerrarAviso(aviso.idAviso);
        toast.success("Aviso encerrado");
      } else {
        await MapaOperacionalAPI.criarAviso({
          alvoTipo: aviso.alvoTipo,
          idEsteira: aviso.idEsteira,
          braco: aviso.braco,
          lado: aviso.lado,
          labor: aviso.labor,
          numeroDoca: aviso.numeroDoca,
          motivo: aviso.motivo,
          severidade: aviso.severidade,
          opsId: aviso.opsId || undefined,
          nomePessoa: aviso.nomePessoa || undefined,
          duracaoMin: DURACAO_PADRAO,
        });
        toast.success(`Aviso renovado por ${DURACAO_PADRAO} min`);
      }
      await onMudou?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Não foi possível atualizar o aviso");
    } finally {
      setOcupado(null);
    }
  }

  const ordenados = [...avisos].sort(
    (a, b) => (b.severidade === "CRITICO") - (a.severidade === "CRITICO") || new Date(b.criadoEm) - new Date(a.criadoEm)
  );

  return (
    <section aria-label={titulo} role="status" className="rounded-2xl border bg-surface overflow-hidden" style={{ borderColor: `${cor}66` }}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: `${cor}1A` }}>
        <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: cor }}>
          <BellRing size={16} aria-hidden="true" />
          {titulo}
          <span className="inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full text-xs tabular-nums text-white" style={{ background: cor }}>
            {avisos.length}
          </span>
        </h2>
        {acaoExtra}
      </div>

      <ul className="divide-y divide-default">
        {ordenados.map((a) => {
          const g = gravidadeDe(a);
          const { Icone } = motivoDe(a.motivo);
          const restante = minutosRestantes(a);
          return (
            <li key={a.idAviso} className="relative flex items-center gap-3 sm:gap-4 pl-5 pr-4 py-3 flex-wrap sm:flex-nowrap">
              <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: g.fundo }} />

              <span
                aria-hidden="true"
                className={`grid place-items-center h-11 w-11 rounded-xl shrink-0 ${a.severidade === "CRITICO" ? "motion-safe:animate-pulse" : ""}`}
                style={{ background: g.fundo, color: g.texto }}
              >
                <Icone size={22} strokeWidth={2.25} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-page leading-snug">
                  {rotuloArea && <span className="font-medium text-muted">{rotuloArea(a)} · </span>}
                  {descricaoAviso(a, nomesLabor).replace(`${rotuloAlvo(a, nomesLabor)}: `, `${rotuloAlvo(a, nomesLabor)} · `)}
                </p>
                <p className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-muted mt-0.5">
                  {a.nomePessoa && (
                    <span className="inline-flex items-center gap-1">
                      <User size={12} aria-hidden="true" /> {a.nomePessoa}
                    </span>
                  )}
                  <span>
                    {a.criadoPorNome ? `${a.criadoPorNome} · ` : ""}
                    {haQuanto(a.criadoEm)}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums" style={{ color: restante <= 5 ? g.cor : undefined }}>
                    <Clock size={12} aria-hidden="true" /> some em {restante} min
                  </span>
                </p>
              </div>

              {!somenteLeitura && (
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => agir(a, "renovar")}
                    disabled={!!ocupado}
                    title={`Ainda acontece: mantém o aviso por mais ${DURACAO_PADRAO} min`}
                    className={`${BTN_ACAO} border-default bg-surface-2 hover:bg-surface-3 text-page`}
                  >
                    <RefreshCw size={15} aria-hidden="true" className={ocupado === `${a.idAviso}:renovar` ? "motion-safe:animate-spin" : ""} />
                    <span className="hidden sm:inline">Ainda acontece</span>
                    <span className="sm:hidden sr-only">Ainda acontece</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => agir(a, "encerrar")}
                    disabled={!!ocupado}
                    className={`${BTN_ACAO} border-[#22C55E]/50 bg-[#22C55E]/12 hover:bg-[#22C55E]/20 text-[#22C55E]`}
                  >
                    <Check size={16} strokeWidth={2.75} aria-hidden="true" /> Resolvido
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
