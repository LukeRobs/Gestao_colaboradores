import { useCallback, useEffect, useState } from "react";
import { MapaOperacionalAPI } from "../../../services/mapaOperacional";

const POLL_AVISOS_MS = 15000;

/**
 * Avisos ativos da estação (esteiras e docas), atualizados a cada 15 s enquanto a aba está visível.
 * `agora` muda junto, pra "restam N min" e a saída por expiração acompanharem sem outra chamada.
 */
export function useAvisos(ativo = true) {
  const [avisos, setAvisos] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const recarregar = useCallback(async () => {
    try {
      setAvisos(await MapaOperacionalAPI.listarAvisos());
    } catch {
      // aviso é complemento: se falhar, a tela principal segue com o último que tinha
    } finally {
      setCarregado(true);
      setAgora(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!ativo) return undefined;
    const primeira = setTimeout(recarregar, 0);
    const intervalo = setInterval(() => {
      if (!document.hidden) recarregar();
    }, POLL_AVISOS_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
    };
  }, [ativo, recarregar]);

  // Expirou no relógio antes da próxima consulta: já some da tela.
  const vigentes = avisos.filter((a) => new Date(a.expiraEm).getTime() > agora);

  return { avisos: vigentes, carregado, recarregar, agora };
}
