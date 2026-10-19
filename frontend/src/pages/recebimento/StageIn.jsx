import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, ChevronRight, Clock, Gauge, LayoutDashboard, Layers, Monitor, Package, Route, Search, Timer, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AbasPagina, AbasSegmentadas, Aviso, EstadoVazio, Esqueleto, PageHeader } from "../../components/mapaOperacional/ui";
import { FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { StageInAPI } from "../../services/stageIn";
import { FUSO } from "./filaUtils";
import { Paginacao, Pilula } from "./FilaPecas";
import { CardGrafico, Destaque, Kpi, KpiDestaque } from "./PrevisaoPecas";
import StageInOperacional from "./StageInOperacional";
import { AgingCritico, CardZona, ComposicaoPerfil, FiltroZona, GraficoAging, PainelOcupacao, PainelTop5, PainelTurno, TabelaCalor } from "./StageInPecas";
import { FAIXAS_AGING, PERFIS, agingCritico, corAging, corOcupacao, cruzamentoAging, fmtDur, mapaCoresZonas, montarRuas, naFaixa, resumoPerfil, zonaCurta } from "./stageInUtils";

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

function TosDaRua({ rua, perfilPorTo, faixa }) {
  if (!rua.tosRua.length) return <p className="text-sm text-muted px-1">Nenhuma TO na planilha para esta rua.</p>;
  // Com uma faixa de aging escolhida, as TOs dela vêm primeiro e ficam destacadas.
  const tos = [...rua.tosRua].sort((a, b) => (faixa ? Number(naFaixa(b, faixa)) - Number(naFaixa(a, faixa)) : 0) || b.agingH - a.agingH);
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
            <tr key={t.to} className={`border-t border-default ${naFaixa(t, faixa) ? "bg-[#FA4C00]/10" : ""}`}>
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
  const [visao, setVisao] = useState("painel");
  const [faixaCritica, setFaixaCritica] = useState(null);
  const [vistaAging, setVistaAging] = useState("grafico");
  const [vistaPerfil, setVistaPerfil] = useState("resumo");
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

  const critico = useMemo(() => agingCritico(naZona), [naZona]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = q ? disponiveis.filter((r) => [r.nome, r.zona, r.operador].some((v) => v.toLowerCase().includes(q))) : disponiveis;
    if (faixaCritica) lista = lista.filter((r) => r.tosRua.some((to) => naFaixa(to, faixaCritica)));
    return ordenar(lista, ordem.chave, ordem.asc);
  }, [disponiveis, busca, ordem, faixaCritica]);

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

  // Memoizados para o gráfico não reanimar a cada tick do relógio (a tela se redesenha todo segundo).
  const zonasCruzamento = useMemo(
    () =>
      cruzamento.zonas.map((z) => ({
        nome: z,
        apoio: relatorio?.porZona?.[z] ? `${formatNumero(relatorio.porZona[z].pacotes)} pcts` : `${formatNumero(cruzamento.totaisZona[z] || 0)} TOs`,
      })),
    [cruzamento, relatorio]
  );
  const linhasCruzamento = useMemo(
    () =>
      FAIXAS_AGING.map((f, i) => {
        const total = cruzamento.zonas.reduce((s, z) => s + (cruzamento.celulas[i][z] || 0), 0);
        return { rotulo: f.rotulo, celulas: cruzamento.celulas[i], total, extra: cruzamento.unidadesFaixa[i] > 0 ? Math.round(total / cruzamento.unidadesFaixa[i]) : null };
      }).filter((l) => l.total > 0),
    [cruzamento]
  );
  const totalCruzamento = cruzamento.zonas.reduce((s, z) => s + (cruzamento.totaisZona[z] || 0), 0);
  const unidadesCruzamento = cruzamento.unidadesFaixa.reduce((s, v) => s + v, 0);

  const totalZonas = abas[0]?.contagem || 0;
  const criticos = FAIXAS_AGING.reduce((s, f, i) => (f.min >= 46800 ? s + cruzamento.zonas.reduce((t, z) => t + (cruzamento.celulas[i][z] || 0), 0) : s), 0);
  const pico = linhasCruzamento.reduce((m, l) => (!m || l.total > m.total ? l : m), null);
  const unidadeCruzamento = cruzamento.temReport ? "pacotes" : "TOs";
  const rotuloAtual = zonaValida ? zonaCurta(zonaValida) : "Todas as zonas";

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
            <div aria-busy="true" aria-label="Carregando o Stage IN" className="space-y-6">
              <Esqueleto className="h-44" />
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <Esqueleto className="h-56 sm:col-span-3 xl:col-span-1" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
              </div>
              <Esqueleto className="h-72" />
              <Esqueleto className="h-64" />
            </div>
          ) : ruas.length === 0 ? (
            <div className="rounded-2xl border border-default bg-surface">
              <EstadoVazio
                icone={<Layers size={30} aria-hidden="true" />}
                titulo="Aguardando sincronização"
                descricao="O Tampermonkey ainda não enviou as ruas do Inbound Staging Area desta estação. Instale ou atualize o script stage_in_sync no computador da operação."
              />
            </div>
          ) : (
            <>
              <AbasPagina
                rotulo="Visão do Stage IN"
                valor={visao}
                onChange={setVisao}
                opcoes={[
                  { valor: "painel", rotulo: "Painel", icone: <LayoutDashboard size={15} aria-hidden="true" /> },
                  { valor: "operacional", rotulo: "Operacional", icone: <Monitor size={15} aria-hidden="true" /> },
                ]}
              />

              {visao === "operacional" ? (
                <>
                  {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
                  {estadoSync === "atrasado" && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}
                  <StageInOperacional ruas={ruas} cores={cores} relatorio={relatorio} sincronizacao={{ estado: estadoSync, detalhe: detalheSync, proxima }} />
                </>
              ) : (
              <>
              {/* ---------- zona e sincronização ---------- */}
              <FiltroZona
                abas={abas}
                valor={zonaValida || TODAS}
                onChange={(z) => { setZonaAtiva(z); setPagina(1); }}
                rotuloAtual={rotuloAtual}
                sincronizacao={{ estado: estadoSync, detalhe: detalheSync, proxima }}
              />

              {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
              {estadoSync === "atrasado" && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}
              {!temReport && <Aviso tipo="alerta">{relatorio?.erro || "A planilha de Report não está disponível."} As contagens de pacotes ficam de fora até ela voltar.</Aviso>}

              {/* ---------- indicadores ---------- */}
              <section aria-label="Indicadores do Stage IN" className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <KpiDestaque
                  className="sm:col-span-3 xl:col-span-1"
                  indice={0}
                  icone={<Package size={20} />}
                  rotulo="Total de pacotes no staging"
                  valor={kpis.pacotes != null ? formatNumero(kpis.pacotes) : "—"}
                  apoio={kpis.pacotes != null ? `da planilha Report · ${rotuloAtual.toLowerCase()}` : "planilha Report indisponível"}
                  extras={[
                    { icone: <Boxes size={13} />, rotulo: "TOs em staging", valor: formatNumero(kpis.totalTOs) },
                    { icone: <Route size={13} />, rotulo: "Ruas ativas", valor: formatNumero(ativas.length) },
                  ]}
                />
                <Kpi
                  indice={1}
                  icone={<Gauge size={16} />}
                  rotulo="Maior aging"
                  valor={kpis.maior ? fmtDur(kpis.maior.aging) : "—"}
                  tom={kpis.maior ? corAging(kpis.maior.aging) : "#8B8B93"}
                  corValor={kpis.maior ? corAging(kpis.maior.aging) : undefined}
                  apoio={kpis.maior ? kpis.maior.nome : "nenhuma rua com TOs"}
                />
                <Kpi indice={2} icone={<Clock size={16} />} rotulo="Aging médio" valor={kpis.media ? fmtDur(Math.round(kpis.media)) : "—"} tom="#F59E0B" apoio="nas ruas com TOs" />
                <Kpi
                  indice={3}
                  icone={<Package size={16} />}
                  rotulo="Pacotes por TO"
                  valor={kpis.porTo != null ? formatNumero(kpis.porTo) : "—"}
                  tom="#8B5CF6"
                  apoio={kpis.gaiolas ? `${formatNumero(kpis.totalTOs)} TOs + ${kpis.gaiolas} gaiolas` : "SPP médio do staging"}
                />
              </section>

              {/* ---------- visão por zona ---------- */}
              {cardsZona.length > 0 && (
                <CardGrafico icone={<Layers size={17} />} titulo="Visão por zona" subtitulo={temReport ? "Pacotes em cada zona, com SPP e aging das ruas" : "TOs em cada zona, com aging das ruas"} indice={1}>
                  <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))]">
                    {cardsZona.map((z) => {
                      const media = z.agings.length ? z.agings.reduce((s, v) => s + v, 0) / z.agings.length : 0;
                      const maior = z.agings.length ? Math.max(...z.agings) : 0;
                      const spp = z.pacotes != null && z.tos + z.gaiolas > 0 ? Math.round(z.pacotes / (z.tos + z.gaiolas)) : null;
                      return (
                        <CardZona
                          key={z.nome}
                          nome={z.nome}
                          cor={cores[z.nome]}
                          valor={formatNumero(z.pacotes ?? z.tos)}
                          unidade={z.pacotes != null ? "pacotes" : "TOs"}
                          participacao={totalZonas > 0 ? ((z.pacotes ?? z.tos) / totalZonas) * 100 : null}
                          metricas={[
                            ...(z.pacotes != null ? [{ rotulo: "TOs", valor: `${z.tos}${z.gaiolas ? ` + ${z.gaiolas} CG` : ""}` }] : []),
                            ...(spp != null ? [{ rotulo: "SPP", valor: spp }] : []),
                            ...(z.spps.length ? [{ rotulo: "máx", valor: Math.round(Math.max(...z.spps)) }, { rotulo: "mín", valor: Math.round(Math.min(...z.spps)) }] : []),
                            ...(media ? [{ rotulo: "média", valor: fmtDur(Math.round(media)) }] : []),
                            ...(maior ? [{ rotulo: "pico", valor: fmtDur(maior) }] : []),
                          ]}
                        />
                      );
                    })}
                  </div>
                </CardGrafico>
              )}

              {/* ---------- aging ---------- */}
              {linhasCruzamento.length > 0 && (
                <CardGrafico
                  icone={<Timer size={17} />}
                  titulo="Aging do staging"
                  subtitulo={`${unidadeCruzamento === "pacotes" ? "Pacotes" : "TOs"} por faixa de tempo parado, por zona`}
                  indice={2}
                  legenda={
                    <div className="w-full sm:w-56">
                      <AbasSegmentadas rotulo="Visualização do aging" valor={vistaAging} onChange={setVistaAging} opcoes={[{ valor: "grafico", rotulo: "Gráfico" }, { valor: "tabela", rotulo: "Tabela" }]} />
                    </div>
                  }
                  destaques={
                    <>
                      <Destaque rotulo="Acima de 13h" valor={`${formatNumero(criticos)} ${unidadeCruzamento} · ${totalCruzamento ? Math.round((criticos / totalCruzamento) * 100) : 0}%`} cor={criticos > 0 ? "#FF453A" : undefined} />
                      {pico && <Destaque rotulo="Faixa com mais" valor={`${pico.rotulo} · ${formatNumero(pico.total)}`} />}
                    </>
                  }
                >
                  {vistaAging === "grafico" ? (
                    <GraficoAging linhas={linhasCruzamento} zonas={zonasCruzamento} cores={cores} />
                  ) : (
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
                  )}
                </CardGrafico>
              )}

              {/* ---------- criticidade de aging ---------- */}
              {critico && <AgingCritico info={critico} ativa={faixaCritica} onSelecionar={(f) => { setFaixaCritica(f); setPagina(1); }} indice={3} />}

              {/* ---------- perfil de pacote ---------- */}
              {perfil && (
                <CardGrafico
                  icone={<Boxes size={17} />}
                  titulo="Perfil de pacote"
                  subtitulo="Tamanho dos pacotes nas TOs em staging (planilha de perfil)"
                  indice={3}
                  legenda={
                    !perfil.vazio && (
                      <div className="w-full sm:w-56">
                        <AbasSegmentadas rotulo="Visualização do perfil" valor={vistaPerfil} onChange={setVistaPerfil} opcoes={[{ valor: "resumo", rotulo: "Resumo" }, { valor: "zonas", rotulo: "Por zona" }]} />
                      </div>
                    )
                  }
                >
                  {perfil.vazio ? (
                    <p className="text-sm text-muted">Esta zona não possui classificação de perfil de pacote (PP/P/M/G/Bulky) na planilha de origem.</p>
                  ) : vistaPerfil === "resumo" ? (
                    <ComposicaoPerfil perfis={PERFIS} totais={perfil.totais} total={perfil.total} />
                  ) : (
                    <TabelaCalor
                      primeiraColuna="Perfil"
                      linhas={PERFIS.map((p, i) => ({ rotulo: p.rotulo, cor: p.cor, celulas: perfil.celulas[i], total: perfil.zonas.reduce((s, z) => s + perfil.celulas[i][z], 0) }))}
                      zonas={perfil.zonas.map((z) => ({ nome: z, apoio: `${formatNumero(perfil.totaisZona[z])} pcts` }))}
                      cores={cores}
                      totaisZona={perfil.totaisZona}
                      totalGeral={perfil.total}
                    />
                  )}
                </CardGrafico>
              )}

              {/* ---------- apoio ---------- */}
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                <PainelTop5 ruas={top5} cores={cores} indice={4} />
                <PainelOcupacao linhas={ocupacao} cores={cores} indice={5} />
                <div className="lg:col-span-2 2xl:col-span-1 flex flex-col [&>section]:flex-1">
                  <PainelTurno turnos={turnos} indice={6} />
                </div>
              </div>

              {/* ---------- detalhamento por rua ---------- */}
              <section aria-label="Detalhamento por rua" className="anim-in rounded-2xl border border-default bg-surface overflow-hidden" style={{ "--i": 7 }}>
                <div className="flex items-center justify-between gap-3 flex-wrap p-5">
                  <div className="flex items-start gap-3 min-w-0">
                    <span aria-hidden="true" className="grid place-items-center w-9 h-9 rounded-xl bg-[#FA4C00]/12 text-[#FA4C00] shrink-0">
                      <Route size={17} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold leading-tight">Detalhamento por rua</h2>
                      <p className="text-xs text-muted mt-1 tabular-nums" aria-live="polite">
                        <b className="text-page">{formatNumero(visiveis.length)}</b> {visiveis.length === 1 ? "rua" : "ruas"}{zonaValida ? ` em ${zonaCurta(zonaValida)}` : ""} · clique na rua para ver as TOs
                      </p>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <label htmlFor="si-busca" className="sr-only">Buscar rua, zona ou operador</label>
                    <Search size={15} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input id="si-busca" type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar rua, zona ou operador…" className={`${INPUT} pl-10 pr-10`} />
                    {busca && (
                      <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-page cursor-pointer ${FOCO}`}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {faixaCritica && (
                  <div className="mx-5 mb-4 flex items-center gap-3 flex-wrap rounded-xl border border-[#FA4C00]/40 bg-[#FA4C00]/8 px-4 py-2.5 text-sm">
                    <span>
                      Filtro de aging: <b>{faixaCritica.rotulo}</b> <span className="text-muted">· só as ruas com TOs nessa faixa; as TOs ficam destacadas ao abrir a rua</span>
                    </span>
                    <button type="button" onClick={() => { setFaixaCritica(null); setPagina(1); }} className={`ml-auto h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-[#FA4C00] hover:bg-[#FA4C00]/10 cursor-pointer ${FOCO}`}>
                      <X size={14} aria-hidden="true" /> Limpar filtro
                    </button>
                  </div>
                )}

                {visiveis.length === 0 ? (
                  <EstadoVazio icone={<Search size={28} aria-hidden="true" />} titulo="Nenhuma rua encontrada" descricao="Ajuste a busca, a faixa de aging ou a zona selecionada." />
                ) : (
                  <div className="overflow-x-auto scroll-tema">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-default bg-surface-2/40 text-xs text-muted">
                          {COLUNAS.map((c) => {
                            const ativo = ordem.chave === c.chave;
                            return (
                              <th key={c.chave} scope="col" aria-sort={ativo ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-3 py-2.5 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
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
                        {daPagina.map((r) => (
                          <RuaLinha key={r.nome} r={r} aberta={abertas.has(r.nome)} cor={cores[r.zona]} onAlternar={() => alternarRua(r.nome)} perfilPorTo={dados.perfil?.porTo} faixa={faixaCritica} />
                        ))}
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

function RuaLinha({ r, aberta, cor, onAlternar, perfilPorTo, faixa }) {
  const num = "px-3 py-3 text-right tabular-nums";
  return (
    <>
      <tr className={`border-b border-default transition-colors hover:bg-surface-2/60 ${r.tos > 0 ? "" : "text-muted"}`}>
        <td className="px-3 py-3">
          <button type="button" onClick={onAlternar} aria-expanded={aberta} className={`inline-flex items-center gap-2 font-medium text-left whitespace-nowrap cursor-pointer rounded ${FOCO}`}>
            <ChevronRight size={14} aria-hidden="true" className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${aberta ? "rotate-90" : ""}`} />
            {r.nome}
          </button>
          {r.operador !== "—" && <span className="block pl-6 text-[11px] text-muted truncate max-w-48" title={`Operador: ${r.operador}`}>{r.operador}</span>}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
            {zonaCurta(r.zona)}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          {r.area ? (
            <Pilula cor={r.area.cor}>{r.area.rotulo}</Pilula>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className={`${num} ${r.tos > 0 ? "font-semibold" : ""}`}>{r.tos}</td>
        <td className={`${num} ${r.pacotes ? "font-semibold" : ""}`}>{r.pacotes != null ? formatNumero(r.pacotes) : "—"}</td>
        <td className={num}>{r.spp != null ? Math.round(r.spp) : "—"}</td>
        <td className={`${num} text-muted`}>{r.capacidade}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-24">
            <div role="img" aria-label={`Ocupação ${r.ocupacaoTexto}`} className="h-1.5 w-14 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(r.ocupacao, 100)}%`, background: corOcupacao(r.ocupacao) }} />
            </div>
            <span className="text-xs tabular-nums text-muted whitespace-nowrap">{r.ocupacaoTexto}</span>
          </div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap tabular-nums">{r.aging ? <Pilula cor={corAging(r.aging)} icone={<Clock size={11} aria-hidden="true" />}>{fmtDur(r.aging)}</Pilula> : <span className="text-muted">—</span>}</td>
      </tr>
      {aberta && (
        <tr className="border-b border-default bg-surface-2/40">
          <td colSpan={COLUNAS.length} className="px-6 py-4">
            <TosDaRua rua={r} perfilPorTo={perfilPorTo} faixa={faixa} />
          </td>
        </tr>
      )}
    </>
  );
}
