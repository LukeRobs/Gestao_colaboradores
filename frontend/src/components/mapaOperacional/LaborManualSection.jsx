import { useState } from "react";
import { Plus, TriangleAlert, X } from "lucide-react";
import toast from "react-hot-toast";
import { AlocarLaborModal } from "./AlocarLaborModal";
import { AvisoBadge } from "./avisos/AvisoBadge";
import { FOCO, LABORS_MANUAIS } from "./uiTokens";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

function Pessoa({ alocacao, somenteLeitura, encerrando, comAviso = false, onEncerrar }) {
  const nome = alocacao.diarista ? "Diarista" : alocacao.colaborador?.nomeCompleto || alocacao.opsId || "—";
  return (
    <li
      className={`inline-flex items-center gap-2 h-9 sm:h-8 rounded-lg bg-surface-2 text-sm ${somenteLeitura ? "px-3" : "pl-3 pr-1"} ${
        encerrando ? "opacity-50" : ""
      }`}
    >
      {alocacao.diarista && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#A855F7] shrink-0" />}
      <span className="truncate max-w-[220px]">{nome}</span>
      {comAviso && <TriangleAlert size={14} className="shrink-0 text-[#F59E0B]" aria-label="Tem aviso ativo" />}
      {!somenteLeitura && (
        <button
          type="button"
          onClick={onEncerrar}
          disabled={encerrando}
          aria-label={`Encerrar alocação de ${nome}`}
          title="Encerrar alocação"
          className={`h-8 w-8 sm:h-6 sm:w-6 grid place-items-center rounded-md text-muted hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors cursor-pointer disabled:cursor-wait ${FOCO}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/**
 * `agendamento` ({ turno, data }): turno que ainda não começou. `alocacoes` passa a ser a lista de
 * pré-alocações (idAlocacao = id da pré-alocação) e o "+" pré-aloca em vez de alocar agora.
 */
export function LaborManualSection({ esteira, alocacoes, somenteLeitura, onAllocated, agendamento = null, avisos = [], onSinalizar = null }) {
  const [modalLabor, setModalLabor] = useState(null); // { value, label }
  const [encerrando, setEncerrando] = useState(null);

  async function encerrar(idAlocacao) {
    setEncerrando(idAlocacao);
    try {
      if (agendamento) {
        await MapaOperacionalAPI.removerAgendada(idAlocacao);
        toast.success("Pré-alocação removida");
      } else {
        await MapaOperacionalAPI.encerrarAlocacao(esteira.idEsteira, idAlocacao);
        toast.success("Alocação encerrada");
      }
      onAllocated?.();
    } catch (e) {
      toast.error(e.response?.data?.message || (agendamento ? "Erro ao remover pré-alocação" : "Erro ao encerrar alocação"));
    } finally {
      setEncerrando(null);
    }
  }

  return (
    <section aria-labelledby="titulo-manuais" className="bg-surface rounded-2xl border border-default">
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-6 py-4 border-b border-default">
        <h2 id="titulo-manuais" className="text-base font-semibold">
          {agendamento ? `Pré-alocações do ${agendamento.turno}` : "Alocações manuais"}
        </h2>
        <p className="text-xs text-muted tabular-nums">{alocacoes.length} {alocacoes.length === 1 ? "pessoa" : "pessoas"}</p>
      </div>

      <ul className="divide-y divide-default">
        {/* Pesca tem quadro próprio (PescaKanban), com posição por braço */}
        {LABORS_MANUAIS.filter((labor) => labor.value !== "PESCA").map((labor) => {
          const pessoas = alocacoes.filter((a) => a.labor === labor.value);
          const avisosDaFuncao = avisos.filter((a) => a.alvoTipo === "FUNCAO" && a.labor === labor.value);
          return (
            <li key={labor.value} className="flex items-start gap-3 sm:gap-6 px-5 sm:px-6 py-3.5">
              <div className="w-32 sm:w-44 shrink-0 pt-1">
                <p className="text-sm font-medium">{labor.label}</p>
                {pessoas.length > 0 && <p className="text-xs text-muted tabular-nums">{pessoas.length}</p>}
                {avisosDaFuncao.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {avisosDaFuncao.map((a) => (
                      <AvisoBadge key={a.idAviso} aviso={a} />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                {pessoas.length === 0 ? (
                  <p className="text-sm text-muted pt-0.5">{agendamento ? "Ninguém pré-alocado" : "Ninguém alocado"}</p>
                ) : (
                  <ul aria-label={`Alocados em ${labor.label}`} className="flex flex-wrap gap-2">
                    {pessoas.map((p) => (
                      <Pessoa
                        key={p.idAlocacao}
                        alocacao={p}
                        somenteLeitura={somenteLeitura}
                        encerrando={encerrando === p.idAlocacao}
                        comAviso={avisos.some((a) => a.opsId && a.opsId === p.opsId)}
                        onEncerrar={() => encerrar(p.idAlocacao)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {!somenteLeitura && onSinalizar && !agendamento && (
                <button
                  type="button"
                  onClick={() => onSinalizar(labor)}
                  aria-label={`Sinalizar ocorrência em ${labor.label}`}
                  title={`Sinalizar ocorrência em ${labor.label}`}
                  className={`h-11 w-11 sm:h-10 sm:w-10 shrink-0 grid place-items-center rounded-xl border border-default bg-surface-2 text-muted hover:text-white hover:bg-[#F59E0B] hover:border-[#F59E0B] transition-colors cursor-pointer ${FOCO}`}
                >
                  <TriangleAlert size={16} aria-hidden="true" />
                </button>
              )}

              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => setModalLabor(labor)}
                  aria-label={`Alocar em ${labor.label}`}
                  title={`Alocar em ${labor.label}`}
                  className={`h-11 w-11 sm:h-10 sm:w-10 shrink-0 grid place-items-center rounded-xl border border-default bg-surface-2 text-muted hover:text-white hover:bg-[#FA4C00] hover:border-[#FA4C00] transition-colors cursor-pointer ${FOCO}`}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {modalLabor && (
        <AlocarLaborModal
          esteira={esteira}
          laborLabel={modalLabor.label}
          laborValue={modalLabor.value}
          agendar={agendamento}
          onClose={() => setModalLabor(null)}
          onAllocated={onAllocated}
        />
      )}
    </section>
  );
}
