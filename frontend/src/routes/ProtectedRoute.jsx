import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useContext(AuthContext);
  const hasToken = !!localStorage.getItem("token");

  // ❌ Não autenticado
  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Sem role carregada ainda
  if (!user?.role) {
    return <Navigate to="/login" replace />;
  }

  // ❌ Role não permitida
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard/operacional" replace />;
  }

  // ✅ Autorizado
  return children;
}
