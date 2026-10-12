import { useState } from "react";
import { Pencil, Plus, Trash2, Truck, UserX, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { TimesAPI } from "../../../services/times";
import { BTN_SECUNDARIO, FOCO, FUNCOES_DOCA } from "../uiTokens";

const BTN_ICONE = `h-10 w-10 grid place-items-center shrink-0 rounded-lg text-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${FOCO}`;

function iniciais(nome = "") {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function StatusDoca({ docaAtual }) {
  if (docaAtual != null) {
    return (
      <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium bg-[#FF453A]/10 text-[#FF453A]">
        <Truck size={12} aria-hidden="true" /> Na Doca {docaAtual}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium bg-[#22C55E]/10 text-[#22C55E]">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" /> Livre
    </span>
  );
}

export function TimeCard({ time, onEditar, onExcluir, onAdicionar, onAtualizado }) {
  const [pendente, setPendente] = useState(null); // opsId com ação em andamento
  const fifo = time.tipo === "FIFO";
  const funcoes = FUNCOES_DOCA[time.operacao] || [];
  const ordem = Object.fromEntries(funcoes.map((f, i) => [f.value, i]));
  const integrantes = [...time.integrantes].sort(
    (a, b) => (ordem[a.funcao] ?? 99) - (ordem[b.funcao] ?? 99) || a.colaborador.nomeCompleto.localeCompare(b.colaborador.nomeCompleto)
  );
  const emDoca = time.docaAtual != null;

  async function trocarFuncao(opsId, funcao) {
    setPendente(opsId);
    try {
      await TimesAPI.atualizarIntegrante(time.idTime, opsId, { funcao });
      onAtualizado();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao trocar função");
    } finally {
      setPendente(null);
    }
  }

  async function remover(integrante) {
    const { opsId, nomeCompleto } = integrante.colaborador;
    const funcao = integrante.funcao;
    setPendente(opsId);
    try {
      await TimesAPI.removerIntegrante(time.idTime, opsId);
      onAtualizado();
      toast(
        (t) => (
          <span className="flex items-center gap-3 text-sm">
            {nomeCompleto.split(" ")[0]} removido
            <button
              type="button"
              className="font-semibold text-[#FA4C00] cursor-pointer"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await TimesAPI.adicionarIntegrante(time.idTime, { opsId, funcao: funcao || undefined });
                  onAtualizado();
                } catch (e) {
                  toast.error(e.response?.data?.message || "Não foi possível desfazer");
                }
              }}
            >
              Desfazer
            </button>
          </span>
        ),
        { duration: 6000 }
      );
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao remover integrante");
    } finally {
      setPendente(null);
    }
  }

  return (
    <article aria-label={`Time ${time.nome}`} className="bg-surface rounded-2xl border border-default flex flex-col overflow-hidden">
      <header className="flex items-start gap-3 p-4">
        <div aria-hidden="true" className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center shrink-0 text-muted">
          <Users size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate" title={time.nome}>
            {time.nome}
          </h3>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 mt-1">
            <StatusDoca docaAtual={time.docaAtual} />
            <span className="text-xs text-muted tabular-nums">
              {integrantes.length} {integrantes.length === 1 ? "pessoa" : "pessoas"}
              {fifo && " · FIFO"}
            </span>
          </div>
        </div>
        <div className="flex items-center -mr-2 -mt-1">
          <button type="button" onClick={onEditar} aria-label={`Editar ${time.nome}`} title="Editar time" className={`${BTN_ICONE} hover:text-page hover:bg-surface-2`}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onExcluir}
            disabled={emDoca}
            aria-label={`Excluir ${time.nome}`}
            title={emDoca ? `Libere a Doca ${time.docaAtual} para poder excluir` : "Excluir time"}
            className={`${BTN_ICONE} hover:text-[#FF453A] hover:bg-[#FF453A]/10`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      {integrantes.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted border-t border-default">
          <UserX size={20} aria-hidden="true" />
          <p className="text-sm">Ninguém neste time ainda.</p>
        </div>
      ) : (
        <ul className="border-t border-default divide-y divide-default">
          {integrantes.map((i) => {
            const { opsId, nomeCompleto } = i.colaborador;
            const ocupado = pendente === opsId;
            return (
              <li key={opsId} className={`flex items-center gap-3 px-4 py-2.5 transition-opacity ${ocupado ? "opacity-50" : ""}`}>
                <span aria-hidden="true" className="h-8 w-8 rounded-full bg-surface-2 grid place-items-center text-[11px] font-semibold text-muted shrink-0">
                  {iniciais(nomeCompleto)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" title={nomeCompleto}>
                    {nomeCompleto}
                  </p>
                  <p className="text-xs text-muted">{opsId}</p>
                </div>
                {!fifo && (
                  <select
                    value={i.funcao || ""}
                    onChange={(e) => trocarFuncao(opsId, e.target.value)}
                    disabled={ocupado}
                    aria-label={`Função de ${nomeCompleto}`}
                    className={`h-10 w-[7.5rem] px-2 bg-surface-2 border border-default rounded-lg text-sm cursor-pointer ${FOCO}`}
                  >
                    {funcoes.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => remover(i)}
                  disabled={ocupado}
                  aria-label={`Remover ${nomeCompleto} do time`}
                  title="Remover do time"
                  className={`${BTN_ICONE} -mr-2 hover:text-[#FF453A] hover:bg-[#FF453A]/10`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="p-3 border-t border-default mt-auto">
        <button type="button" onClick={onAdicionar} className={`${BTN_SECUNDARIO} w-full text-[#FA4C00]`}>
          <Plus size={15} aria-hidden="true" /> Adicionar colaborador
        </button>
      </div>
    </article>
  );
}
