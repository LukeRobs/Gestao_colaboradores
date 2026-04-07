import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { Toaster } from "react-hot-toast";
import { useVersionCheck } from "./hooks/useVersionCheck";
import WhatsNewModal from "./components/WhatsNewModal";
import { AuthContext } from "./context/AuthContext";

/* ================= AUTH ================= */
import Login from "./pages/login";
import Register from "./pages/register";

/* ================= DASHBOARDS ================= */
import DashboardOperacional from "./pages/dashboards/dashboardOperacional";
import DashboardAdmin from "./pages/dashboards/dashboardAdmin";
import DashboardColaborador from "./pages/dashboards/dashboardColaborador";
import DashboardAtestados from "./pages/dashboards/dashboardAtestados";
import GestaoOperacional from "./pages/dashboards/gestaoOperacional";
import ProdutividadeColaborador from "./pages/dashboards/produtividadeColaborador";
import DashboardDesligamento from "./pages/dashboards/dashboardDesligamento";
import DashboardFaltas from "./pages/dashboards/DashboardFaltas";

/* ================= COLABORADORES ================= */
import ColaboradoresPage from "./pages/colaboradores";
import NovoColaborador from "./pages/colaboradores/novo";
import EditarColaborador from "./pages/colaboradores/editar";
import MovimentarColaborador from "./pages/colaboradores/movimentar";
import PerfilColaborador from "./pages/colaboradores/perfil";
import ImportarColaboradores from "./pages/colaboradores/import";

/* ================= PONTO ================= */
import PontoPage from "./pages/Ponto";
import ControlePresenca from "./pages/ponto/ControlePresenca";

/* ================= ESTRUTURA ================= */
import EmpresasPage from "./pages/empresas";
import SetoresPage from "./pages/Setores";
import CargosPage from "./pages/cargos";
import RegionaisList from "./pages/organizacao/regionais/Regionais";
import EstacoesList from "./pages/organizacao/estacoes/Estacoes";
import TurnosPage from "./pages/turnos/Turnos";
import EscalasPage from "./pages/escalas/Escalas";
/* ================= RH ================= */
import AtestadosPage from "./pages/atestados";
import NovoAtestado from "./pages/atestados/novo";

import MedidasDisciplinaresPage from "./pages/medidas-disciplinares";
import NovaMedidaDisciplinar from "./pages/medidas-disciplinares/novo";
import SugestoesMedidaDisciplinar from "./pages/medidas-disciplinares/SugestoesMedidaDisciplinar";
import MedidaDisciplinarDetalhe from "./pages/medidas-disciplinares/MedidaDisciplinarDetalhe";

import AcidentesPage from "./pages/acidentes";
import NovoAcidente from "./pages/acidentes/novo";

/* ================= TREINAMENTOS ================= */
import TreinamentosPage from "./pages/treinamentos";
import DetalhesTreinamento from "./pages/treinamentos/detalhes";
import NovoTreinamento from "./pages/treinamentos/novo";

/* ================= DW ============================*/
import DwListPage from "./pages/DailyWorks/dwList";
import DwNovoPage from "./pages/DailyWorks/dwNovo";

/* ================= SSO - SEGURANÇA E SAÚDE OCUPACIONAL ================= */
import SPI from "./pages/spi/SPI";

/* ================= Folga-Dominical ============================*/
import FolgaDominicalPage from "./pages/folgaDominical/folgaDominical";

/* ================= PROTEÇÃO ================= */
import ProtectedRoute from "./routes/ProtectedRoute";
import ReportRoute from "./routes/report";

export default function App() {
  const { show, dismiss } = useVersionCheck();
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <>
      {show && isAuthenticated && <WhatsNewModal onClose={dismiss} />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1A1A1C",
            color: "#fff",
            border: "1px solid #2A2A2C",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
      <Routes>
      {/* ================= ROTAS PÚBLICAS ================= */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ================= DASHBOARDS ================= */}
      {/* Redireciona / para o dashboard padrão */}
      <Route
        path="/"
        element={<Navigate to="/dashboard/operacional" replace />}
      />

      <Route
        path="/dashboard/operacional"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DashboardOperacional />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/colaboradores"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <DashboardColaborador />
            </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/atestados"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DashboardAtestados />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/gestao-operacional"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]} onlyEstacoes={[1]}>
            <GestaoOperacional />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/produtividade-colaborador"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA", "OPERACAO"]} onlyEstacoes={[1]}>
            <ProdutividadeColaborador />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/desligamento"
        element={
        <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
          <DashboardDesligamento />
        </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/faltas"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DashboardFaltas />
          </ProtectedRoute>  
        }
      />
      
      {/* ================= COLABORADORES ================= */}
      <Route
        path="/colaboradores"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <ColaboradoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <NovoColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/import"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <ImportarColaboradores/>
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/editar"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <EditarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/movimentar"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <MovimentarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <PerfilColaborador />
          </ProtectedRoute>
        }
      />

      {/* ================= RH ================= */}
      <Route
        path="/atestados"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <AtestadosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/atestados/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <NovoAtestado />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <MedidasDisciplinaresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <NovaMedidaDisciplinar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares/sugestao"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <SugestoesMedidaDisciplinar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medidas-disciplinares/:id"
        element={<MedidaDisciplinarDetalhe />}
      />

      <Route
        path="/acidentes"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <AcidentesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/acidentes/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <NovoAcidente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/treinamentos"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <TreinamentosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <NovoTreinamento />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/:id"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DetalhesTreinamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dw"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DwListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dw/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <DwNovoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/folga-dominical"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <FolgaDominicalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/empresas"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <EmpresasPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/setores"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <SetoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cargos"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <CargosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/regionais"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <RegionaisList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/estacoes"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <EstacoesList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/turnos"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <TurnosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/escalas"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO"]}>
            <EscalasPage />
          </ProtectedRoute>
        }
      />

      {/* ================= PONTO ================= */}
      <Route
        path="/ponto"
        element={
          <ProtectedRoute>
            <PontoPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/ponto/controle"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <ControlePresenca />
          </ProtectedRoute>
        }
      />

      <Route
        path="/spi"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]} onlyEstacoes={[1]}>
            <SPI />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report"
        element={
          <ProtectedRoute roles={["ADMIN", "ALTA_GESTAO", "LIDERANCA"]}>
            <ReportRoute />
          </ProtectedRoute>
        }
      />

      {/* ================= FALLBACK ================= */}
      <Route
        path="*"
        element={<Navigate to="/dashboard/operacional" replace />}
      />
    </Routes>
    </>
  );
}
