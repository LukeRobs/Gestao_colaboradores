import { useState, useEffect, useContext } from "react";
import CHANGELOG from "../config/changelog";
import { AuthContext } from "../context/AuthContext";

/**
 * Mostra o changelog uma vez por versão, na primeira vez após o login.
 * A chave no localStorage inclui o email do usuário para ser por conta.
 */
export function useVersionCheck() {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    try {
      const email = user?.email || "guest";
      const key = `changelog_seen_${email}_${CHANGELOG.version}`;

      if (!localStorage.getItem(key)) {
        setShow(true);
        localStorage.setItem(key, "1");
      }
    } catch {
      // silencioso
    }
  }, [isAuthenticated, user]);

  function dismiss() {
    setShow(false);
  }

  return { show, dismiss };
}
