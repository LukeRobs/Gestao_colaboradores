import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Layers, Search, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { Aviso, EstadoVazio, Esqueleto, FaixaIndicadores, PageHeader } from "../../components/mapaOperacional/ui";
import { FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { StageInAPI } from "../../services/stageIn";
import { FUSO } from "./filaUtils";
import { Paginacao } from "./FilaPecas";
import { AbasZona, CardZona, PainelOcupacao, PainelTop5, PainelTurno, Secao, TabelaCalor } from "./StageInPecas";
import { FAIXAS_AGING, PERFIS, corAging, corOcupacao, cruzamentoAging, fmtDur, mapaCoresZonas, montarRuas, resumoPerfil, zonaCurta } from "./stageInUtils";

const POLL_MS = 15000;
const ATRASO_MS = 5 * 60 * 1000; // o script envia a cada 60s: sem sincronizar há mais que isso = desatualizado
const TODAS = "__todas__";

const COLUNAS = [
  { chave: "nome", rotulo: "Rua", valor: (r) => r.nome.toLowerCase() },
  { chave: "zona", rotulo: "Zona", valor: (r) => r.zona.toLowerCase() },
  { chave: "area", rotulo: "Área", valor: (r) => (r.area?.rotulo || "").toLowerCase() },
  { chave: "tos", rotulo: "TOs", direita: true, valor: (r) => r.tos },
  { chave: "pacotes", rotulo: "Pacotes", direita: true, valor: (r) => r.pacotes ?? -1 },
  { chave: "spp", rotulo: "SPP", titulo: "Pacotes por TO (inclui gaiolas)", direita: true, valor: (r) => r.spp ?? -1 },
  { chave: "capacidade", rotulo: "Cap.", titulo: "Capacidade da rua", direita: true, valor: (r) => r.capacidade },
  { chave: "ocupacao", rotulo: "Ocupação", valor: (r) => r.ocupacao },
  { chave: "aging", rotulo: "Aging", valor: (r) => r.aging },
  { chave: "operador", rotulo: "Operador", valor: (r) => r.operador.toLowerCase() },
];

function ordenar(lista, chave, asc) {
  const col = COLUNAS.find((c) => c.chave === chave);
  return [...lista].sort((a, b) => {
    const va = col.valor(a);
    const vb = col.valor(b);
    const r = typeof va === "number" ? va - vb : va.localeCompare(vb);
    return asc ? r : -r;
  });
}

function StatusSincronizacao({ estado, detalhe, proxima }) {
  const cores = { online: "#22C55E", atrasado: "#F59E0B", offline: "#FF453A", conectando: "#8B8B93" };
  const rotulos = { online: "Online", atrasado: "Dados desatualizados", offline: "Offline", conectando: "Conectando" };
  return (
    <div role="status" className="inline-flex items-center gap-3 rounded-full border border-default bg-surface px-4 h-10 text-xs text-muted">
      <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: cores[estado] }} />
      <span>
        <b className="text-page font-semibold">{rotulos[estado]}</b>
        {detalhe && <span> · {detalhe}</span>}
      </span>
      {proxima != null && <span className="hidden sm:inline border-l border-default pl-3 tabular-nums">próxima atualização ~{proxima}s</span>}
    </div>
  );
}

function Perfis({ tosPerfil }) {
  if (!tosPerfil) return <span className="text-muted">—</span>;
  const partes = PERFIS.filter((p) => (tosPerfil[p.chave] || 0) > 0);
  if (!partes.length) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {partes.map((p) => (
        <span key={p.chave} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ color: p.cor, background: `${p.cor}1f` }}>
          {p.curto} {tosPerfil[p.chave]}
        </span>
      ))}
    </span>
  );
}

function TosDaRua({ rua, perfilPorTo }) {
  if (!rua.tosRua.length) return <p className="text-sm text-muted px-1">Nenhuma TO na planilha para esta rua.</p>;
  const tos = [...rua.tosRua].sort((a, b) => b.agingH - a.agingH);
  return (
    <div className="overflow-x-auto scroll-tema">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted text-left">
            <th className="py-1.5 pr-4 font-medium">TO</th>
            <th className="py-1.5 pr-4 font-medium text-right">Pacotes</th>
            <th className="py-1.5 pr-4 font-medium">Aging</th>
            <th className="py-1.5 pr-4 font-medium">Endereçada às</th>
            <th className="py-1.5 pr-4 font-medium">Turno</th>
            <th className="py-1.5 font-medium">Perfil</th>
          </tr>
        </thead>
        <tbody>
          {tos.map((t) => (
            <tr key={t.to} className="border-t border-default">
              <td className="py-1.5 pr-4 font-mono">{t.to}</td>
              <td className="py-1.5 pr-4 text-right tabular-nums">{t.pacotes}</td>
              <td className="py-1.5 pr-4 tabular-nums" style={{ color: corAging(t.agingH * 3600) }}>{fmtDur(Math.round(t.agingH * 3600))}</td>
              <td className="py-1.5 pr-4 text-muted tabular-nums">{t.horaEnd || "—"}</td>
              <td className="py-1.5 pr-4">{t.turno || "—"}</td>
              <td className="py-1.5"><Perfis tosPerfil={perfilPorTo?.[t.to]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StageIn() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [zonaAtiva, setZonaAtiva] = useState(TODAS);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ chave: "aging", asc: false });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [abertas, setAbertas] = useState(() => new Set());
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [proximaEm, setProximaEm] = useState(() => Date.now() + POLL_MS);

  const carregar = useCallback(async () => {
    try {
      setDados(await StageInAPI.obter());
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403) setErro(e.response.data?.message || "Este módulo não está disponível para a sua estação.");
    } finally {
      setProximaEm(Date.now() + POLL_MS);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => {
      setAgora(Date.now());
      if (!document.hidden && Date.now() >= proximaEm) carregar();
    }, 1000);
    return () => clearInterval(t);
  }, [proximaEm, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const relatorio = dados?.relatorio;
  const temReport = !!relatorio?.disponivel;
  const ruas = useMemo(() => montarRuas(dados?.ruas, relatorio), [dados, relatorio]);
  const cores = useMemo(() => mapaCoresZonas([...ruas.map((r) => r.zona), ...(temReport ? Object.keys(relatorio.porZona) : [])]), [ruas, relatorio, temReport]);

  const filtroZona = zonaAtiva === TODAS ? null : zonaAtiva;
  // Se a zona escolhida some (a estação mudou), volta para "Todas".
  const zonaValida = filtroZona && ruas.some((r) => r.zona === filtroZona) ? filtroZona : null;
  const naZona = useMemo(() => (zonaValida ? ruas.filter((r) => r.zona === zonaValida) : ruas), [ruas, zonaValida]);
  const ativas = useMemo(() => naZona.filter((r) => r.tos > 0), [naZona]);
  // Ruas "ocupadas/indisponíveis" (status 2) saem da tabela e da ocupação, como no painel original.
  const disponiveis = useMemo(() => (naZona.some((r) => r.status !== undefined) ? naZona.filter((r) => r.status === 1) : naZona), [naZona]);

  const abas = useMemo(() => {
    const porZona = {};
    ruas.forEach((r) => (porZona[r.zona] = (porZona[r.zona] || 0) + r.tos));
    const itens = Object.entries(porZona)
      .map(([nome, tos]) => ({ chave: nome, rotulo: zonaCurta(nome), cor: cores[nome], contagem: temReport && relatorio.porZona[nome] ? relatorio.porZona[nome].pacotes : tos }))
      .sort((a, b) => b.contagem - a.contagem);
    return [{ chave: TODAS, rotulo: "Todas", contagem: itens.reduce((s, i) => s + i.contagem, 0) }, ...itens];
  }, [ruas, cores, relatorio, temReport]);

  const kpis = useMemo(() => {
    const totalTOs = ativas.reduce((s, r) => s + r.tos, 0);
    const gaiolas = ativas.reduce((s, r) => s + r.gaiolas, 0);
    const maior = ativas.reduce((m, r) => (!m || r.aging > m.aging ? r : m), null);
    const media = ativas.length ? ativas.reduce((s, r) => s + r.aging, 0) / ativas.length : 0;
    let pacotes = null;
    if (temReport) pacotes = zonaValida ? relatorio.porZona[zonaValida]?.pacotes || 0 : Object.values(relatorio.porZona).reduce((s, z) => s + z.pacotes, 0);
    const unidades = totalTOs + gaiolas;
    return { totalTOs, gaiolas, maior, media, pacotes, porTo: pacotes != null && unidades > 0 ? Math.round(pacotes / unidades) : null };
  }, [ativas, relatorio, temReport, zonaValida]);

  const cardsZona = useMemo(() => {
    const grupos = {};
    ruas.filter((r) => r.tos > 0).forEach((r) => {
      const g = (grupos[r.zona] = grupos[r.zona] || { nome: r.zona, tos: 0, gaiolas: 0, agings: [], spps: [] });
      g.tos += r.tos;
      g.gaiolas += r.gaiolas;
      if (r.aging > 0) g.agings.push(r.aging);
      if (r.spp != null) g.spps.push(r.spp);
    });
    return Object.values(grupos)
      .map((g) => ({ ...g, pacotes: temReport && relatorio.porZona[g.nome] ? relatorio.porZona[g.nome].pacotes : null }))
      .filter((g) => !zonaValida || g.nome === zonaValida)
      .sort((a, b) => (b.pacotes ?? b.tos) - (a.pacotes ?? a.tos));
  }, [ruas, relatorio, temReport, zonaValida]);

  const cruzamento = useMemo(() => cruzamentoAging(ruas, relatorio, zonaValida), [ruas, relatorio, zonaValida]);
  const perfil = useMemo(() => resumoPerfil(dados?.perfil, zonaValida), [dados, zonaValida]);

  const top5 = useMemo(() => [...ativas].sort((a, b) => b.aging - a.aging).slice(0, 5), [ativas]);
  const ocupacao = useMemo(() => {
    const g = {};
    disponiveis.forEach((r) => {
      const z = (g[r.zona] = g[r.zona] || { zona: r.zona, tos: 0, capacidade: 0 });
      z.tos += r.tos;
      z.capacidade += r.capacidade;
    });
    return Object.values(g)
      .sort((a, b) => b.tos - a.tos)
      .map((z) => ({ ...z, pct: z.capacidade > 0 ? (z.tos / z.capacidade) * 100 : 0 }));
  }, [disponiveis]);
  const turnos = useMemo(
    () => (temReport ? Object.entries(relatorio.porTurno).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.pacotes - a.pacotes) : []),
    [relatorio, temReport]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? disponiveis.filter((r) => [r.nome, r.zona, r.operador].some((v) => v.toLowerCase().includes(q))) : disponiveis;
    return ordenar(lista, ordem.chave, ordem.asc);
  }, [disponiveis, busca, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  const alternarOrdem = (chave) => {
    setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));
    setPagina(1);
  };
  const alternarRua = (nome) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(nome)) n.delete(nome);
      else n.add(nome);
      return n;
    });

  /* ---------- sincronização ---------- */
  const ultimoSync = dados?.sincronizacao?.ultimoFetchedAt ?? null;
  let estadoSync = "conectando";
  let detalheSync = "aguardando a primeira sincronização";
  if (dados) {
    if (offline) {
      estadoSync = "offline";
      detalheSync = "falha ao conectar no servidor";
    } else if (ultimoSync == null) {
      estadoSync = "atrasado";
      detalheSync = "o Tampermonkey ainda não enviou dados";
    } else {
      const atrasoMs = agora - ultimoSync;
      const hhmm = new Date(ultimoSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
      const min = Math.floor(atrasoMs / 60000);
      estadoSync = atrasoMs < ATRASO_MS ? "online" : "atrasado";
      detalheSync = `atualizado às ${hhmm}${min > 0 ? ` (há ${min} min)` : ""}`;
    }
  }
  const proxima = Math.max(0, Math.round((proximaEm - agora) / 1000));

  const zonasCruzamento = cruzamento.zonas.map((z) => ({
    nome: z,
    apoio: relatorio?.porZona?.[z] ? `${formatNumero(relatorio.porZona[z].pacotes)} pcts` : `${formatNumero(cruzamento.totaisZona[z] || 0)} TOs`,
  }));
  const linhasCruzamento = FAIXAS_AGING.map((f, i) => {
    const total = cruzamento.zonas.reduce((s, z) => s + (cruzamento.celulas[i][z] || 0), 0);
    return { rotulo: f.rotulo, celulas: cruzamento.celulas[i], total, extra: cruzamento.unidadesFaixa[i] > 0 ? Math.round(total / cruzamento.unidadesFaixa[i]) : null };
  }).filter((l) => l.total > 0);
  const totalCruzamento = cruzamento.zonas.reduce((s, z) => s + (cruzamento.totaisZona[z] || 0), 0);
  const unidadesCruzamento = cruzamento.unidadesFaixa.reduce((s, v) => s + v, 0);

  const kpiItens = [
    { rotulo: "Total de pacotes", valor: kpis.pacotes != null ? formatNumero(kpis.pacotes) : "—", grande: true, apoio: kpis.pacotes != null ? "da planilha Report" : "planilha Report indisponível" },
    { rotulo: "TOs em staging", valor: formatNumero(kpis.totalTOs), cor: "#FA4C00", apoio: kpis.gaiolas ? `+ ${kpis.gaiolas} gaiolas` : "agora" },
    { rotulo: "Ruas ativas", valor: formatNumero(ativas.length), cor: "#3B82F6", apoio: "com TOs alocadas" },
    { rotulo: "Maior aging", valor: kpis.maior ? fmtDur(kpis.maior.aging) : "—", cor: kpis.maior ? corAging(kpis.maior.aging) : undefined, apoio: kpis.maior?.nome || "—" },
    { rotulo: "Aging médio", valor: kpis.media ? fmtDur(Math.round(kpis.media)) : "—", cor: "#F59E0B", apoio: "nas ruas ativas" },
    { rotulo: "Pacotes por TO", valor: kpis.porTo != null ? formatNumero(kpis.porTo) : "—", cor: "#8B5CF6", apoio: kpis.gaiolas ? "TOs + gaiolas" : "SPP médio" },
  ];

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Stage IN"
            subtitulo={dados ? `Inbound Staging Area · ruas, aging e pacotes · ${dados.estacao.nome.replace(/_/g, " ")}` : "Inbound Staging Area · ruas, aging e pacotes"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar o Stage IN."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando o Stage IN" className="space-y-4">
              <Esqueleto className="h-10" />
              <Esqueleto className="h-32" />
              <Esqueleto className="h-64" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              <StatusSincronizacao estado={estadoSync} detalhe={detalheSync} proxima={proxima} />
              {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
              {estadoSync === "atrasado" && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}
              {!temReport && <Aviso tipo="alerta">{relatorio?.erro || "A planilha de Report não está disponível."} As contagens de pacotes ficam de fora até ela voltar.</Aviso>}

              {ruas.length === 0 ? (
                <div className="rounded-2xl border border-default bg-surface">
                  <EstadoVazio
                    icone={<Layers size={30} aria-hidden="true" />}
                    titulo="Aguardando sincronização"
                    descricao="O Tampermonkey ainda não enviou as ruas do Inbound Staging Area desta estação. Instale ou atualize o script stage_in_sync no computador da operação."
                  />
                </div>
              ) : (
                <>
                  <AbasZona abas={abas} valor={zonaValida || TODAS} onChange={(z) => { setZonaAtiva(z); setPagina(1); }} />

                  <FaixaIndicadores rotulo="Indicadores do Stage IN" itens={kpiItens} />

                  {cardsZona.length > 0 && (
                    <Secao titulo="Visão por zona" subtitulo={temReport ? "Distribuição de pacotes por zona e faixa de aging" : "Distribuição de TOs por zona e faixa de aging"} indice={1}>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                        {cardsZona.map((z) => {
                          const media = z.agings.length ? z.agings.reduce((s, v) => s + v, 0) / z.agings.length : 0;
                          const pico = z.agings.length ? Math.max(...z.agings) : 0;
                          const spp = z.pacotes != null && z.tos + z.gaiolas > 0 ? Math.round(z.pacotes / (z.tos + z.gaiolas)) : null;
                          return (
                            <CardZona
                              key={z.nome}
                              nome={z.nome}
                              cor={cores[z.nome]}
                              valor={formatNumero(z.pacotes ?? z.tos)}
                              unidade={z.pacotes != null ? "pacotes" : "TOs"}
                              metricas={[
                                ...(z.pacotes != null ? [{ rotulo: "TOs", valor: `${z.tos}${z.gaiolas ? ` + ${z.gaiolas} CG` : ""}` }] : []),
                                ...(spp != null ? [{ rotulo: "SPP", valor: spp }] : []),
                                ...(z.spps.length ? [{ rotulo: "máx", valor: Math.round(Math.max(...z.spps)) }, { rotulo: "mín", valor: Math.round(Math.min(...z.spps)) }] : []),
                                ...(media ? [{ rotulo: "média", valor: fmtDur(Math.round(media)) }] : []),
                                ...(pico ? [{ rotulo: "pico", valor: fmtDur(pico) }] : []),
                              ]}
                            />
                          );
                        })}
                      </div>
                      {linhasCruzamento.length > 0 && (
                        <div className="mt-5">
                          <TabelaCalor
                            primeiraColuna="Faixa de aging"
                            linhas={linhasCruzamento}
                            zonas={zonasCruzamento}
                            cores={cores}
                            totaisZona={cruzamento.totaisZona}
                            totalGeral={totalCruzamento}
                            extraRotulo={cruzamento.temReport ? "SPP" : undefined}
                            extraTotal={unidadesCruzamento > 0 ? Math.round(totalCruzamento / unidadesCruzamento) : null}
                          />
                        </div>
                      )}
                    </Secao>
                  )}

                  {perfil && (
                    <Secao titulo="Perfil de pacote" subtitulo="Tamanho dos pacotes nas TOs em staging (planilha de perfil)" indice={2}>
                      {perfil.vazio ? (
                        <p className="text-sm text-muted">Esta zona não possui classificação de perfil de pacote (PP/P/M/G/Bulky) na planilha de origem.</p>
                      ) : (
                        <>
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
                            {PERFIS.map((p) => (
                              <CardZona
                                key={p.chave}
                                nome={p.rotulo}
                                cor={p.cor}
                                valor={formatNumero(perfil.totais[p.chave])}
                                unidade="pacotes"
                                metricas={[{ rotulo: "do total", valor: `${perfil.total ? ((perfil.totais[p.chave] / perfil.total) * 100).toFixed(1).replace(".", ",") : "0,0"}%` }]}
                              />
                            ))}
                          </div>
                          <div className="mt-5">
                            <TabelaCalor
                              primeiraColuna="Perfil"
                              linhas={PERFIS.map((p, i) => ({ rotulo: p.rotulo, cor: p.cor, celulas: perfil.celulas[i], total: perfil.zonas.reduce((s, z) => s + perfil.celulas[i][z], 0) }))}
                              zonas={perfil.zonas.map((z) => ({ nome: z, apoio: `${formatNumero(perfil.totaisZona[z])} pcts` }))}
                              cores={cores}
                              totaisZona={perfil.totaisZona}
                              totalGeral={perfil.total}
                            />
                          </div>
                        </>
                      )}
                    </Secao>
                  )}

                  <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                    <PainelTop5 ruas={top5} cores={cores} indice={3} />
                    <PainelOcupacao linhas={ocupacao} cores={cores} indice={4} />
                    <div className="lg:col-span-2 2xl:col-span-1 flex flex-col [&>section]:flex-1">
                      <PainelTurno turnos={turnos} indice={5} />
                    </div>
                  </div>

                  <section aria-label="Detalhamento por rua" className="anim-in rounded-2xl border border-default bg-surface overflow-hidden" style={{ "--i": 6 }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap p-5">
                      <div>
                        <h2 className="text-sm font-semibold leading-tight">Detalhamento por rua</h2>
                        <p className="text-xs text-muted mt-1 tabular-nums">{formatNumero(visiveis.length)} ruas{zonaValida ? ` em ${zonaCurta(zonaValida)}` : ""} · clique na rua para ver as TOs</p>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                        <input
                          type="search"
                          value={busca}
                          onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                          placeholder="Buscar rua, zona ou operador"
                          aria-label="Buscar rua, zona ou operador"
                          className={`${INPUT} pl-9 pr-9`}
                        />
                        {busca && (
                          <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-page cursor-pointer ${FOCO}`}>
                            <X size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    {visiveis.length === 0 ? (
                      <EstadoVazio icone={<Search size={28} aria-hidden="true" />} titulo="Nenhuma rua encontrada" descricao="Ajuste a busca ou a zona selecionada." />
                    ) : (
                      <div className="overflow-x-auto scroll-tema">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-y border-default text-xs text-muted">
                              {COLUNAS.map((c) => {
                                const ativo = ordem.chave === c.chave;
                                return (
                                  <th key={c.chave} scope="col" aria-sort={ativo ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-4 py-2.5 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
                                    <button type="button" title={c.titulo} onClick={() => alternarOrdem(c.chave)} className={`inline-flex items-center gap-1 cursor-pointer hover:text-page rounded ${FOCO} ${ativo ? "text-page" : ""}`}>
                                      {c.rotulo}
                                      {ativo && (ordem.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                                    </button>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {daPagina.map((r) => {
                              const aberta = abertas.has(r.nome);
                              return (
                                <RuaLinha key={r.nome} r={r} aberta={aberta} cor={cores[r.zona]} onAlternar={() => alternarRua(r.nome)} perfilPorTo={dados.perfil?.porTo} />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {visiveis.length > 0 && (
                      <Paginacao total={visiveis.length} pagina={paginaAtual} porPagina={porPagina} onPagina={setPagina} onPorPagina={(n) => { setPorPagina(n); setPagina(1); }} />
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </MainLayout>
    </div>
  );
}

function RuaLinha({ r, aberta, cor, onAlternar, perfilPorTo }) {
  const num = "px-4 py-3 text-right tabular-nums";
  return (
    <>
      <tr className={`border-b border-default transition-colors hover:bg-surface-2/60 ${r.tos > 0 ? "" : "text-muted"}`}>
        <td className="px-4 py-3">
          <button type="button" onClick={onAlternar} aria-expanded={aberta} className={`inline-flex items-center gap-2 font-medium text-left whitespace-nowrap cursor-pointer rounded ${FOCO}`}>
            <ChevronRight size={14} aria-hidden="true" className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${aberta ? "rotate-90" : ""}`} />
            {r.nome}
          </button>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1" style={{ color: cor, background: `${cor}1f` }}>
            {zonaCurta(r.zona)}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {r.area ? (
            <span className="text-xs font-semibold rounded-md px-2 py-0.5" style={{ color: r.area.cor, background: `${r.area.cor}1f` }}>{r.area.rotulo}</span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className={`${num} ${r.tos > 0 ? "font-semibold" : ""}`}>{r.tos}</td>
        <td className={`${num} ${r.pacotes ? "font-semibold" : ""}`}>{r.pacotes != null ? formatNumero(r.pacotes) : "—"}</td>
        <td className={num}>{r.spp != null ? Math.round(r.spp) : "—"}</td>
        <td className={`${num} text-muted`}>{r.capacidade}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-32">
            <div role="img" aria-label={`Ocupação ${r.ocupacaoTexto}`} className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(r.ocupacao, 100)}%`, background: corOcupacao(r.ocupacao) }} />
            </div>
            <span className="text-xs tabular-nums text-muted whitespace-nowrap">{r.ocupacaoTexto}</span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap font-semibold tabular-nums" style={{ color: r.aging ? corAging(r.aging) : undefined }}>{fmtDur(r.aging)}</td>
        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{r.operador}</td>
      </tr>
      {aberta && (
        <tr className="border-b border-default bg-surface-2/40">
          <td colSpan={COLUNAS.length} className="px-6 py-4">
            <TosDaRua rua={r} perfilPorTo={perfilPorTo} />
          </td>
        </tr>
      )}
    </>
  );
}
