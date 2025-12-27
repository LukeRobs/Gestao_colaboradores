import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";

import ColaboradoresPage from "./pages/colaboradores";
import NovoColaborador from "./pages/colaboradores/novo";
import EditarColaborador from "./pages/colaboradores/editar";
import MovimentarColaborador from "./pages/colaboradores/movimentar";
import PerfilColaborador from "./pages/colaboradores/perfil";

import EmpresasPage from "./pages/empresas";
import SetoresPage from "./pages/Setores";
import CargosPage from "./pages/cargos";
import PontoPage from "./pages/Ponto";

import AtestadosPage from "./pages/atestados";
import NovoAtestado from "./pages/atestados/novo";

import MedidasDisciplinaresPage from "./pages/medidas-disciplinares";
import NovaMedidaDisciplinar from "./pages/medidas-disciplinares/novo";

import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* ================= ROTAS PÚBLICAS ================= */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ================= DASHBOARD ================= */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
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

      {/* ================= ATESTADOS ================= */}
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

      {/* ================= MEDIDAS DISCIPLINARES ================= */}
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

      {/* ================= OUTRAS PÁGINAS ================= */}
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
        path="/ponto"
        element={
          <ProtectedRoute>
            <PontoPage />
          </ProtectedRoute>
        }
      />

      {/* ================= FALLBACK ================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
