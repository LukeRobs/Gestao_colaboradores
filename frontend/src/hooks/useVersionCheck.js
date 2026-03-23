import { useState, useEffect } from "react";
import api from "../services/api.jsx";
import CHANGELOG from "../config/changelog";

const STORAGE_KEY = "app_last_seen_version";

/**
 * Compara a versão do backend com a última versão vista pelo usuário.
 * Retorna `show=true` apenas na primeira vez após um novo deploy.
 */
export function useVersionCheck() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await api.get("/version");
        const serverVersion = res.data?.version;
        if (!serverVersion) return;

        const lastSeen = localStorage.getItem(STORAGE_KEY);

        if (lastSeen !== serverVersion) {
          // Só mostra se a versão do changelog bate com a do servidor
          if (CHANGELOG.version === serverVersion) {
            setShow(true);
          }
          // Salva independente — evita checar de novo
          localStorage.setItem(STORAGE_KEY, serverVersion);
        }
      } catch {
        // silencioso — não bloqueia o app
      }
    }

    check();
  }, []);

  function dismiss() {
    setShow(false);
  }

  return { show, dismiss };
}
