import { useState, useEffect } from "react";
import api from "../services/api";

export function useRefIds() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get("/estacoes"),
      api.get("/empresas?limit=200"),
      api.get("/setores?limit=200"),
      api.get("/cargos?limit=200"),
      api.get("/turnos"),
      api.get("/escalas"),
    ])
      .then(([estacoes, empresas, setores, cargos, turnos, escalas]) => {
        if (cancelled) return;
        setData({
          estacoes: estacoes.data?.data ?? [],
          empresas: empresas.data?.data ?? [],
          setores: setores.data?.data ?? [],
          cargos: cargos.data?.data ?? [],
          turnos: turnos.data?.data ?? [],
          escalas: escalas.data?.data ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
