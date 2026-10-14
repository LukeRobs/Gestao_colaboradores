import { useState } from "react";
import { Check, OctagonAlert, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";
import { FOCO } from "../uiTokens";
import { corDoAviso, descricaoAviso, haQuanto, maisGrave, minutosRestantes } from "./avisosConfig";

/**
 * Lista os avisos ativos (todos veem). Quem opera a Label pode marcar como resolvido.
 * `somenteLeitura` esconde o botão (turno histórico).
 */
export function FaixaAvisos({ avisos, nomesLabor, titulo = "Avisos ativos", somenteLeitura = false, onMudou, acaoExtra = null, rotuloArea = null }) {
  const [encerrando, setEncerrando] = useState(null);
  if (!avisos.length) return null;

  const cor = corDoAviso(maisGrave(avisos));

  async function encerrar(aviso) {
    setEncerrando(aviso.idAviso);
    try {
      await MapaOperacionalAPI.encerrarAviso(aviso.idAviso);
      toast.success("Aviso encerrado");
      await onMudou?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Não foi possível encerrar o aviso");
    } finally {
      setEncerrando(null);
    }
  }

  return (
    <section
      aria-label={titulo}
      role="status"
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: `${cor}59`, background: `${cor}0F` }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold" style={{ color: cor }}>
        <span className="flex items-center gap-2">
          <TriangleAlert size={16} aria-hidden="true" />
          {titulo}
          <span className="tabular-nums font-medium">{avisos.length}</span>
        </span>
        {acaoExtra}
      </div>
      <ul className="divide-y" style={{ borderColor: `${cor}26` }}>
        {[...avisos]
          .sort((a, b) => (b.severidade === "CRITICO") - (a.severidade === "CRITICO") || new Date(b.criadoEm) - new Date(a.criadoEm))
          .map((a) => {
            const Icone = a.severidade === "CRITICO" ? OctagonAlert : TriangleAlert;
            return (
              <li key={a.idAviso} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-t" style={{ borderColor: `${cor}26` }}>
                <span className="flex items-start gap-2.5 min-w-0">
                  <Icone size={15} className="shrink-0 mt-0.5" style={{ color: corDoAviso(a) }} aria-hidden="true" />
                  <span className="min-w-0">
                    {rotuloArea && <span className="text-muted">{rotuloArea(a)} · </span>}
                    <span className="font-medium text-page">{descricaoAviso(a, nomesLabor)}</span>
                    {a.nomePessoa && <span className="text-muted"> · {a.nomePessoa}</span>}
                    <span className="block text-xs text-muted">
                      {a.criadoPorNome ? `${a.criadoPorNome}, ` : ""}
                      {haQuanto(a.criadoEm)} · some em {minutosRestantes(a)} min
                    </span>
                  </span>
                </span>
                {!somenteLeitura && (
                  <button
                    type="button"
                    onClick={() => encerrar(a)}
                    disabled={encerrando === a.idAviso}
                    className={`h-9 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface hover:bg-surface-2 text-xs font-medium text-page transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${FOCO}`}
                  >
                    <Check size={14} aria-hidden="true" /> Resolvido
                  </button>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
