import { createContext, useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";

export const EstacaoContext = createContext(null);

const STORAGE_KEY = "estacao_selecionada";

export function EstacaoProvider({ children }) {
  const { user } = useContext(AuthContext);

  // Apenas ADMIN pode navegar livremente entre todas as estações
  const isGlobal = user?.role === "ADMIN";

  // ALTA_GESTAO/LIDERANCA cuja estação tem uma "irmã" (ver backend
  // config/estacaoGrupos.js) também podem trocar o seletor — só entre as
  // estações do próprio grupo, nunca "todas".
  const estacoesPermitidas = isGlobal
    ? null // Admin: sem restrição, todas as estações
    : (user?.estacoesIrmas && user.estacoesIrmas.length > 0)
      ? user.estacoesIrmas
      : (user?.idEstacao ? [user.idEstacao] : []);

  const podeAlternar = isGlobal || estacoesPermitidas.length > 1;

  // null = todas as estações (só ADMIN), número = estação específica
  const [estacaoId, setEstacaoId] = useState(() => {
    if (!podeAlternar) return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedNum = saved ? Number(saved) : null;
    if (isGlobal) return savedNum;
    // Não-admin: só aceita o valor salvo se pertencer ao próprio grupo
    return savedNum && estacoesPermitidas.includes(savedNum) ? savedNum : (user?.idEstacao ?? null);
  });

  // Retorna a estação efetiva. Para quem pode alternar (Admin ou grupo de
  // estações irmãs), a estação escolhida no seletor vem primeiro — senão a
  // estação-casa do usuário nunca sairia da tela mesmo depois de trocar.
  const getEstacaoEfetiva = () => {
    if (podeAlternar) {
      return estacaoId ?? user?.idEstacao ?? (Number(localStorage.getItem(STORAGE_KEY)) || null);
    }
    return user?.idEstacao ?? estacaoId ?? (Number(localStorage.getItem(STORAGE_KEY)) || null);
  };

  // Quando muda o usuário, reseta (quem não pode alternar nunca deve reter
  // uma estação escolhida por outro usuário na mesma sessão do navegador)
  useEffect(() => {
    if (!podeAlternar) {
      setEstacaoId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user?.id, podeAlternar]);

  // Para quem pode alternar mas ainda não escolheu nada (ou o valor salvo já
  // não é mais válido pro grupo atual), preenche o storage com a própria
  // estação-casa por padrão — sem sobrescrever uma troca já feita.
  useEffect(() => {
    if (isGlobal || !podeAlternar) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedNum = saved ? Number(saved) : null;
    if (!savedNum || !estacoesPermitidas.includes(savedNum)) {
      if (user?.idEstacao) {
        localStorage.setItem(STORAGE_KEY, String(user.idEstacao));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeAlternar, user?.idEstacao]);

  const selecionarEstacao = (id) => {
    if (!podeAlternar) return;

    if (isGlobal) {
      const valor = id ? Number(id) : null;
      setEstacaoId(valor);
      if (valor) {
        localStorage.setItem(STORAGE_KEY, String(valor));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      window.location.reload();
      return;
    }

    // Não-admin: sempre precisa de uma estação ativa, e só dentro do grupo
    const valor = Number(id);
    if (!valor || !estacoesPermitidas.includes(valor)) return;
    setEstacaoId(valor);
    localStorage.setItem(STORAGE_KEY, String(valor));
    window.location.reload();
  };

  return (
    <EstacaoContext.Provider
      value={{ estacaoId, isGlobal, podeAlternar, estacoesPermitidas, selecionarEstacao, getEstacaoEfetiva }}
    >
      {children}
    </EstacaoContext.Provider>
  );
}

export function useEstacao() {
  return useContext(EstacaoContext);
}
