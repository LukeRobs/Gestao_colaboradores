import { useEffect, useState } from "react";
import { ArrowLeft, Lock, User, UserPlus2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { DocasAPI } from "../../services/docas";
import { TimesAPI } from "../../services/times";
import { AbasSegmentadas, BuscaColaborador, Esqueleto, Modal } from "./ui";
import { BTN_PRIMARIO, FOCO, FUNCOES_DOCA as FUNCOES_POR_OPERACAO } from "./uiTokens";

const NOME_OPERACAO = { INBOUND: "Recebimento", OUTBOUND: "Expedição" };

export function SelecionarTimeModal({ numero, operacaoAtual, onClose, onAllocated }) {
  const [operacao, setOperacao] = useState(operacaoAtual || null);
  const [aba, setAba] = useState("time"); // "time" | "colaborador" | "diarista"
  const [times, setTimes] = useState(null); // { operacao, lista }
  const [salvando, setSalvando] = useState(false);
  const [funcao, setFuncao] = useState("");

  useEffect(() => {
    if (!operacao) return undefined;
    let ativo = true;
    TimesAPI.listar({ operacao })
      .then((lista) => ativo && setTimes({ operacao, lista }))
      .catch(() => ativo && setTimes({ operacao, lista: [] }));
    return () => {
      ativo = false;
    };
  }, [operacao]);

  async function alocarTime(idTime) {
    setSalvando(true);
    try {
      await DocasAPI.alocar(numero, { operacao, idTime });
      toast.success("Doca alocada com sucesso");
      onAllocated?.();
      onClose();
    } catch (e) {
      if (!e.tratado) toast.error(e.response?.data?.message || "Erro ao alocar doca");
    } finally {
      setSalvando(false);
    }
  }

  async function alocarAvulso(opsId, diarista) {
    if (!funcao) {
      toast.error("Selecione a função");
      return;
    }
    setSalvando(true);
    try {
      await DocasAPI.alocar(numero, { operacao, opsId, diarista, funcao });
      toast.success(diarista ? "Diarista alocado com sucesso" : "Colaborador alocado com sucesso");
      onAllocated?.();
      onClose();
    } catch (e) {
      if (!e.tratado) toast.error(e.response?.data?.message || "Erro ao alocar doca");
    } finally {
      setSalvando(false);
    }
  }

  const funcoes = operacao ? FUNCOES_POR_OPERACAO[operacao] : [];
  const timesProntos = times && times.operacao === operacao ? times.lista : null;

  return (
    <Modal
      z="z-[60]"
      kicker={`Doca ${numero}`}
      titulo="Adicionar equipe"
      subtitulo={operacao ? NOME_OPERACAO[operacao] : "Escolha a operação"}
      onClose={onClose}
      bloqueado={salvando}
    >
      {!operacao ? (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(NOME_OPERACAO).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setOperacao(valor)}
              className={`h-20 rounded-xl bg-surface-2 hover:bg-surface-3 border border-default text-sm font-medium transition-colors cursor-pointer ${FOCO}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      ) : (
        <>
          {!operacaoAtual && (
            <button type="button" onClick={() => setOperacao(null)} className={`inline-flex items-center gap-1.5 h-9 -ml-2 px-2 rounded-lg text-sm text-muted hover:text-page cursor-pointer ${FOCO}`}>
              <ArrowLeft size={15} aria-hidden="true" /> Trocar operação
            </button>
          )}

          <AbasSegmentadas
            rotulo="Tipo de alocação"
            valor={aba}
            onChange={setAba}
            opcoes={[
              { valor: "time", rotulo: "Time", icone: <Users size={14} aria-hidden="true" /> },
              { valor: "colaborador", rotulo: "Avulso", icone: <User size={14} aria-hidden="true" /> },
              { valor: "diarista", rotulo: "Diarista", icone: <UserPlus2 size={14} aria-hidden="true" /> },
            ]}
          />

          {aba === "time" && (
            <div>
              {!timesProntos ? (
                <div aria-busy="true" aria-label="Carregando times" className="space-y-2">
                  <Esqueleto className="h-14" />
                  <Esqueleto className="h-14" />
                </div>
              ) : timesProntos.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  Nenhum time cadastrado para esta operação.
                  <span className="block text-xs mt-1">Crie um time no painel “Gestão de equipes”.</span>
                </p>
              ) : (
                <ul className="rounded-xl border border-default divide-y divide-default max-h-72 overflow-y-auto">
                  {timesProntos.map((t) => {
                    const ocupado = t.docaAtual != null;
                    return (
                      <li key={t.idTime}>
                        <button
                          type="button"
                          onClick={() => alocarTime(t.idTime)}
                          disabled={salvando || ocupado}
                          title={ocupado ? `Libere a Doca ${t.docaAtual} para poder alocar este time em outra doca` : undefined}
                          className={`w-full text-left px-3.5 py-3 min-h-[44px] transition-colors disabled:cursor-not-allowed ${FOCO} ${
                            ocupado ? "opacity-60" : "hover:bg-surface-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              {t.nome} {t.tipo === "FIFO" && <span className="text-xs font-normal text-muted">(FIFO)</span>}
                            </span>
                            {ocupado && (
                              <span className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FF453A]/15 text-[#FF453A] text-xs font-semibold">
                                <Lock size={11} aria-hidden="true" /> Já alocado na Doca {t.docaAtual}
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted mt-0.5">
                            {ocupado
                              ? `Libere a Doca ${t.docaAtual} para alocar aqui · `
                              : ""}
                            {t.integrantes.length} {t.integrantes.length === 1 ? "integrante" : "integrantes"} · Turno {t.turno}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {(aba === "colaborador" || aba === "diarista") && (
            <div className="space-y-3">
              <div role="group" aria-label="Função na doca" className="flex gap-2">
                {funcoes.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={funcao === f.value}
                    onClick={() => setFuncao(f.value)}
                    className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors cursor-pointer ${FOCO} ${
                      funcao === f.value ? "bg-[#FA4C00] text-white" : "bg-surface-2 text-muted hover:text-page"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {!funcao && <p className="text-xs text-muted">Escolha a função antes de selecionar a pessoa.</p>}

              {aba === "colaborador" ? (
                <BuscaColaborador
                  contexto={operacao === "INBOUND" ? "RECEBIMENTO" : "EXPEDICAO"}
                  onSelecionar={(c) => alocarAvulso(c.opsId, false)}
                  desabilitado={salvando || !funcao}
                />
              ) : (
                <button type="button" onClick={() => alocarAvulso(null, true)} disabled={salvando || !funcao} className={`${BTN_PRIMARIO} w-full`}>
                  {salvando ? "Alocando…" : "Alocar diarista nesta doca"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
