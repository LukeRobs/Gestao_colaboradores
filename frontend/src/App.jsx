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
          <ProtectedRoute>
            <DashboardOperacional />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/colaboradores"
        element={
          <ProtectedRoute>
            <DashboardColaborador />
            </ProtectedRoute>
        }
      />
      {/* ================= COLABORADORES ================= */}
      <Route
        path="/colaboradores"
        element={
          <ProtectedRoute>
            <ColaboradoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/novo"
        element={
          <ProtectedRoute>
            <NovoColaborador />
          </ProtectedRoute>
        }
      />

      {/* ⚠️ IMPORT precisa vir antes da rota dinâmica */}
      <Route
        path="/colaboradores/import"
        element={
          <ProtectedRoute>
            <ImportarColaboradores />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/editar"
        element={
          <ProtectedRoute>
            <EditarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId/movimentar"
        element={
          <ProtectedRoute>
            <MovimentarColaborador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/colaboradores/:opsId"
        element={
          <ProtectedRoute>
            <PerfilColaborador />
          </ProtectedRoute>
        }
      />

      {/* ================= RH ================= */}
      <Route
        path="/atestados"
        element={
          <ProtectedRoute>
            <AtestadosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/atestados/novo"
        element={
          <ProtectedRoute>
            <NovoAtestado />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares"
        element={
          <ProtectedRoute>
            <MedidasDisciplinaresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medidas-disciplinares/novo"
        element={
          <ProtectedRoute>
            <NovaMedidaDisciplinar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/acidentes"
        element={
          <ProtectedRoute>
            <AcidentesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/acidentes/novo"
        element={
          <ProtectedRoute>
            <NovoAcidente />
          </ProtectedRoute>
        }
      />
      {/* ================= TREINAMENTOS ================= */}
      <Route
        path="/treinamentos"
        element={
          <ProtectedRoute>
            <TreinamentosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/novo"
        element={
          <ProtectedRoute>
            <NovoTreinamento />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinamentos/:id"
        element={
          <ProtectedRoute>
            <DetalhesTreinamento />
          </ProtectedRoute>
        }
      />
      {/* ================= DW ================= */}
      <Route
        path="/dw"
        element={
          <ProtectedRoute>
            <DwListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dw/novo"
        element={
          <ProtectedRoute>
            <DwNovoPage />
          </ProtectedRoute>
        }
      />

      {/* ================= ESTRUTURA ================= */}
      <Route
        path="/empresas"
        element={
          <ProtectedRoute>
            <EmpresasPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/setores"
        element={
          <ProtectedRoute>
            <SetoresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cargos"
        element={
          <ProtectedRoute>
            <CargosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/regionais"
        element={
          <ProtectedRoute>
            <RegionaisList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/estacoes"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
            <ControlePresenca />
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
