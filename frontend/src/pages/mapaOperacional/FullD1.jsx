import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AlocarFullD1Modal } from "../../components/mapaOperacional/AlocarFullD1Modal";
import { Aviso, DiaNavegador, EstadoVazio, Esqueleto, PageHeader, TurnoTabs } from "../../components/mapaOperacional/ui";
import { BTN_PRIMARIO, BTN_SECUNDARIO, FOCO, ehTurnoFuturo, formatNumero, somarDias } from "../../components/mapaOperacional/uiTokens";
import { MapaOperacionalAPI } from "../../services/mapaOperacional";

const POLL_INTERVAL_MS = 20000;
const TURNOS = ["T1", "T2", "T3"];

export default function FullD1() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null); // { turno, data, total, pessoas }
  const [erro, setErro] = useState(null);
  const [turnoAtual, setTurnoAtual] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [encerrando, setEncerrando] = useState(null);
  const [params, setParams] = useSearchParams();

  // Turno e dia ficam na URL; sem eles vale o "agora".
  const turnoParam = params.get("turno");
  const dataParam = params.get("data");
  const turnoSelecionado = TURNOS.includes(turnoParam) ? turnoParam : (turnoAtual?.turno ?? null);
  const dataSelecionada = /^\d{4}-\d{2}-\d{2}$/.test(dataParam || "") ? dataParam : (turnoAtual?.diaOperacionalStr ?? null);

  const estaNoTurnoAtual =
    !!turnoAtual && turnoSelecionado === turnoAtual.turno && dataSelecionada === turnoAtual.diaOperacionalStr;
  // Turno que ainda não começou: dá para pré-alocar (as pessoas entram sozinhas quando ele começar).
  const ehFuturo = ehTurnoFuturo(turnoAtual, dataSelecionada, turnoSelecionado);

  const atualizarParams = (mudancas) => {
    const proximo = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => (v ? proximo.set(k, v) : proximo.delete(k)));
    setParams(proximo, { replace: true });
  };

  useEffect(() => {
    MapaOperacionalAPI.obterTurnoAtual()
      .then(setTurnoAtual)
      .catch(() => setErro("Não foi possível carregar o turno atual."));
  }, []);

  const carregar = useCallback(async () => {
    if (!turnoSelecionado || !dataSelecionada) return;
    try {
      const [res, agendadas] = await Promise.all([
        MapaOperacionalAPI.listarFullD1({ turno: turnoSelecionado, data: dataSelecionada }),
        ehFuturo || estaNoTurnoAtual
          ? MapaOperacionalAPI.listarAgendadas({ turno: turnoSelecionado, data: dataSelecionada, full: true }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setDados({ ...res, agendadas, turno: turnoSelecionado, data: dataSelecionada });
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e.response?.data?.message || "Não foi possível carregar o FULL D+1");
    }
  }, [turnoSelecionado, dataSelecionada, ehFuturo, estaNoTurnoAtual]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ao vivo e em turno futuro: recarrega a cada 20 s e confere se o turno virou (o futuro vira o atual sozinho).
  useEffect(() => {
    if (!estaNoTurnoAtual && !ehFuturo) return undefined;
    const intervalo = setInterval(() => {
      if (document.hidden) return;
      MapaOperacionalAPI.obterTurnoAtual()
        .then((t) => setTurnoAtual((prev) => (prev && prev.turno === t.turno && prev.diaOperacionalStr === t.diaOperacionalStr ? prev : t)))
        .catch(() => {});
      carregar();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalo);
  }, [estaNoTurnoAtual, ehFuturo, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  async function encerrarManual(idAlocacao) {
    setEncerrando(idAlocacao);
    try {
      await MapaOperacionalAPI.encerrarAlocacaoFullD1(idAlocacao);
      toast.success("Alocação encerrada");
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao encerrar alocação");
    } finally {
      setEncerrando(null);
    }
  }

  async function removerPreAlocacao(idAgendada) {
    setEncerrando(idAgendada);
    try {
      await MapaOperacionalAPI.removerAgendada(idAgendada);
      toast.success("Pré-alocação removida");
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro ao remover pré-alocação");
    } finally {
      setEncerrando(null);
    }
  }

  const dadosAtuais = dados && dados.turno === turnoSelecionado && dados.data === dataSelecionada ? dados : null;
  const pessoas = dadosAtuais?.pessoas || [];
  const preAlocadas = (dadosAtuais?.agendadas || []).filter((a) => a.status === "PENDENTE");
  const naoEntraram = (dadosAtuais?.agendadas || []).filter((a) => a.status === "FALHOU");

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1600px] mx-auto">
          <PageHeader
            titulo="FULL D+1"
            subtitulo="Pool compartilhado: logados na Workstation e alocações manuais, sem braço"
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <TurnoTabs
              turno={turnoSelecionado}
              turnoAgora={turnoAtual && dataSelecionada === turnoAtual.diaOperacionalStr ? turnoAtual.turno : null}
              onChange={(t) => atualizarParams({ turno: t })}
            />
            <DiaNavegador
              data={dataSelecionada}
              maximo={turnoAtual ? somarDias(turnoAtual.diaOperacionalStr, 1) : undefined}
              onChange={(d) => atualizarParams({ data: d })}
            />
          </div>

          {!estaNoTurnoAtual && turnoAtual && !erro && (
            <Aviso
              acao={
                <button type="button" onClick={() => atualizarParams({ turno: "", data: "" })} className={`${BTN_SECUNDARIO} h-9`}>
                  Voltar para agora
                </button>
              }
            >
              {ehFuturo
                ? "Turno futuro: pré-aloque quem vai trabalhar. As pessoas entram sozinhas quando o turno começar."
                : "Turno histórico: o painel mostra check-in e check-out registrados."}
            </Aviso>
          )}

          {estaNoTurnoAtual && naoEntraram.length > 0 && (
            <Aviso tipo="alerta">
              {naoEntraram.length === 1 ? "1 pré-alocação não entrou" : `${naoEntraram.length} pré-alocações não entraram`}:{" "}
              {naoEntraram.map((a) => `${a.diarista ? "Diarista" : a.colaborador?.nomeCompleto} (${a.motivoFalha})`).join("; ")}
            </Aviso>
          )}

          {erro && (
            <Aviso
              tipo="erro"
              acao={
                <button type="button" onClick={atualizarAgora} className={`${BTN_SECUNDARIO} h-9`}>
                  Tentar de novo
                </button>
              }
            >
              {erro}
              {dadosAtuais && " Mostrando os últimos dados carregados."}
            </Aviso>
          )}

          {ehFuturo ? (
            <section aria-labelledby="titulo-prealocados" className="bg-surface rounded-2xl border border-default overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-5 py-4 border-b border-default">
                <h2 id="titulo-prealocados" className="font-semibold">
                  Pré-alocados no {turnoSelecionado}
                </h2>
                <div className="flex items-center gap-4">
                  {dadosAtuais && (
                    <p className="text-sm text-muted">
                      <b className="text-page text-xl tabular-nums mr-1">{formatNumero(preAlocadas.length)}</b>
                      {preAlocadas.length === 1 ? "pessoa" : "pessoas"}
                    </p>
                  )}
                  <button type="button" onClick={() => setModalAdicionar(true)} className={`${BTN_PRIMARIO} h-10`}>
                    <Plus size={15} aria-hidden="true" /> Pré-alocar
                  </button>
                </div>
              </div>

              {!dadosAtuais ? (
                erro ? null : (
                  <div aria-busy="true" aria-label="Carregando" className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Esqueleto key={i} className="h-10" />
                    ))}
                  </div>
                )
              ) : preAlocadas.length === 0 ? (
                <EstadoVazio
                  icone={<Users size={28} aria-hidden="true" />}
                  titulo="Ninguém pré-alocado"
                  descricao="Adicione quem vai trabalhar no FULL D+1 neste turno. A presença é conferida quando o turno começar."
                />
              ) : (
                <ul className="divide-y divide-default">
                  {preAlocadas.map((a) => (
                    <li key={a.idAgendada} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium flex items-center gap-2 flex-wrap">
                          {a.diarista ? "Diarista" : a.colaborador?.nomeCompleto}
                          <span className="text-[11px] font-medium text-[#FA4C00] bg-[#FA4C00]/10 px-1.5 py-0.5 rounded-md">Agendado</span>
                        </p>
                        <p className="text-xs text-muted">{a.colaborador?.cargo?.nomeCargo || a.colaborador?.opsId || "—"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerPreAlocacao(a.idAgendada)}
                        disabled={encerrando === a.idAgendada}
                        aria-label={`Remover pré-alocação de ${a.diarista ? "diarista" : a.colaborador?.nomeCompleto}`}
                        title="Remover pré-alocação"
                        className={`h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${FOCO}`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
          <section aria-labelledby="titulo-logados" className="bg-surface rounded-2xl border border-default overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 py-4 border-b border-default">
              <h2 id="titulo-logados" className="font-semibold">
                {estaNoTurnoAtual ? "Logados agora" : "Logados no turno"}
              </h2>
              <div className="flex items-center gap-4">
                {dadosAtuais && (
                  <p className="text-sm text-muted">
                    <b className="text-page text-xl tabular-nums mr-1">{formatNumero(dadosAtuais.total)}</b>
                    {dadosAtuais.total === 1 ? "colaborador" : "colaboradores"}
                  </p>
                )}
                {estaNoTurnoAtual && (
                  <button type="button" onClick={() => setModalAdicionar(true)} className={`${BTN_PRIMARIO} h-10`}>
                    <Plus size={15} aria-hidden="true" /> Adicionar
                  </button>
                )}
              </div>
            </div>

            {!dadosAtuais ? (
              erro ? null : (
                <div aria-busy="true" aria-label="Carregando" className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Esqueleto key={i} className="h-10" />
                  ))}
                </div>
              )
            ) : pessoas.length === 0 ? (
              <EstadoVazio
                icone={<Users size={28} aria-hidden="true" />}
                titulo="Ninguém no FULL D+1"
                descricao={
                  estaNoTurnoAtual
                    ? "Ninguém logado na Workstation e nenhuma alocação manual neste turno."
                    : `Não há registro no ${turnoSelecionado} deste dia.`
                }
                acao={
                  estaNoTurnoAtual && (
                    <button type="button" onClick={() => setModalAdicionar(true)} className={`${BTN_PRIMARIO} h-10 mt-2`}>
                      <Plus size={15} aria-hidden="true" /> Adicionar pessoa
                    </button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase tracking-wide">
                      <th scope="col" className="text-left font-medium px-5 py-3">Colaborador</th>
                      <th scope="col" className="text-left font-medium px-5 py-3 hidden md:table-cell">Cargo</th>
                      {estaNoTurnoAtual ? (
                        <>
                          <th scope="col" className="text-right font-medium px-5 py-3">Produção (hora atual)</th>
                          <th scope="col" className="text-right font-medium px-5 py-3">Total do turno</th>
                          <th scope="col" className="relative px-3 py-3 w-14"><span className="sr-only">Ações</span></th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="text-right font-medium px-5 py-3">Check-in</th>
                          <th scope="col" className="text-right font-medium px-5 py-3">Check-out</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {pessoas.map((p, i) => (
                      <tr key={p.idAlocacao || `${p.opsId}-${i}`} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium flex items-center gap-2 flex-wrap">
                            {p.diarista ? "Diarista" : p.colaborador?.nomeCompleto || p.opsId}
                            {p.origem === "MANUAL" && (
                              <span className="text-[11px] font-medium text-[#FA4C00] bg-[#FA4C00]/10 px-1.5 py-0.5 rounded-md">Manual</span>
                            )}
                            {p.origem === "SINERGIA" && (
                              <span
                                className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                                style={{
                                  color: p.sinergia?.retornoPendente ? "#F59E0B" : "#FA4C00",
                                  background: p.sinergia?.retornoPendente ? "#F59E0B1F" : "#FA4C001F",
                                }}
                              >
                                Sinergia · de {p.sinergia?.origem}
                                {p.sinergia?.retornoPendente ? " · retorno pendente" : ""}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted tabular-nums md:hidden">{p.colaborador?.cargo?.nomeCargo || p.opsId || "—"}</p>
                        </td>
                        <td className="px-5 py-3 text-muted hidden md:table-cell">{p.colaborador?.cargo?.nomeCargo || "—"}</td>
                        {estaNoTurnoAtual ? (
                          <>
                            <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#22C55E]">
                              {p.origem !== "AUTO" ? <span className="text-muted font-normal">—</span> : formatNumero(p.producaoHoraAtual)}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-muted">
                              {p.origem !== "AUTO" ? "—" : formatNumero(p.efficiencyTotal)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {p.origem === "MANUAL" && (
                                <button
                                  type="button"
                                  onClick={() => encerrarManual(p.idAlocacao)}
                                  disabled={encerrando === p.idAlocacao}
                                  aria-label={`Encerrar alocação de ${p.diarista ? "diarista" : p.colaborador?.nomeCompleto}`}
                                  title="Encerrar alocação"
                                  className={`h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${FOCO}`}
                                >
                                  <X size={16} aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-right tabular-nums text-muted">{p.checkIn || "—"}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-muted">
                              {p.checkOut || (
                                <span className="text-[11px] font-medium text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded-md">Ativo</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}
        </main>
      </MainLayout>

      {modalAdicionar && (
        <AlocarFullD1Modal
          agendar={ehFuturo ? { turno: turnoSelecionado, data: dataSelecionada } : null}
          onClose={() => setModalAdicionar(false)}
          onAllocated={carregar}
        />
      )}
    </div>
  );
}
