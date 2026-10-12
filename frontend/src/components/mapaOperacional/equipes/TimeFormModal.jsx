import { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { TimesAPI } from "../../../services/times";
import { AbasSegmentadas, Modal } from "../ui";
import { BTN_PRIMARIO, BTN_SECUNDARIO, INPUT } from "../uiTokens";

const NOME_OPERACAO = { INBOUND: "Recebimento", OUTBOUND: "Expedição" };
const OPERACOES = Object.entries(NOME_OPERACAO).map(([valor, rotulo]) => ({ valor, rotulo }));
const TURNOS = ["T1", "T2", "T3"].map((t) => ({ valor: t, rotulo: t }));
const TIPOS = [
  { valor: "OPERACIONAL", rotulo: "Operacional" },
  { valor: "FIFO", rotulo: "FIFO" },
];

function Campo({ id, rotulo, ajuda, erro, children }) {
  return (
    <div className="space-y-1.5">
      {id ? (
        <label htmlFor={id} className="text-xs font-medium text-muted block">
          {rotulo}
        </label>
      ) : (
        <p className="text-xs font-medium text-muted">{rotulo}</p>
      )}
      {children}
      {erro ? (
        <p role="alert" className="text-xs text-[#FF453A]">
          {erro}
        </p>
      ) : (
        ajuda && <p className="text-xs text-muted">{ajuda}</p>
      )}
    </div>
  );
}

/** Criar ou editar um time. Na criação escolhe-se a operação; na edição ela é fixa. */
export function TimeFormModal({ time, operacaoInicial, turnoInicial, onClose, onSalvo }) {
  const editando = !!time;
  const [operacao, setOperacao] = useState(time?.operacao || operacaoInicial || "INBOUND");
  const [nome, setNome] = useState(time?.nome || "");
  const [tipo, setTipo] = useState(time?.tipo || "OPERACIONAL");
  const [turno, setTurno] = useState(time?.turno || turnoInicial || "T1");
  const [salvando, setSalvando] = useState(false);
  const [erroNome, setErroNome] = useState("");

  const aceitaFifo = operacao === "INBOUND";
  const tipoTravado = editando && time.integrantes.length > 0;
  const tipoFinal = aceitaFifo ? tipo : "OPERACIONAL";

  async function salvar(e) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErroNome("Informe o nome do time.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await TimesAPI.atualizar(time.idTime, { nome: nomeLimpo, turno, ...(tipoFinal !== time.tipo ? { tipo: tipoFinal } : {}) });
        toast.success("Time atualizado");
      } else {
        await TimesAPI.criar({ nome: nomeLimpo, operacao, tipo: tipoFinal, turno });
        toast.success("Time criado");
      }
      onSalvo();
      onClose();
    } catch (err) {
      const mensagem = err.response?.data?.message || "Erro ao salvar time";
      if (/nome/i.test(mensagem)) setErroNome(mensagem);
      else toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      kicker={editando ? NOME_OPERACAO[time.operacao] : "Equipes"}
      titulo={editando ? "Editar time" : "Novo time"}
      onClose={onClose}
      bloqueado={salvando}
    >
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {!editando && (
          <Campo rotulo="Operação">
            <AbasSegmentadas rotulo="Operação do time" opcoes={OPERACOES} valor={operacao} onChange={setOperacao} />
          </Campo>
        )}

        <Campo id="time-nome" rotulo="Nome do time" erro={erroNome}>
          <input
            id="time-nome"
            type="text"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErroNome("");
            }}
            placeholder="Ex.: Time 7 IN"
            autoFocus
            autoComplete="off"
            aria-invalid={!!erroNome}
            className={`${INPUT} ${erroNome ? "border-[#FF453A]" : ""}`}
          />
        </Campo>

        <Campo rotulo="Turno">
          <AbasSegmentadas rotulo="Turno do time" opcoes={TURNOS} valor={turno} onChange={setTurno} />
        </Campo>

        {aceitaFifo && (
          <Campo
            rotulo="Tipo"
            ajuda={tipoTravado ? "Remova os integrantes para trocar o tipo do time." : "FIFO não tem função fixa por integrante."}
          >
            {tipoTravado ? (
              <p className={`${INPUT} flex items-center text-muted`}>{TIPOS.find((t) => t.valor === tipo)?.rotulo}</p>
            ) : (
              <AbasSegmentadas rotulo="Tipo do time" opcoes={TIPOS} valor={tipo} onChange={setTipo} />
            )}
          </Campo>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={salvando} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={BTN_PRIMARIO}>
            {salvando && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar time"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
