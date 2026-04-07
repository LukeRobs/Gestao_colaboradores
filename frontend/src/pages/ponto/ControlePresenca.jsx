import { useEffect, useState, useCallback, useContext, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api.jsx";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";

import PresencaToolbar from "../../components/ponto/PresencaToolbar";
import PresencaGrid from "../../components/ponto/PresencaGrid";
import PresencaModal from "../../components/ponto/EditarPresencaModal";

export default function ControlePresenca() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { permissions } = useContext(AuthContext);
  const isAdmin = (permissions?.isAdmin || permissions?.isAltaGestao) ?? false;

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
  const [filtroFalta, setFiltroFalta] = useState(false);
  const [filtroOn, setFiltroOn] = useState(false);

  /* ================== DADOS ================== */
  const [dias, setDias] = useState([]);
  const [colaboradoresRaw, setColaboradoresRaw] = useState([]);

  /* ================== ESTADOS ================== */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lideres, setLideres] = useState([]);
  const [exportando, setExportando] = useState(false);

  /* ================== MODAL ================== */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const isLider = true;

  function handleEditCell(data) {
    setModalData(data);
    setModalOpen(true);
  }

  /* ================== EXPORTAR GOOGLE SHEETS ================== */
  const exportarSheets = async () => {
    try {
      setExportando(true);

      if (colaboradoresRaw.length === 0) {
        toast.error("Nenhum dado de presença encontrado para exportar.");
        return;
      }

      toast.loading("Exportando para Google Sheets...", { id: "exportar-sheets" });

      const res = await api.get("/ponto/exportar-sheets", { params: { mes } });

      if (res.data?.success) {
        const data = res.data.data;
        toast.success(
          `Exportação concluída! ${data.colaboradores} colaboradores e ${data.celulasAtualizadas} células atualizadas na aba "${data.nomeAba}"`,
          { id: "exportar-sheets", duration: 5000 }
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

      // injeta ano e mês em cada colaborador (necessário pro grid)
      const [ano, mesNum] = mes.split("-").map(Number);
      lista = lista.map((c) => ({ ...c, ano, mes: mesNum }));

      setDias(data.dias || []);
      setColaboradoresRaw(lista);
    } catch (e) {
      console.error("Erro ao carregar controle de presença:", e);
      setError("Erro ao carregar controle de presença");
      setDias([]);
      setColaboradoresRaw([]);
    } finally {
      setLoading(false);
    }
  }, [mes, turno, escala, lider, pendenciaSaida, pendentesHoje]);

  /* ================== FILTROS LOCAIS ================== */
  const colaboradores = useMemo(() => {
    let lista = colaboradoresRaw;

    if (busca) {
      lista = lista.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    // Pendentes hoje (filtro local complementar ao do backend)
    if (pendentesHoje) {
      const agora = new Date();
      const anoHoje = agora.getFullYear();
      const mesHoje = agora.getMonth() + 1;
      const diaHoje = agora.getDate();
      const [ano, mesNum] = mes.split("-").map(Number);

      if (ano === anoHoje && mesNum === mesHoje) {
        const dataHojeISO = `${anoHoje}-${String(mesHoje).padStart(2, "0")}-${String(diaHoje).padStart(2, "0")}`;
        lista = lista.filter((c) => {
          const registroHoje = c.dias?.[dataHojeISO];
          return !registroHoje || registroHoje.status === "-";
        });
      }
    }

    if (filtroFalta) {
      lista = lista.filter((c) =>
        Object.values(c.dias || {}).some((d) => d?.status === "F" || d?.status === "FJ")
      );
    }

    if (filtroOn) {
      lista = lista.filter((c) =>
        Object.values(c.dias || {}).some((d) => d?.status === "ON")
      );
    }

    return lista;
  }, [colaboradoresRaw, busca, pendentesHoje, filtroFalta, filtroOn, mes]);

  function aplicarAjusteLocal({ opsId, dataReferencia, status, horaEntrada, horaSaida }) {
    setColaboradoresRaw((prev) =>
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
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-full overflow-hidden">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Controle de Presença</h1>
            <p className="text-sm text-muted">
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
            filtroFalta={filtroFalta}
            filtroOn={filtroOn}
            onPendenciaSaidaChange={setPendenciaSaida}
            onPendentesHojeChange={setPendentesHoje}
            onFiltroFaltaChange={setFiltroFalta}
            onFiltroOnChange={setFiltroOn}
            onMesChange={setMes}
            onTurnoChange={setTurno}
            onEscalaChange={setEscala}
            onBuscaChange={setBusca}
            onLiderChange={setLider}
            onExportarSheets={exportarSheets}
            loading={exportando}
          />

          {/* GRID */}
          <div className="bg-surface rounded-2xl w-full min-w-0">
            {loading ? (
              <div className="p-6 text-muted">
                Carregando controle de presença…
              </div>
            ) : error ? (
              <div className="p-6 text-red-400">{error}</div>
            ) : colaboradores.length === 0 ? (
              <div className="p-6 text-center text-muted">
                Nenhum colaborador encontrado para os filtros selecionados.
              </div>
            ) : (
              <PresencaGrid
                dias={dias}
                colaboradores={colaboradores}
                canEdit={isLider}
                isAdmin={isAdmin}
                onEditCell={handleEditCell}
              />
            )}
          </div>
        </main>
      </div>

      {/* MODAL DO LÍDER */}
      <PresencaModal
        open={modalOpen}
        isAdmin={isAdmin}
        colaborador={modalData?.colaborador}
        dia={modalData?.dia}
        registro={modalData?.registro}
        onClose={() => setModalOpen(false)}
        onSuccess={(payload) => {
          if (pendenciaSaida) {
            loadPresenca();
          } else {
            aplicarAjusteLocal(payload);
          }
          setModalOpen(false);
        }}
      />
    </div>
  );
}
