import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";
import toast from "react-hot-toast";

import PresencaToolbar from "../../components/ponto/PresencaToolbar";
import PresencaGrid from "../../components/ponto/PresencaGrid";
import PresencaModal from "../../components/ponto/EditarPresencaModal";

export default function ControlePresenca() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ================== FILTROS ================== */
  const hoje = new Date();
  const [mes, setMes] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [turno, setTurno] = useState("TODOS");
  const [escala, setEscala] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [lider, setLider] = useState("TODOS");
  const [pendenciaSaida, setPendenciaSaida] = useState(false);
  const [pendentesHoje, setPendentesHoje] = useState(false);

  /* ================== DADOS ================== */
  const [dias, setDias] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);

  /* ================== ESTADOS ================== */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lideres, setLideres] = useState([]);
  const [exportando, setExportando] = useState(false);

  /* ================== MODAL ================== */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  // 🔐 futuramente vem do auth
  const isLider = true;

  function handleEditCell(data) {
    setModalData(data);
    setModalOpen(true);
  }

  /* ================== EXPORTAR GOOGLE SHEETS ================== */
  const exportarSheets = async () => {
    try {
      setExportando(true);
      
      if (colaboradores.length === 0) {
        toast.error("Nenhum dado de presença encontrado para exportar.");
        return;
      }

      toast.loading("Exportando para Google Sheets...", { id: "exportar-sheets" });

      // Exporta sempre completo, sem filtros
      const params = {
        mes,
      };

      const res = await api.get("/ponto/exportar-sheets", { params });

      if (res.data?.success) {
        const data = res.data.data;
        toast.success(
          `Exportação concluída! ${data.colaboradores} colaboradores e ${data.celulasAtualizadas} células atualizadas na aba "${data.nomeAba}"`,
          { 
            id: "exportar-sheets",
            duration: 5000
          }
        );
      }
      
    } catch (error) {
      console.error("Erro ao exportar para Google Sheets:", error);
      const mensagem = error.response?.data?.message || "Erro ao exportar dados. Tente novamente.";
      toast.error(mensagem, { id: "exportar-sheets" });
    } finally {
      setExportando(false);
    }
  };

  /* ================== FETCH ================== */
  const loadPresenca = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        mes,
        ...(turno !== "TODOS" ? { turno } : {}),
        ...(escala !== "TODOS" ? { escala } : {}),
        ...(lider !== "TODOS" ? { lider } : {}),
        ...(pendenciaSaida ? { pendenciaSaida: "true" } : {}),
        ...(pendentesHoje ? { pendentesHoje: "true" } : {}),
      };

      const res = await api.get("/ponto/controle", { params });

      const data = res.data?.data || {};
      let lista = data.colaboradores || [];

      // 🔑 injeta ano e mês em cada colaborador (necessário pro grid)
      const [ano, mesNum] = mes.split("-").map(Number);
      lista = lista.map((c) => ({
        ...c,
        ano,
        mes: mesNum,
      }));

      // filtro local por nome
      if (busca) {
        lista = lista.filter((c) =>
          c.nome.toLowerCase().includes(busca.toLowerCase())
        );
      }

      // 🔑 FILTRO LOCAL: Pendentes hoje (sem presença marcada no dia atual)
      if (pendentesHoje) {
        const hoje = new Date();
        const diaHoje = hoje.getDate();
        const mesHoje = hoje.getMonth() + 1;
        const anoHoje = hoje.getFullYear();
        
        // Só aplica o filtro se estivermos visualizando o mês atual
        if (ano === anoHoje && mesNum === mesHoje) {
          const dataHojeISO = `${anoHoje}-${String(mesHoje).padStart(2, "0")}-${String(diaHoje).padStart(2, "0")}`;
          
          lista = lista.filter((c) => {
            const registroHoje = c.dias?.[dataHojeISO];
            // Considera pendente se não tem registro ou se o status é "-" (falta)
            return !registroHoje || registroHoje.status === "-";
          });
        }
      }

      setDias(data.dias || []);
      setColaboradores(lista);
    } catch (e) {
      console.error("Erro ao carregar controle de presença:", e);
      setError("Erro ao carregar controle de presença");
      setDias([]);
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  }, [mes, turno, escala, busca, lider, pendenciaSaida, pendentesHoje]);

  function aplicarAjusteLocal({ opsId, dataReferencia, status, horaEntrada, horaSaida }) {
  setColaboradores((prev) =>
    prev.map((c) => {
      if (c.opsId !== opsId) return c;

      return {
        ...c,
        dias: {
          ...c.dias,
        [dataReferencia]: {
          status,
          entrada: horaEntrada ? `1970-01-01T${horaEntrada}:00.000Z` : null,
          saida: horaSaida ? `1970-01-01T${horaSaida}:00.000Z` : null,
          manual: true,
        },
        },
      };
    })
  );
}

useEffect(() => {
  loadPresenca();
}, [loadPresenca]);

 useEffect(() => {
  async function loadLideres() {
    try {
      const res = await api.get("/colaboradores/lideres");
      setLideres(res.data?.data || []);
    } catch (err) {
      console.error("Erro ao carregar líderes", err);
      setLideres([]);
    }
  }

  loadLideres();
}, []);


  /* ================== UI ================== */
  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-full">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Controle de Presença</h1>
            <p className="text-sm text-[#BFBFC3]">
              Visão mensal de presença e exceções
            </p>
          </div>

          {/* TOOLBAR */}
          <PresencaToolbar
            mes={mes}
            turno={turno}
            escala={escala}
            busca={busca}
            lider={lider}
            lideres={lideres}
            pendenciaSaida={pendenciaSaida}
            pendentesHoje={pendentesHoje}
            onPendenciaSaidaChange={setPendenciaSaida}
            onPendentesHojeChange={setPendentesHoje}
            onMesChange={setMes}
            onTurnoChange={setTurno}
            onEscalaChange={setEscala}
            onBuscaChange={setBusca}
            onLiderChange={setLider}
            onExportarSheets={exportarSheets}
            loading={exportando}
          />


          {/* GRID */}
          <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-[#BFBFC3]">
                Carregando controle de presença…
              </div>
            ) : error ? (
              <div className="p-6 text-red-400">{error}</div>
            ) : colaboradores.length === 0 ? (
              <div className="p-6 text-center text-[#BFBFC3]">
                Nenhum colaborador encontrado para os filtros selecionados.
              </div>
            ) : (
              <PresencaGrid
                dias={dias}
                colaboradores={colaboradores}
                canEdit={isLider}
                onEditCell={handleEditCell}
              />
            )}
          </div>
        </main>
      </div>

      {/* MODAL DO LÍDER */}
      <PresencaModal
        open={modalOpen}
        colaborador={modalData?.colaborador}
        dia={modalData?.dia}
        registro={modalData?.registro}
        onClose={() => setModalOpen(false)}
        onSuccess={(payload) => {
          if (pendenciaSaida) {
            // 🔑 se estiver filtrando pendências, recarrega tudo
            loadPresenca();
          } else {
            // comportamento atual
            aplicarAjusteLocal(payload);
          }
          setModalOpen(false);
        }}
      />

    </div>
  );
}
