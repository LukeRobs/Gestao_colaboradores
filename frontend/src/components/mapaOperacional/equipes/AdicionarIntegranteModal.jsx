import { useState } from "react";
import toast from "react-hot-toast";
import { TimesAPI } from "../../../services/times";
import { BuscaColaborador, Modal } from "../ui";
import { BTN_PRIMARIO, FOCO, FUNCOES_DOCA } from "../uiTokens";

/**
 * Adiciona gente a um time. Fica aberto depois de cada adição (a busca recomeça limpa) para
 * montar o time em sequência; quem já está em algum time aparece travado com o motivo.
 */
export function AdicionarIntegranteModal({ time, ocupantes, onClose, onAtualizado }) {
  const fifo = time.tipo === "FIFO";
  const funcoes = FUNCOES_DOCA[time.operacao] || [];
  const [funcao, setFuncao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [chaveBusca, setChaveBusca] = useState(0);
  const [adicionados, setAdicionados] = useState(0);
  const faltaFuncao = !fifo && !funcao;

  const indisponivel = (c) => {
    const atual = ocupantes.get(c.opsId);
    if (!atual) return null;
    return atual.idTime === time.idTime ? "Já está neste time" : `Já está no time "${atual.nome}" (${atual.turno})`;
  };

  async function adicionar(colaborador) {
    if (faltaFuncao) {
      toast.error("Escolha a função antes de adicionar");
      return;
    }
    setSalvando(true);
    try {
      await TimesAPI.adicionarIntegrante(time.idTime, { opsId: colaborador.opsId, funcao: fifo ? undefined : funcao });
      toast.success(`${colaborador.nomeCompleto} adicionado ao time`);
      setAdicionados((n) => n + 1);
      setChaveBusca((n) => n + 1);
      onAtualizado();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao adicionar integrante");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      kicker={time.nome}
      titulo="Adicionar colaborador"
      subtitulo={`Turno ${time.turno}${fifo ? " · FIFO (sem função fixa)" : ""}`}
      onClose={onClose}
      bloqueado={salvando}
      largura="max-w-lg"
    >
      {!fifo && (
        <div className="space-y-1.5">
          <p id="funcao-integrante" className="text-xs font-medium text-muted">
            Função na doca
          </p>
          <div role="group" aria-labelledby="funcao-integrante" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {funcoes.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={funcao === f.value}
                onClick={() => setFuncao(f.value)}
                className={`h-11 rounded-xl text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
                  funcao === f.value ? "bg-[#FA4C00] text-white" : "bg-surface-2 text-muted hover:text-page border border-default"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {faltaFuncao && <p className="text-xs text-muted">Escolha a função e depois busque a pessoa.</p>}
        </div>
      )}

      <BuscaColaborador
        key={chaveBusca}
        contexto={time.operacao === "INBOUND" ? "RECEBIMENTO" : "EXPEDICAO"}
        turno={time.turno}
        onSelecionar={adicionar}
        desabilitado={salvando || faltaFuncao}
        indisponivel={indisponivel}
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted tabular-nums" aria-live="polite">
          {adicionados > 0 ? `${adicionados} ${adicionados === 1 ? "adicionado" : "adicionados"} agora · ` : ""}
          {time.integrantes.length} {time.integrantes.length === 1 ? "pessoa" : "pessoas"} no time
        </p>
        <button type="button" onClick={onClose} className={BTN_PRIMARIO}>
          Concluir
        </button>
      </div>
    </Modal>
  );
}
