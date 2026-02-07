import { Routes, Route, Navigate } from "react-router-dom";

/* ================= AUTH ================= */
import Login from "./pages/login";
import Register from "./pages/register";

/* ================= DASHBOARDS ================= */
import DashboardOperacional from "./pages/dashboards/dashboardOperacional";
import DashboardAdmin from "./pages/dashboards/dashboardAdmin";
import DashboardColaborador from "./pages/dashboards/dashboardColaborador";

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
/* ================= RH ================= */
import AtestadosPage from "./pages/atestados";
import NovoAtestado from "./pages/atestados/novo";

import MedidasDisciplinaresPage from "./pages/medidas-disciplinares";
import NovaMedidaDisciplinar from "./pages/medidas-disciplinares/novo";

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
import SafetyWalk from "./pages/safety-walk/SafetyWalk";

/* ================= PROTEÇÃO ================= */
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
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
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <DashboardOperacional />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/colaboradores"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <DashboardColaborador />
            </ProtectedRoute>
        }
      />
      {/* ================= COLABORADORES ================= */}
      <Route
        path="/colaboradores"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <ColaboradoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/novo"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <NovoColaborador />
          </ProtectedRoute>
        }
      />

      {/* ⚠️ IMPORT precisa vir antes da rota dinâmica */}
      <Route
        path="/colaboradores/import"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <ImportarColaboradores/>
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/editar"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <EditarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/movimentar"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <MovimentarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <PerfilColaborador />
          </ProtectedRoute>
        }
      />

      {/* ================= RH ================= */}
      <Route
        path="/atestados"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <AtestadosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/atestados/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <NovoAtestado />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <MedidasDisciplinaresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <NovaMedidaDisciplinar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/acidentes"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <AcidentesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/acidentes/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <NovoAcidente />
          </ProtectedRoute>
        }
      />
      {/* ================= TREINAMENTOS ================= */}
      <Route
        path="/treinamentos"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <TreinamentosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <NovoTreinamento />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/:id"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <DetalhesTreinamento />
          </ProtectedRoute>
        }
      />
      {/* ================= DW ================= */}
      <Route
        path="/dw"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <DwListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dw/novo"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <DwNovoPage />
          </ProtectedRoute>
        }
      />

      {/* ================= ESTRUTURA ================= */}
      <Route
        path="/empresas"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <EmpresasPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/setores"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <SetoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cargos"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <CargosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/regionais"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <RegionaisList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/estacoes"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <EstacoesList />
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
          <ProtectedRoute roles={["ADMIN", "LIDERANCA"]}>
            <ControlePresenca />
          </ProtectedRoute>
        }
      />

      {/* ================= SSO - SEGURANÇA E SAÚDE OCUPACIONAL ================= */}
      <Route
        path="/safety-walk"
        element={
          <ProtectedRoute roles={["ADMIN", "LIDERANCA", "GESTAO"]}>
            <SafetyWalk />
          </ProtectedRoute>
        }
      />

      {/* ================= FALLBACK ================= */}
      <Route
        path="*"
        element={<Navigate to="/dashboard/operacional" replace />}
      />
    </Routes>
  );
}
