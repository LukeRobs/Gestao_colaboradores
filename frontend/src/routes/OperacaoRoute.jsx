import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useEstacao } from "../context/EstacaoContext";
import ModuloIndisponivel from "../components/mapaOperacional/ModuloIndisponivel";

/**
 * Rota das telas de Operação que existem só em algumas estações (ex.: Recebimento > Transbordo, que roda nas
 * estações 1 e 6). Igual ao ProtectedRoute (login e perfil), mas em outra estação mostra o aviso
 * "módulo não disponível" em vez de carregar uma tela que só daria erro de API.
 */
export default function OperacaoRoute({ children, roles, estacoes }) {
  const { isAuthenticated, user, isLoadingAuth } = useContext(AuthContext);
  const { getEstacaoEfetiva } = useEstacao();

  if (isLoadingAuth) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles?.length && (!user || !roles.includes(user.role))) {
    return <Navigate to={user?.role === "OPERACAO" ? "/ponto" : "/dashboard/operacional"} replace />;
  }

  // Admin sem estação escolhida cai na primeira estação da lista, como o backend faz (estação 1)
  const estacao = getEstacaoEfetiva();
  if (estacoes?.length && estacao && !estacoes.includes(estacao)) return <ModuloIndisponivel />;

  return children;
}
