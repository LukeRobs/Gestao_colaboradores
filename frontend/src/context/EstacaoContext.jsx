import { createContext, useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";

export const EstacaoContext = createContext(null);

const STORAGE_KEY = "estacao_selecionada";

export function EstacaoProvider({ children }) {
  const { user } = useContext(AuthContext);

  // Apenas ADMIN pode navegar entre estações
  const isGlobal = user?.role === "ADMIN";

  // ALTA_GESTAO usa a estação fixada no perfil
  const isAltaGestao = user?.role === "ALTA_GESTAO";

  // null = todas as estações (só ADMIN), número = estação específica
  const [estacaoId, setEstacaoId] = useState(() => {
    if (isGlobal) {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Number(saved) : null;
    }
    return null;
  });

  // Retorna a estação efetiva: prioriza user.idEstacao, depois estacaoId selecionada
  const getEstacaoEfetiva = () => {
    return user?.idEstacao ?? estacaoId ?? (Number(localStorage.getItem(STORAGE_KEY)) || null);
  };

  // Quando muda o usuário, reseta
  useEffect(() => {
    if (!isGlobal) {
      setEstacaoId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user?.id, isGlobal]);

  // Para ALTA_GESTAO, injeta automaticamente o estacaoId do perfil no localStorage
  // para que o interceptor do axios o envie nas requests
  useEffect(() => {
    if (isAltaGestao && user?.idEstacao) {
      localStorage.setItem(STORAGE_KEY, String(user.idEstacao));
    }
  }, [isAltaGestao, user?.idEstacao]);

  const selecionarEstacao = (id) => {
    if (!isGlobal) return; // ALTA_GESTAO não pode trocar
    const valor = id ? Number(id) : null;
    setEstacaoId(valor);
    if (valor) {
      localStorage.setItem(STORAGE_KEY, String(valor));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.location.reload();
  };

  return (
    <EstacaoContext.Provider value={{ estacaoId, isGlobal, selecionarEstacao, getEstacaoEfetiva }}>
      {children}
    </EstacaoContext.Provider>
  );
}

export function useEstacao() {
  return useContext(EstacaoContext);
}
