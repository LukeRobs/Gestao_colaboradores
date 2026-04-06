import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles, excludeEstacoes }) {
  const { isAuthenticated, user, isLoadingAuth } = useContext(AuthContext);

  if (isLoadingAuth) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && roles.length > 0) {
    if (!user || !roles.includes(user.role)) {
      return <Navigate to="/dashboard/operacional" replace />;
    }
  }

  // Bloqueia acesso para estações específicas
  if (excludeEstacoes && user?.idEstacao && excludeEstacoes.includes(user.idEstacao)) {
    return <Navigate to="/dashboard/operacional" replace />;
  }

  return children;
}