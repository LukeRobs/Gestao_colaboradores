import { useState, useEffect, useRef } from "react";
import { Calendar, Package, Send } from "lucide-react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ProducaoChart from "../../components/gestaoOperacional/ProducaoChart";
import AlertaSalvamentoPendente from "../../components/gestaoOperacional/AlertaSalvamentoPendente";
import domtoimage from "dom-to-image-more";
import toast from "react-hot-toast";
// import CapacidadeTable from "../../components/gestaoOperacional/CapacidadeTable"; // Comentado - será usado futuramente

export default function GestaoOperacional() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("T1");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviandoScreenshot, setEnviandoScreenshot] = useState(false);
  const [ocultarRanking, setOcultarRanking] = useState(false);
  const [desabilitarAnimacoes, setDesabilitarAnimacoes] = useState(false);
  const [ocultarHeader, setOcultarHeader] = useState(false);
  const mainContentRef = useRef(null);

  useEffect(() => {
    console.log("🔄 useEffect disparado - Filtros atualizados:", { data, turno });
    carregarDados();
    
    // Atualização automática a cada 1 minuto
    const intervalo = setInterval(() => {
      console.log("⏰ Atualização automática disparada");
      carregarDados();
    }, 60000); // 60 segundos
    
    // Limpar intervalo ao desmontar ou quando filtros mudarem
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, turno]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro(null);
      
      console.log("🔄 Carregando dados com filtros:", { data, turno });
      console.log("🔑 Token no localStorage:", localStorage.getItem("token") ? "Presente" : "Ausente");
      
      const response = await api.get("/dashboard/gestao-operacional", {
        params: { data, turno }
      });
      
      console.log("✅ Resposta recebida:", response.data);
      
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dashboard:", error);
      console.error("📋 Resposta do servidor:", error.response?.data);
      console.error("📊 Status:", error.response?.status);
      
      const mensagemErro = error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Erro ao carregar dados";
      setErro(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const limparCacheEAtualizar = async () => {
    try {
      setLoading(true);
      console.log("🗑️ Limpando cache...");
      
      // Limpar cache no backend
      await api.post("/cache/limpar");
      
      console.log("✅ Cache limpo, recarregando dados...");
      
      // Recarregar dados
      await carregarDados();
    } catch (error) {
      console.error("❌ Erro ao limpar cache:", error);
      // Mesmo com erro, tenta recarregar
      await carregarDados();
    }
  };

  const enviarScreenshotParaSeatalk = async () => {
    try {
      setEnviandoScreenshot(true);
      
      console.log("🚀 Iniciando processo de screenshot...");
      toast.loading("Preparando screenshot...", { id: "screenshot" });
      
      // Ocultar o ranking Top 15
      setOcultarRanking(true);
      // Ocultar o header com filtros
      setOcultarHeader(true);
      // Desabilitar animações do gráfico
      setDesabilitarAnimacoes(true);
      console.log("👁️ Header e ranking ocultados, animações desabilitadas");
      
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
      // Mostrar o ranking novamente
      console.log("🔄 Restaurando elementos");
      setOcultarRanking(false);
      setOcultarHeader(false);
      setDesabilitarAnimacoes(false);
      setEnviandoScreenshot(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#BFBFC3]">
        <div className="relative">
          {/* Círculo animado */}
          <div className="w-16 h-16 border-4 border-[#2A2A2C] border-t-[#E8491D] rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-lg">Carregando dados...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">Erro</div>
          <div className="text-[#BFBFC3]">{erro}</div>
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Alerta de Salvamento Pendente */}
      <AlertaSalvamentoPendente />

      <div className="flex-1 lg:ml-64 min-w-0">
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
              <div className="text-sm text-[#BFBFC3] flex items-center gap-2">
                <span className="font-semibold text-white">{turno}</span> | {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}
                {loading && (
                  <div className="flex items-center gap-2 ml-2">
                    <div className="w-4 h-4 border-2 border-[#E8491D] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-[#E8491D]">Atualizando...</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Botão de atualizar com cache limpo */}
              <button
                onClick={() => limparCacheEAtualizar()}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-[#5A5A5C] disabled:cursor-not-allowed cursor-pointer rounded-lg text-white text-sm font-semibold transition-colors flex items-center gap-2"
                title="Limpar cache e atualizar dados da planilha"
              >
                {loading ? "Carregando..." : "🔄 Forçar Atualização"}
              </button>
              
              {/* Botão de enviar screenshot para Seatalk */}
              <button
                onClick={() => enviarScreenshotParaSeatalk()}
                disabled={enviandoScreenshot || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#5A5A5C] disabled:cursor-not-allowed cursor-pointer rounded-lg text-white text-sm font-semibold transition-colors flex items-center gap-2"
                title="Enviar screenshot para Seatalk (sem ranking)"
              >
                <Send className="w-4 h-4" />
                {enviandoScreenshot ? "Enviando..." : "Enviar para Seatalk"}
              </button>
              
              {/* Filtro de Turno */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-[#BFBFC3]">Turno:</label>
                <select
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                  className="px-4 py-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-white"
                >
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                </select>
              </div>

              {/* Filtro de Data */}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#BFBFC3]" />
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="px-4 py-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-white"
                />
              </div>
            </div>
          </div>
          )}

          {/* KPIs Header - Estilo da imagem */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg overflow-hidden shadow-lg">
            {/* Indicador de Turno e Data */}
            <div className="bg-[#2A2A2C] px-6 py-2 text-center">
              <span className="text-sm text-[#BFBFC3]">
                Dados de: <span className="font-bold text-white">{dashboardData?.turno || turno}</span> - {dashboardData?.dataReferencia ? new Date(dashboardData.dataReferencia + 'T00:00:00').toLocaleDateString('pt-BR') : 'Carregando...'}
                {dashboardData?.ultimaAtualizacao && (
                  <span className="ml-4 text-xs opacity-75">
                    | Última atualização: {new Date(dashboardData.ultimaAtualizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-[#2A2A2C]">
              {/* Meta do Dia */}
              <div className="bg-[#1a1a1c] text-white p-6 text-center">
                <div className="text-sm font-semibold mb-2">META DO DIA</div>
                <div className="text-4xl font-bold">
                  {kpis.metaDia?.toLocaleString("pt-BR") || "0"}
                </div>
              </div>

              {/* Meta Hora Atual */}
              <div className="bg-[#1a1a1c] text-white p-6 text-center">
                <div className="text-sm font-semibold mb-2">
                  META HORA ATUAL {kpis.horaAtual !== undefined && `(${kpis.horaAtual}h)`}
                </div>
                <div className="text-4xl font-bold">
                  {kpis.metaHoraAtual?.toLocaleString("pt-BR") || "0"}
                </div>
              </div>

              {/* Meta de Produtividade */}
              <div className="bg-[#1a1a1c] text-white p-6 text-center">
                <div className="text-sm font-semibold mb-2">META DE PRODUTIVIDADE</div>
                <div className="text-4xl font-bold">
                  770
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
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Performance Box */}
              <div className="space-y-4">
                <div className="bg-[#1e3a5f] text-white p-4 rounded">
                  <div className="text-sm font-semibold mb-2">PEFORMANCE</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs">Média Hora Realizado</span>
                      <span className="text-2xl font-bold">
                        {kpis.mediaHoraRealizado?.toLocaleString("pt-BR") || "0"}
                      </span>
                    </div>
                    <div className="h-px bg-white/20"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs">Produtividade</span>
                      <span className={`text-2xl font-bold ${(kpis.produtividade || 0) >= 770 ? 'text-green-400' : 'text-red-400'}`}>
                        {kpis.produtividade || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta X Realizado */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white mb-4">
                    Meta <span className="text-[#BFBFC3]">X</span>{" "}
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
                      stroke="#2A2A2C"
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
                    <span className="text-3xl font-bold text-white">
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
          {/* <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Capacidade por Hora</h2>
            <CapacidadeTable data={dashboardData?.capacidadePorHora || []} />
          </div> */}

          {/* Ranking Top 15 Produtividade */}
          {!ocultarRanking && (
            <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Top 15 - Produtividade</h2>
            <p className="text-sm text-[#BFBFC3] mb-6">
              Ranking dos colaboradores com maior produção no dia selecionado
            </p>
            
            {dashboardData?.rankingProdutividade && dashboardData.rankingProdutividade.length > 0 ? (
              <>
                {/* Top 3 - Gráfico Visual */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {dashboardData.rankingProdutividade.slice(0, 3).map((colaborador, index) => {
                    const bgColors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-600'];
                    
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div className="text-4xl mb-2">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </div>
                        <div className="w-full bg-[#2A2A2C] rounded-lg p-4 text-center">
                          <div className="text-xs text-[#BFBFC3] mb-2">{index + 1}º Lugar</div>
                          <div className="text-sm font-semibold text-white mb-2 truncate" title={colaborador.nome}>
                            {colaborador.nome}
                          </div>
                          <div className={`${bgColors[index]} text-white font-bold text-2xl py-2 rounded`}>
                            {colaborador.total.toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tabela Completa */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#2A2A2C]">
                        <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Posição</th>
                        <th className="border border-[#3A3A3C] p-3 text-left font-semibold text-white">Nome</th>
                        <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Total Produzido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.rankingProdutividade.map((colaborador, index) => (
                        <tr key={index} className="hover:bg-[#242426]">
                          <td className="border border-[#3A3A3C] p-3 text-center text-white font-bold">
                            {index + 1}º
                          </td>
                          <td className="border border-[#3A3A3C] p-3 text-left text-white">
                            {colaborador.nome}
                          </td>
                          <td className="border border-[#3A3A3C] p-3 text-center text-white font-semibold">
                            {colaborador.total.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-[#BFBFC3]">Sem dados disponíveis</div>
            )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
