import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Colaboradores from "./pages/colaboradores";
import EmpresasPage from "./pages/empresas";
import CargosPage from "./pages/cargos";
import SetoresPage from "./pages/Setores";

import { AuthProvider, AuthContext } from "./context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const token = localStorage.getItem("token");

  return isAuthenticated || token ? children : <Navigate to="/login" replace />;
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
          <Route
            path="/setores"
            element={
              <ProtectedRoute>
                <SetoresPage />
              </ProtectedRoute>
            }
          />

          {/* REDIRECT CASO CAIA EM ROTA INEXISTENTE */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
