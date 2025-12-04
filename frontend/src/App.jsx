import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Colaboradores from "./pages/colaboradores";
import EmpresasPage from "./pages/empresas";
import CargosPage from "./pages/cargos";
import SetoresPage from "./pages/Setores";
import PontoPage from "./pages/Ponto";

// ⬇️ IMPORTS CORRETOS AGORA
import { AuthProvider } from "./context/AuthProvider";
import { AuthContext } from "./context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const hasToken = !!localStorage.getItem("token");

  if (isAuthenticated || hasToken) {
    return children;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* LOGIN */}
          <Route path="/login" element={<Login />} />

          {/* DASHBOARD */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* COLABORADORES */}
          <Route
            path="/colaboradores"
            element={
              <ProtectedRoute>
                <Colaboradores />
              </ProtectedRoute>
            }
          />

          {/* EMPRESAS */}
          <Route
            path="/empresas"
            element={
              <ProtectedRoute>
                <EmpresasPage />
              </ProtectedRoute>
            }
          />

          {/* CARGOS */}
          <Route
            path="/cargos"
            element={
              <ProtectedRoute>
                <CargosPage />
              </ProtectedRoute>
            }
          />

          {/* SETORES */}
          <Route
            path="/setores"
            element={
              <ProtectedRoute>
                <SetoresPage />
              </ProtectedRoute>
            }
          />

          {/* PONTO */}
          <Route
            path="/ponto"
            element={
              <ProtectedRoute>
                <PontoPage />
              </ProtectedRoute>
            }
          />

          {/* DEFAULT → REDIRECIONA PARA / */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
