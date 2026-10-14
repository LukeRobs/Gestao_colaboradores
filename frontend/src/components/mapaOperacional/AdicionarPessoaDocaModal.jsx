import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { DocasAPI } from "../../services/docas";
import { TimesAPI } from "../../services/times";
import { BuscaColaborador, Modal } from "./ui";
import { BTN_PRIMARIO, FOCO, FUNCOES_DOCA } from "./uiTokens";

/**
 * Adiciona uma pessoa direto na doca.
 * - Doca com time: ela entra no time (fica no cadastro de Equipes).
 * - Doca com pessoa avulsa: o sistema cria um time com as duas e passa a doca para ele.
 * Fica aberto depois de cada adição para montar a equipe em sequência.
 */
export function AdicionarPessoaDocaModal({ doca, onClose, onAdicionada }) {
  const operacao = doca.operacao;
  const time = doca.alocacao?.time || null;
  const avulso = !time ? doca.alocacao?.colaborador || null : null;
  const fifo = time?.tipo === "FIFO";
  const funcoes = FUNCOES_DOCA[operacao] || [];

  const [funcao, setFuncao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [chaveBusca, setChaveBusca] = useState(0);
  const [adicionados, setAdicionados] = useState(0);
  const [ocupantes, setOcupantes] = useState(() => new Map()); // opsId -> { idTime, nome, turno }
  const faltaFuncao = !fifo && !funcao;

  // Quem já está em algum time aparece travado com o motivo (o servidor valida de novo).
  useEffect(() => {
    let ativo = true;
    TimesAPI.listar({ operacao })
      .then((times) => {
        if (!ativo) return;
        const mapa = new Map();
        times.forEach((t) => t.integrantes.forEach((i) => mapa.set(i.colaborador.opsId, { idTime: t.idTime, nome: t.nome, turno: t.turno })));
        setOcupantes(mapa);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [operacao, adicionados]);

  const indisponivel = (c) => {
    if (avulso && c.opsId === avulso.opsId) return "Já está nesta doca";
    const atual = ocupantes.get(c.opsId);
    if (!atual) return null;
    return atual.idTime === time?.idTime ? "Já está neste time" : `Já está no time "${atual.nome}" (${atual.turno})`;
  };

  async function adicionar(colaborador) {
    if (faltaFuncao) {
      toast.error("Escolha a função antes de adicionar");
      return;
    }
    setSalvando(true);
    try {
      await DocasAPI.adicionarPessoa(doca.numero, { opsId: colaborador.opsId, funcao: fifo ? undefined : funcao });
      toast.success(time ? `${colaborador.nomeCompleto} entrou no time` : `Time criado com ${colaborador.nomeCompleto}`);
      setAdicionados((n) => n + 1);
      setChaveBusca((n) => n + 1);
      await onAdicionada?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao adicionar pessoa");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      kicker={`Doca ${doca.numero}`}
      titulo="Adicionar pessoa"
      subtitulo={time ? `Entra no time ${time.nome}` : "Cria um time com quem já está na doca e a nova pessoa"}
      onClose={onClose}
      bloqueado={salvando}
      largura="max-w-lg"
    >
      {avulso && (
        <p className="text-xs text-muted rounded-xl border border-default bg-surface-2 px-3 py-2.5">
          Hoje só {avulso.nomeCompleto} está nesta doca. Ao adicionar, o sistema cria um time com as duas pessoas e a doca passa a ser desse time (ele aparece em Equipes).
        </p>
      )}

      {!fifo && (
        <div className="space-y-1.5">
          <p id="funcao-pessoa-doca" className="text-xs font-medium text-muted">
            Função na doca
          </p>
          <div role="group" aria-labelledby="funcao-pessoa-doca" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
        contexto={operacao === "INBOUND" ? "RECEBIMENTO" : "EXPEDICAO"}
        turno={time?.turno}
        onSelecionar={adicionar}
        desabilitado={salvando || faltaFuncao}
        indisponivel={indisponivel}
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted tabular-nums" aria-live="polite">
          {adicionados > 0 ? `${adicionados} ${adicionados === 1 ? "adicionada" : "adicionadas"} agora` : ""}
        </p>
        <button type="button" onClick={onClose} className={BTN_PRIMARIO}>
          Concluir
        </button>
      </div>
    </Modal>
  );
}
