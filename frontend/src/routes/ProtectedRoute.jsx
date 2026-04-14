import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles, excludeEstacoes, onlyEstacoes }) {
  const { isAuthenticated, user, isLoadingAuth } = useContext(AuthContext);

  if (isLoadingAuth) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const fallback = user?.role === "OPERACAO" ? "/ponto" : "/dashboard/operacional";

  if (roles && roles.length > 0) {
    if (!user || !roles.includes(user.role)) {
      return <Navigate to={fallback} replace />;
    }
  }

  // Bloqueia acesso para estações específicas
  if (excludeEstacoes && user?.idEstacao && excludeEstacoes.includes(user.idEstacao)) {
    return <Navigate to={fallback} replace />;
  }

  // Permite acesso apenas para estações específicas (ADMIN sempre passa)
  if (onlyEstacoes && user?.role !== "ADMIN") {
    if (!user?.idEstacao || !onlyEstacoes.includes(user.idEstacao)) {
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
}