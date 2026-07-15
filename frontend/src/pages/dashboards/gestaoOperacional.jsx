import { useState, useEffect, useRef, useContext } from "react";
import { useEstacao } from "../../context/EstacaoContext";
import { useNavigate } from "react-router-dom";
import { Calendar, Package, Send, X, ArrowLeftRight } from "lucide-react";
import api from "../../services/api";
import { useTurnosOperacionais } from "../../hooks/useTurnosOperacionais";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ProducaoChart from "../../components/gestaoOperacional/ProducaoChart";
import AlertaSalvamentoPendente from "../../components/gestaoOperacional/AlertaSalvamentoPendente";
import domtoimage from "dom-to-image-more";
import toast from "react-hot-toast";
import MainLayout from "../../components/MainLayout";
import { AuthContext } from "../../context/AuthContext";
// import CapacidadeTable from "../../components/gestaoOperacional/CapacidadeTable"; // Comentado - será usado futuramente

// Retorna a data padrão para o turno selecionado.
// T3 começa às 22h: se ainda não chegou às 22h, o "T3 ativo" é o de ontem.
function getDataDefaultParaTurno(nomeTurno) {
  const agora = new Date();
  if (nomeTurno === "T3" && agora.getHours() < 22) {
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    return ontem.toISOString().slice(0, 10);
  }
  return agora.toISOString().slice(0, 10);
}

export default function GestaoOperacional() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [turno, setTurno] = useState("T1");
  const [data, setData] = useState(() => getDataDefaultParaTurno("T1"));
  const { turnos: turnosOperacionais } = useTurnosOperacionais();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviandoScreenshot, setEnviandoScreenshot] = useState(false);
  const [desabilitarAnimacoes, setDesabilitarAnimacoes] = useState(false);
  const [ocultarHeader, setOcultarHeader] = useState(false);
  const [modalSeatalkConfig, setModalSeatalkConfig] = useState(false);
  const mainContentRef = useRef(null);
  const { estacaoId } = useEstacao();
  const { permissions } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = permissions?.isAdmin;
  const podeTrocarFonteProducao = permissions?.isAdmin || permissions?.isAltaGestao;
  const [fonteProducao, setFonteProducao] = useState("PRIMARY");
  const [trocandoFonte, setTrocandoFonte] = useState(false);

  useEffect(() => {
    if (turnosOperacionais.length > 0 && !turnosOperacionais.find((t) => t.nomeTurno === turno)) {
      setTurno(turnosOperacionais[0].nomeTurno);
    }
  }, [turnosOperacionais]);

  // Contador regressivo em segundos até liberar o botão Seatalk
  const [segundosParaSeatalk, setSegundosParaSeatalk] = useState(0);

  useEffect(() => {
    function calcularSegundos() {
      const agora = new Date();
      const min = agora.getMinutes();
      const seg = agora.getSeconds();
      if (min >= 5) return 0;
      return (5 - min) * 60 - seg;
    }

    setSegundosParaSeatalk(calcularSegundos());
    const timer = setInterval(() => {
      setSegundosParaSeatalk(calcularSegundos());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatarContador(segundos) {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    console.log("🔄 useEffect disparado - Filtros atualizados:", { data, turno });
    carregarDados();
    
    // Atualização automática a cada 35 segundos (alinhado com a planilha OnTime)
    const intervalo = setInterval(() => {
      carregarDados();
    }, 35000);
    
    // Limpar intervalo ao desmontar ou quando filtros mudarem
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, turno, estacaoId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro(null);
      
      console.log("🔄 Carregando dados com filtros:", { data, turno });
      console.log("🔑 Token no localStorage:", localStorage.getItem("token") ? "Presente" : "Ausente");
      console.log("📡 Enviando para API → params:", { data, turno });
      
      const response = await api.get("/dashboard/gestao-operacional", {
        params: { data, turno }
      });
      
      console.log("✅ Resposta recebida:", response.data);
      
      if (response.data.success) {
        const d = response.data.data;
        console.log("📊 [FRONTEND] producaoPorHora recebido:");
        (d.producaoPorHora || []).forEach(p => {
          console.log(`  h${p.hora}: meta=${p.meta}, realizado=${p.realizado}, %=${p.percentual}`);
        });
        console.log("📊 [FRONTEND] kpis:", d.kpis);
        setDashboardData(d);
        if (d.fonteProducaoAtiva) setFonteProducao(d.fonteProducaoAtiva);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dashboard:", error);
      console.error("📋 Resposta do servidor:", error.response?.data);
      console.error("📊 Status:", error.response?.status);

      const code = error.response?.data?.code;
      if (code === 'SHEETS_NOT_CONFIGURED') {
        setErro('SHEETS_NOT_CONFIGURED');
      } else {
        const mensagemErro = error.response?.data?.message || 
                            error.response?.data?.error || 
                            "Erro ao carregar dados";
        setErro(mensagemErro);
      }
    } finally {
      setLoading(false);
    }
  };


  const trocarFonteProducao = async () => {
    const novaFonte = fonteProducao === "BACKUP" ? "PRIMARY" : "BACKUP";
    const labelNovaFonte = novaFonte === "BACKUP" ? "BACKUP (db30s)" : "PRINCIPAL (ProdutividadeSPX)";

    if (!window.confirm(`Trocar a base de produção para ${labelNovaFonte}? Isso afeta a tela de todos os usuários.`)) {
      return;
    }

    try {
      setTrocandoFonte(true);
      toast.loading("Trocando base e ressincronizando dados...", { id: "trocar-fonte" });
      const response = await api.put("/dashboard/gestao-operacional/fonte-producao", {
        fonte: novaFonte,
        turno,
        data,
      });
      if (response.data.success) {
        setFonteProducao(response.data.data.fonte);
        toast.success(`Base de produção alterada para ${labelNovaFonte}`, { id: "trocar-fonte" });
        await carregarDados();
      }
    } catch (error) {
      const mensagemErro = error.response?.data?.message || "Erro ao trocar base de produção";
      toast.error(mensagemErro, { id: "trocar-fonte" });
    } finally {
      setTrocandoFonte(false);
    }
  };

  const enviarScreenshotParaSeatalk = async () => {
    if (segundosParaSeatalk > 0) {
      toast.error(`Aguarde ${formatarContador(segundosParaSeatalk)} para enviar.`);
      return;
    }

    // Pre-check: verificar se o grupo Seatalk está configurado antes de iniciar o processo
    try {
      const check = await api.get("/reports/seatalk/check");
      if (!check.data?.configured) {
        setModalSeatalkConfig(true);
        return;
      }
    } catch {
      setModalSeatalkConfig(true);
      return;
    }

    try {
      setEnviandoScreenshot(true);
      
      console.log("🚀 Iniciando processo de screenshot...");
      toast.loading("Preparando screenshot...", { id: "screenshot" });
      
      // Ocultar o header com filtros
      setOcultarHeader(true);
      // Desabilitar animações do gráfico
      setDesabilitarAnimacoes(true);
      console.log("👁️ Header ocultado, animações desabilitadas");
      
      // Aguardar 12 segundos para garantir que todos os gráficos estejam renderizados
      console.log("⏳ Aguardando 12 segundos para renderização completa...");
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      toast.loading("Capturando tela...", { id: "screenshot" });
      console.log("📸 Capturando screenshot...");
      
      // Capturar diretamente o elemento original
      const original = mainContentRef.current;
      
      if (!original) {
        throw new Error("Elemento não encontrado para captura");
      }
      
      // Salvar padding original
      const originalPadding = original.style.padding;
      
      // Remover padding temporariamente
      original.style.padding = "0";
      
      // Salvar estilos originais das bordas
      const elementsWithBorders = [];
      original.querySelectorAll("*").forEach(el => {
        const originalBorder = el.style.border;
        const originalOutline = el.style.outline;
        if (originalBorder || originalOutline) {
          elementsWithBorders.push({ el, originalBorder, originalOutline });
        }
        el.style.border = "none";
        el.style.outline = "none";
      });
      
      // Aguardar um pouco para garantir que as mudanças foram aplicadas
      await new Promise(r => setTimeout(r, 100));
      
      // Forçar reflow
      original.offsetHeight;
      
      // Capturar o screenshot do elemento original
      const imageBase64 = await domtoimage.toPng(original, {
        bgcolor: "#0D0D0D",
        quality: 1,
        cacheBust: true,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          border: "none",
          outline: "none",
          margin: "0",
          padding: "0",
        },
      });
      
      // Restaurar padding original
      original.style.padding = originalPadding;
      
      // Restaurar bordas originais
      elementsWithBorders.forEach(({ el, originalBorder, originalOutline }) => {
        el.style.border = originalBorder;
        el.style.outline = originalOutline;
      });
      
      console.log("✅ Screenshot capturado com sucesso");
      const imageSizeKB = Math.round(imageBase64.length / 1024);
      const imageSizeMB = (imageSizeKB / 1024).toFixed(2);
      console.log("📦 Imagem convertida para base64");
      console.log("📏 Tamanho:", imageSizeKB, "KB (", imageSizeMB, "MB)");
      
      // Verificar tamanho da imagem
      if (imageSizeKB > 10240) {
        toast.error(`Imagem muito grande (${imageSizeMB}MB). Limite: 10MB`, { id: "screenshot" });
        return;
      }
      
      toast.loading("Enviando para Seatalk...", { id: "screenshot" });
      
      // Formatar período
      const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
      
      console.log("📅 Data formatada:", dataFormatada);
      console.log("🕐 Turno:", turno);
      
      // Enviar para o backend
      console.log("🌐 Enviando para API...");
      const response = await api.post("/reports/seatalk", {
        image: imageBase64,
        periodo: dataFormatada,
        turno: turno,
        reportType: "gestaoOperacional" // Identifica o tipo de relatório
      });
      
      console.log("✅ Resposta da API:", response.data);
      toast.success("Screenshot enviado com sucesso!", { id: "screenshot" });
      
    } catch (error) {
      console.error("❌ Erro ao enviar screenshot:", error);
      
      // Log detalhado do erro
      if (error.response) {
        console.error("📋 Status:", error.response.status);
        console.error("📋 Dados:", error.response.data);
        console.error("📋 Headers:", error.response.headers);
      } else if (error.request) {
        console.error("📋 Nenhuma resposta recebida");
      } else {
        console.error("📋 Erro:", error.message);
      }
      
      // Mensagem de erro mais descritiva
      let errorMessage = "Erro ao enviar screenshot";
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { id: "screenshot", duration: 5000 });
    } finally {
      console.log("🔄 Restaurando elementos");
      setOcultarHeader(false);
      setDesabilitarAnimacoes(false);
      setEnviandoScreenshot(false);
    }
  };

  // Skeleton apenas na carga inicial (sem dados ainda)
  if (loading && !dashboardData) {
    return (
      <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <MainLayout>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1600px] mx-auto">
            {/* Header skeleton */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-36 bg-surface-2 animate-pulse rounded-lg" />
                <div className="h-5 w-24 bg-surface-2 animate-pulse rounded" />
              </div>
              <div className="flex gap-2">
                {["T1","T2","T3"].map(t => (
                  <div key={t} className="h-9 w-12 bg-surface-2 animate-pulse rounded-lg" />
                ))}
                <div className="h-9 w-32 bg-surface-2 animate-pulse rounded-lg" />
              </div>
            </div>

            {/* KPI cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-surface border border-default rounded-lg p-5 space-y-3">
                  <div className="h-3 w-28 bg-surface-2 animate-pulse rounded" />
                  <div className="h-8 w-40 bg-surface-2 animate-pulse rounded" />
                </div>
              ))}
            </div>

            {/* Banner skeleton */}
            <div className="h-24 bg-surface-2 animate-pulse rounded-xl" />

            {/* Performance skeleton */}
            <div className="bg-surface border border-default rounded-lg p-6 flex gap-8">
              <div className="w-32 h-32 rounded-full bg-surface-2 animate-pulse shrink-0" />
              <div className="flex-1 space-y-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-40 bg-surface-2 animate-pulse rounded" />
                    <div className="h-4 w-20 bg-surface-2 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Chart skeleton */}
            <div className="bg-surface border border-default rounded-lg p-6">
              <div className="h-5 w-40 bg-surface-2 animate-pulse rounded mb-6" />
              <div className="h-64 bg-surface-2 animate-pulse rounded-lg" />
            </div>
          </main>
        </MainLayout>
      </div>
    );
  }

  if (erro) {
    if (erro === 'SHEETS_NOT_CONFIGURED') {
      return (
        <div className="flex min-h-screen bg-page text-page">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <MainLayout>
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex flex-col items-center justify-center h-[80vh] gap-6 text-center px-4">
              <div className="w-20 h-20 rounded-full bg-surface border border-default flex items-center justify-center">
                <span className="text-4xl">🔧</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Funcionalidade em configuração</h2>
                <p className="text-muted text-sm max-w-sm">
                  A planilha de produtividade desta estação ainda está sendo configurada.
                  Em breve os dados estarão disponíveis aqui.
                </p>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-[#FA4C00]/10 border border-[#FA4C00]/30 text-[#FA4C00] text-xs font-medium">
                Em breve
              </div>
            </div>
          </MainLayout>
        </div>
      );
    }

    return (
      <div className="h-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">Erro</div>
          <div className="text-muted">{erro}</div>
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  // meta de produtividade: lida da planilha (coluna C do sheet "Meta"), padrão 770
  const metaProdutividadeTarget = kpis.metaProdutividade > 0 ? kpis.metaProdutividade : 770;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Modal: Grupo Seatalk não configurado */}
      {modalSeatalkConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalSeatalkConfig(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-default rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                </div>
                <h3 className="text-base font-semibold text-page">Grupo Seatalk não configurado</h3>
              </div>
              <button onClick={() => setModalSeatalkConfig(false)} className="text-muted hover:text-page transition">
                <X size={18} />
              </button>
            </div>

            {isAdmin ? (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Nenhum grupo Seatalk está configurado para esta estação. Configure o ID do grupo em <strong className="text-page">Organização &rsaquo; Estações</strong>.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setModalSeatalkConfig(false)}
                    className="px-4 py-2 rounded-xl bg-surface-2 text-sm text-muted hover:text-page transition"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => { setModalSeatalkConfig(false); navigate("/estacoes"); }}
                    className="px-4 py-2 rounded-xl bg-[#FA4C00] text-sm text-white font-medium hover:bg-[#FF5A1A] transition"
                  >
                    Configurar agora
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Nenhum grupo Seatalk está configurado para esta estação. Entre em contato com o administrador para realizar a configuração.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setModalSeatalkConfig(false)}
                    className="px-4 py-2 rounded-xl bg-surface-2 text-sm text-muted hover:text-page transition"
                  >
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Alerta de Salvamento Pendente */}
      <AlertaSalvamentoPendente />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main ref={mainContentRef} className="p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1600px] mx-auto">
          {/* Header com Badge PACKING e Filtros */}
          {!ocultarHeader && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-[#E8491D] px-6 py-3 rounded-lg flex items-center gap-2">
                <Package className="w-6 h-6" />
                <span className="text-xl font-bold">PACKING</span>
              </div>
              {/* Indicador de filtros ativos */}
              <div className="text-sm text-muted flex items-center gap-2">
                <span className="font-semibold text-page">{turno}</span> | {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}
                {loading && (
                  <div className="flex items-center gap-2 ml-2">
                    <div className="w-4 h-4 border-2 border-[#E8491D] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-[#E8491D]">Atualizando...</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Botão de trocar base de produção (ProdutividadeSPX <-> db30s) — só ADMIN/ALTA_GESTAO */}
              {podeTrocarFonteProducao && (
                <button
                  onClick={trocarFonteProducao}
                  disabled={trocandoFonte || loading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    fonteProducao === "BACKUP"
                      ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20"
                      : "bg-surface border-default text-muted hover:text-page"
                  }`}
                  title={
                    fonteProducao === "BACKUP"
                      ? "Base de backup (db30s) ativa — clique para voltar à principal"
                      : "Base principal (ProdutividadeSPX) ativa — clique para trocar para o backup"
                  }
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {trocandoFonte ? "Trocando..." : fonteProducao === "BACKUP" ? "Usando Backup" : "Trocar base"}
                </button>
              )}

              {/* Botão de enviar screenshot para Seatalk */}
              {(() => {
                const bloqueado = segundosParaSeatalk > 0;
                return (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => enviarScreenshotParaSeatalk()}
                      disabled={enviandoScreenshot || loading || bloqueado}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#5A5A5C] disabled:cursor-not-allowed cursor-pointer rounded-lg text-white text-sm font-semibold transition-colors flex items-center gap-2"
                      title={bloqueado ? `Disponível em ${formatarContador(segundosParaSeatalk)}` : "Enviar screenshot para Seatalk"}
                    >
                      <Send className="w-4 h-4" />
                      {enviandoScreenshot ? "Enviando..." : "Enviar para Seatalk"}
                    </button>
                    {bloqueado && (
                      <span className="text-xs text-yellow-400">
                        Disponível em {formatarContador(segundosParaSeatalk)}
                      </span>
                    )}
                  </div>
                );
              })()}
              
              {/* Filtro de Turno */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Turno:</label>
                <select
                  value={turno}
                  onChange={(e) => {
                    const novoTurno = e.target.value;
                    setTurno(novoTurno);
                    setData(getDataDefaultParaTurno(novoTurno));
                  }}
                  className="px-4 py-2 bg-surface border border-default rounded-lg text-page"
                >
                  {turnosOperacionais.map((t) => (
                    <option key={t.idTurno} value={t.nomeTurno}>{t.nomeTurno}</option>
                  ))}
                </select>
              </div>

              {/* Filtro de Data */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    id="data-picker"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="px-4 py-2 pr-10 bg-surface border border-default rounded-lg text-page"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("data-picker").showPicker()}
                    className="absolute right-2 text-muted hover:text-page transition-colors"
                    tabIndex={-1}
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* KPIs Header - Estilo da imagem */}
          <div className="bg-surface border border-default rounded-lg overflow-hidden shadow-lg">
            {/* Indicador de Turno e Data */}
            <div className="bg-surface-2 px-6 py-2 text-center">
              <span className="text-sm text-muted">
                Dados de: <span className="font-bold text-page">{dashboardData?.turno || turno}</span> - {dashboardData?.dataReferencia ? new Date(dashboardData.dataReferencia + 'T00:00:00').toLocaleDateString('pt-BR') : 'Carregando...'}
                {dashboardData?.ultimaAtualizacao && (
                  <span className="ml-4 text-xs opacity-75">
                    | Última atualização da planilha: {new Date(dashboardData.ultimaAtualizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                {fonteProducao === "BACKUP" && (
                  <span className="ml-4 text-xs font-semibold text-yellow-400">
                    ⚠️ Usando base de backup (db30s)
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-default">
              {/* Meta do Dia */}
              <div className="bg-surface text-page p-6 text-center">
                <div className="text-sm font-semibold text-muted mb-2">META DO DIA</div>
                <div className="text-4xl font-bold text-page">
                  {kpis.metaDia?.toLocaleString("pt-BR") || "0"}
                </div>
              </div>

              {/* Meta Hora Atual */}
              <div className="bg-surface text-page p-6 text-center">
                <div className="text-sm font-semibold text-muted mb-2">META HORA ATUAL {kpis.horaAtual !== undefined && `(${kpis.horaAtual}h)`}
                </div>
                <div className="text-4xl font-bold text-page">
                  {kpis.metaHoraAtual?.toLocaleString("pt-BR") || "0"}
                </div>
              </div>

              {/* Meta de Produtividade */}
              <div className="bg-surface text-page p-6 text-center">
                <div className="text-sm font-semibold text-muted mb-2">META DE PRODUTIVIDADE</div>
                <div className="text-4xl font-bold text-page">
                  {metaProdutividadeTarget.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Previsão - Separados por Dia e Hora */}
          {(() => {
            const realizado = kpis.realizado || 0;
            const metaDia = kpis.metaDia || 0;
            const metaHoraAtual = kpis.metaHoraAtual || 0;
            const horaAtual = kpis.horaAtual || 0;
            const mediaHoraRealizado = kpis.mediaHoraRealizado || 0;
            
            // Definir horas de trabalho por turno
            let horaInicio, totalHoras;
            if (turno === 'T1') {
              horaInicio = 6;
              totalHoras = 8;
            } else if (turno === 'T2') {
              horaInicio = 14;
              totalHoras = 8;
            } else { // T3
              horaInicio = 22;
              totalHoras = 8;
            }
            
            // Calcular horas trabalhadas
            let horasTrabalhadas;
            if (turno === 'T3') {
              if (horaAtual >= 22) {
                horasTrabalhadas = horaAtual - horaInicio;
              } else if (horaAtual < 6) {
                horasTrabalhadas = (24 - horaInicio) + horaAtual;
              } else {
                horasTrabalhadas = totalHoras;
              }
            } else {
              horasTrabalhadas = Math.max(0, Math.min(horaAtual - horaInicio, totalHoras));
            }
            
            // Calcular realizado e projeção da hora atual
            const producaoHoraAtual = dashboardData?.producaoPorHora?.find(p => parseInt(p.hora) === horaAtual)?.realizado || 0;
            
            // Calcular projeção da hora
            const minutosAtuais = new Date().getMinutes();
            const ritmoPorMinuto = minutosAtuais > 0 ? producaoHoraAtual / minutosAtuais : mediaHoraRealizado / 60;
            const minutosRestantes = 60 - minutosAtuais;
            const projecaoHoraAtual = Math.round(producaoHoraAtual + (ritmoPorMinuto * minutosRestantes));
            
            // Calcular projeção do dia
            // Somar o realizado de todas as horas completas + projeção da hora atual + projeção das horas futuras
            const horasCompletas = dashboardData?.producaoPorHora?.filter(p => parseInt(p.hora) < horaAtual) || [];
            const realizadoHorasCompletas = horasCompletas.reduce((sum, h) => sum + (h.realizado || 0), 0);
            const horasRestantes = Math.max(0, totalHoras - horasTrabalhadas - 1); // -1 porque a hora atual já está sendo projetada
            const projecaoFinal = Math.round(realizadoHorasCompletas + projecaoHoraAtual + (mediaHoraRealizado * horasRestantes));
            const diferencaDia = projecaoFinal - metaDia;
            const estaPerdendoDia = diferencaDia < 0;
            
            const producaoHoras = dashboardData?.producaoPorHora || [];
            const metaEspecificaHora = producaoHoras.find(p => parseInt(p.hora) === horaAtual)?.meta || metaHoraAtual;
            
            // Comparar realizado com a meta (para saber quanto falta)
            const diferencaRealizadoHora = producaoHoraAtual - metaEspecificaHora;
            const faltaHora = Math.abs(diferencaRealizadoHora);
            const percentualDiferencaHora = metaEspecificaHora > 0 ? Math.abs((diferencaRealizadoHora / metaEspecificaHora) * 100) : 0;
            const estaPerdendoHora = diferencaRealizadoHora < 0;
            
            const turnoAtivo = horasTrabalhadas > 0 && horasTrabalhadas < totalHoras;
            
            if (!turnoAtivo) return null;
            
            return (
              <div className="space-y-4">
                {/* Card de Projeção do Dia */}
                <div className={`${estaPerdendoDia ? 'bg-red-500' : 'bg-green-500'} rounded-lg shadow-lg p-6 text-white text-center`}>
                  <h2 className="text-2xl font-bold mb-4">
                    {estaPerdendoDia ? 'Estamos perdendo. Bora lá ein! 😰' : 'Estamos ganhando! Vamos manter! 🚀'}
                  </h2>
                  <p className="text-lg leading-relaxed">
                    Se continuarmos nesse ritmo vamos finalizar o {turno === 'T3' ? 'horário' : 'dia'} com{' '}
                    <span className="font-bold text-2xl">{projecaoFinal.toLocaleString('pt-BR')}</span> pacotes processados.
                  </p>
                </div>

                {/* Card de Projeção da Hora */}
                <div className={`${estaPerdendoHora ? 'bg-red-500' : 'bg-green-500'} rounded-lg shadow-lg p-6 text-white text-center`}>
                  {estaPerdendoHora ? (
                    <div>
                      <p className="text-xl font-semibold mb-3">
                        Faltam <span className="text-3xl font-bold">{faltaHora.toLocaleString('pt-BR')}</span> pacotes para completar a meta da hora
                      </p>
                      <p className="text-xl font-semibold mb-1">
                        Projeção: <span className="text-2xl font-bold">{projecaoHoraAtual.toLocaleString('pt-BR')}</span> pacotes até {horaAtual}h
                      </p>
                      <p className="text-base opacity-90">
                        ({percentualDiferencaHora.toFixed(1)}% abaixo da meta de {metaEspecificaHora.toLocaleString('pt-BR')})
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xl font-semibold mb-3">
                        <span className="text-3xl font-bold">{faltaHora.toLocaleString('pt-BR')}</span> pacotes acima da meta da hora
                      </p>
                      <p className="text-xl font-semibold mb-1">
                        Projeção: <span className="text-2xl font-bold">{projecaoHoraAtual.toLocaleString('pt-BR')}</span> pacotes até {horaAtual}h
                      </p>
                      <p className="text-base opacity-90">
                        ({percentualDiferencaHora.toFixed(1)}% acima da meta de {metaEspecificaHora.toLocaleString('pt-BR')})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Card Principal - Performance e Gráfico */}
          <div className="bg-surface border border-default rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Performance Box */}
              <div className="space-y-4">
                <div className="bg-surface text-page p-4 rounded">
                  <div className="text-sm font-semibold text-muted mb-2">PEFORMANCE</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted">Média Hora Realizado</span>
                      <span className="text-2xl font-bold">
                        {kpis.mediaHoraRealizado?.toLocaleString("pt-BR") || "0"}
                      </span>
                    </div>
                    <div className="h-px bg-default"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted">Produtividade</span>
                      <span className={`text-2xl font-bold ${(kpis.produtividade || 0) >= metaProdutividadeTarget ? 'text-green-400' : 'text-red-400'}`}>
                        {kpis.produtividade || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta X Realizado */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-center">
                  <div className="text-lg font-semibold text-page mb-4">
                    Meta <span className="text-muted">X</span>{" "}
                    <span className="text-[#E8491D]">Realizado</span>
                  </div>
                  <div className="flex gap-12 justify-center items-baseline">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-400">
                        {kpis.metaDia?.toLocaleString("pt-BR") || "0"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-[#E8491D]">
                        {kpis.realizado?.toLocaleString("pt-BR") || "0"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Círculo de Performance */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="12"
                      strokeDasharray={`${(kpis.performance || 0) * 2.51} ${251.2 - (kpis.performance || 0) * 2.51}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-page">
                      {kpis.performance?.toFixed(2) || "0"}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Título Produção por Hora */}
            <div className="bg-[#E8491D] text-white text-center py-3 rounded-t-lg -mx-6 mb-6">
              <h2 className="text-xl font-bold">Produção por Hora</h2>
            </div>

            {/* Gráfico */}
            <ProducaoChart 
              data={dashboardData?.producaoPorHora || []} 
              kpis={kpis}
              desabilitarAnimacoes={desabilitarAnimacoes}
            />
          </div>

          {/* TODO: Tabela de Capacidade - Será substituída por dados do banco
              Futuramente criar tabela no banco para armazenar histórico de produção por hora
              Permitindo consultar dados de dias anteriores e análise histórica
          */}
          {/* <div className="bg-surface border border-default rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Capacidade por Hora</h2>
            <CapacidadeTable data={dashboardData?.capacidadePorHora || []} />
          </div> */}
        </main>
      </MainLayout>
    </div>
  );
}