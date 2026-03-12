import { useState, useEffect } from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function AlertaSalvamentoPendente() {
  const [turnosPendentes, setTurnosPendentes] = useState([]);
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Verificar status a cada 2 minutos
    verificarStatus();
    const intervalo = setInterval(verificarStatus, 120000); // 2 minutos
    
    return () => clearInterval(intervalo);
  }, []);

  const verificarStatus = async () => {
    try {
      const response = await api.get("/dashboard/gestao-operacional/status-salvamentos");
      
      if (response.data.success && response.data.temPendencias) {
        setTurnosPendentes(response.data.turnosPendentes);
        setMostrarAlerta(true);
        
        // Mostrar toast apenas se houver pendências novas
        if (response.data.turnosPendentes.length > 0) {
          toast.error(
            `⚠️ ${response.data.turnosPendentes.length} turno(s) não foram salvos automaticamente!`,
            {
              duration: 5000,
              id: "salvamento-pendente"
            }
          );
        }
      } else {
        setMostrarAlerta(false);
        setTurnosPendentes([]);
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const salvarManualmente = async (turno, data) => {
    try {
      setSalvando(true);
      toast.loading(`Salvando dados do ${turno}...`, { id: `salvar-${turno}` });
      
      const response = await api.post("/dashboard/gestao-operacional/salvar-historico", {
        turno
      });
      
      if (response.data.success) {
        toast.success(
          `✅ ${response.data.message} - ${response.data.registros} registros salvos`,
          { id: `salvar-${turno}`, duration: 4000 }
        );
        
        // Remover turno da lista de pendentes
        setTurnosPendentes(prev => prev.filter(t => t.turno !== turno));
        
        // Se não houver mais pendências, ocultar alerta
        if (turnosPendentes.length === 1) {
          setMostrarAlerta(false);
        }
        
        // Verificar status novamente após 2 segundos
        setTimeout(verificarStatus, 2000);
      } else {
        toast.error(`❌ Erro: ${response.data.message}`, { id: `salvar-${turno}` });
      }
    } catch (error) {
      console.error("Erro ao salvar manualmente:", error);
      toast.error(
        `❌ Erro ao salvar ${turno}: ${error.response?.data?.message || error.message}`,
        { id: `salvar-${turno}` }
      );
    } finally {
      setSalvando(false);
    }
  };

  const fecharAlerta = () => {
    setMostrarAlerta(false);
  };

  if (!mostrarAlerta || turnosPendentes.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 max-w-md animate-slide-in-right">
      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            <h3 className="font-semibold text-red-800">
              Salvamento Automático Falhou
            </h3>
          </div>
          <button
            onClick={fecharAlerta}
            className="text-red-400 hover:text-red-600 transition-colors"
            title="Fechar alerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3">
          {turnosPendentes.map((item) => (
            <div
              key={`${item.turno}-${item.data}`}
              className="bg-white rounded-md p-3 border border-red-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{item.turno}</p>
                  <p className="text-sm text-gray-600">
                    Data: {new Date(item.data).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Esperado às {item.horarioEsperado}
                  </p>
                </div>
                <button
                  onClick={() => salvarManualmente(item.turno, item.data)}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
              <p className="text-sm text-red-700">{item.mensagem}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-red-200">
          <p className="text-xs text-gray-600">
            💡 Clique em "Salvar" para executar o salvamento manualmente
          </p>
        </div>
      </div>
    </div>
  );
}
