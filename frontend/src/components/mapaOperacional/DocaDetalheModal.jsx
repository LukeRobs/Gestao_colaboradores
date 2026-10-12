import { useCallback, useEffect, useState } from "react";
import { Clock, Info, Plus, Truck, UserCircle, Users } from "lucide-react";
import toast from "react-hot-toast";
import { DocasAPI } from "../../services/docas";
import { confirmDialog } from "../ConfirmDialog";
import { Esqueleto, Modal } from "./ui";
import { BTN_PERIGO, BTN_PRIMARIO } from "./uiTokens";
import { SelecionarTimeModal } from "./SelecionarTimeModal";

const LABOR_LABEL = {
  DOCK_RECEIVED: "Received",
  DOCK_PULL: "Pull",
  DOCK_CONFERENTE: "Conferente",
  DOCK_PUSH: "Push",
  DOCK_FIFO: "FIFO",
  DOCK_LOG_II: "LOG II",
  DOCK_VOLANTE: "Volante",
};
const NOME_OPERACAO = { INBOUND: "Recebimento", OUTBOUND: "Expedição" };

function formatDataHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function Secao({ titulo, children }) {
  return (
    <section>
      <h3 className="text-xs text-muted uppercase tracking-wide mb-2">{titulo}</h3>
      {children}
    </section>
  );
}

export function DocaDetalheModal({ numero, onClose, onChanged }) {
  const [doca, setDoca] = useState(null);
  const [liberando, setLiberando] = useState(false);
  const [modalTime, setModalTime] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDoca(await DocasAPI.obter(numero));
    } catch {
      toast.error("Erro ao carregar doca");
    }
  }, [numero]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function liberar() {
    // Trava o modal já na confirmação: o diálogo global não trata Esc e fecharia o modal por baixo.
    setLiberando(true);
    const ok = await confirmDialog(
      `Deseja realmente liberar a Doca ${numero}?\n\nOperação: ${NOME_OPERACAO[doca.operacao] || "—"}\n${
        doca.alocacao?.time
          ? `Time: ${doca.alocacao.time.nome}`
          : doca.alocacao?.diarista
            ? "Diarista avulso"
            : doca.alocacao?.colaborador
              ? doca.alocacao.colaborador.nomeCompleto
              : ""
      }\nInício: ${formatDataHora(doca.alocacao?.inicio)}`,
      { danger: true, confirmText: "Liberar" }
    );
    if (!ok) {
      setLiberando(false);
      return;
    }

    try {
      await DocasAPI.liberar(numero);
      toast.success("Doca liberada com sucesso");
      onChanged?.();
      await carregar();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao liberar doca");
    } finally {
      setLiberando(false);
    }
  }

  return (
    <>
      <Modal
        kicker="Gestão de Docas"
        titulo={`Doca ${numero}`}
        subtitulo={doca ? (doca.ocupada ? `Ocupada · ${NOME_OPERACAO[doca.operacao] || "em uso"}` : "Disponível") : undefined}
        onClose={onClose}
        bloqueado={liberando}
        largura="max-w-lg"
      >
        {!doca ? (
          <div aria-busy="true" aria-label="Carregando doca" className="space-y-3">
            <Esqueleto className="h-10" />
            <Esqueleto className="h-24" />
            <Esqueleto className="h-20" />
          </div>
        ) : (
          <>
            {doca.sheet && (
              <Secao titulo="Pátio">
                <dl className="rounded-xl border border-default divide-y divide-default text-sm">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="flex items-center gap-2 text-muted"><Truck size={14} aria-hidden="true" /> Veículo</dt>
                    <dd>{doca.sheet.fisicamenteOcupada ? "Presente agora" : "Sem veículo no momento"}</dd>
                  </div>
                  {doca.sheet.placa && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-muted">Placa</dt>
                      <dd className="tabular-nums">{doca.sheet.placa}</dd>
                    </div>
                  )}
                  {doca.sheet.motorista && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-muted">Motorista</dt>
                      <dd className="text-right">{doca.sheet.motorista}</dd>
                    </div>
                  )}
                  {doca.sheet.fisicamenteOcupada && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="flex items-center gap-2 text-muted"><Clock size={14} aria-hidden="true" /> Ocupação física</dt>
                      <dd className="tabular-nums">{doca.sheet.duracao}</dd>
                    </div>
                  )}
                </dl>
              </Secao>
            )}

            <Secao titulo="Equipe responsável">
              {!doca.alocacao ? (
                <div className="rounded-xl border border-dashed border-default px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-muted">Nenhuma equipe alocada</p>
                  <button type="button" onClick={() => setModalTime(true)} className={`${BTN_PRIMARIO} h-10`}>
                    <Plus size={15} aria-hidden="true" /> Adicionar equipe
                  </button>
                </div>
              ) : doca.alocacao?.time ? (
                <div className="rounded-xl border border-default">
                  <p className="px-4 py-3 text-sm font-medium flex items-center gap-2 border-b border-default">
                    <Users size={15} className="text-muted" aria-hidden="true" /> {doca.alocacao.time.nome}
                  </p>
                  <ul className="divide-y divide-default">
                    {doca.alocacao.time.integrantes.map((i) => (
                      <li key={i.colaborador.opsId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="truncate">{i.colaborador.nomeCompleto}</span>
                        <span className="text-muted shrink-0">{i.funcao ? LABOR_LABEL[`DOCK_${i.funcao}`] || i.funcao : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-default px-4 py-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <UserCircle size={15} className="text-muted" aria-hidden="true" />
                    {doca.alocacao?.diarista ? "Diarista" : doca.alocacao?.colaborador?.nomeCompleto || "—"}
                  </p>
                  <p className="text-xs text-muted mt-1">Função: {LABOR_LABEL[doca.alocacao?.labor] || "—"}</p>
                </div>
              )}
            </Secao>

            {doca.alocacao ? (
              <>
                {doca.sheet && !doca.sheet.fisicamenteOcupada && doca.liberacaoAutomaticaMinutos && (
                  <p className="flex items-start gap-2 text-xs text-muted">
                    <Info size={14} className="shrink-0 mt-px" aria-hidden="true" />
                    {doca.sheet.caminhoesAguardando > 0
                      ? "Há caminhão aguardando esta doca: a equipe continua alocada."
                      : `Sem veículo na doca${doca.sheet.ociosaSegundos >= 60 ? ` há ${Math.floor(doca.sheet.ociosaSegundos / 60)} min` : ""}. A equipe é liberada automaticamente após ${doca.liberacaoAutomaticaMinutos} min sem veículo, desde que o último veículo tenha saído depois de ela ser alocada.`}
                  </p>
                )}
                <button type="button" onClick={liberar} disabled={liberando} className={`${BTN_PERIGO} w-full`}>
                  {liberando ? "Liberando…" : "Liberar doca"}
                </button>
              </>
            ) : (
              doca.ocupada && (
                <p className="flex items-start gap-2 text-xs text-muted">
                  <Info size={14} className="shrink-0 mt-px" aria-hidden="true" />
                  Ocupação lida do pátio (planilha), ainda sem equipe formalizada no COPEOPLE. Libera sozinha quando o veículo sair.
                </p>
              )
            )}

            {doca.historico?.length > 0 && (
              <Secao titulo="Histórico recente">
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {doca.historico.map((h) => (
                    <li key={h.id} className="text-xs text-muted">
                      <span className="text-page tabular-nums">{formatDataHora(h.criadoEm)}</span> · {h.acao === "ALOCADA" ? "Alocada" : "Liberada"}
                      {h.operacao ? ` (${NOME_OPERACAO[h.operacao]})` : ""}
                      {h.nomeTime ? ` · Time: ${h.nomeTime}` : ""}
                      {h.usuarioNome ? ` · ${h.usuarioNome}` : ""}
                    </li>
                  ))}
                </ul>
              </Secao>
            )}
          </>
        )}
      </Modal>

      {modalTime && doca && (
        <SelecionarTimeModal
          numero={numero}
          operacaoAtual={doca.operacao}
          onClose={() => setModalTime(false)}
          onAllocated={() => {
            onChanged?.();
            carregar();
          }}
        />
      )}
    </>
  );
}
