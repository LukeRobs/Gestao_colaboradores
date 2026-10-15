import api from "./api";

// A estação vem do seletor (api.jsx injeta estacaoId); o backend só devolve as viagens dela.
export const PlanejamentoInboundAPI = {
  // Cards e curvas de um dia operacional "YYYY-MM-DD" (sem ele, o do momento), opcionalmente de um turno (T1/T2/T3).
  previsao: async ({ data, turno } = {}) => {
    const res = await api.get("/planejamento-inbound/previsao", { params: { ...(data ? { data } : {}), ...(turno ? { turno } : {}) } });
    return res.data.data;
  },

  // Viagens de um intervalo de dias operacionais (sem ele, só o dia atual).
  viagens: async ({ de, ate } = {}) => {
    const res = await api.get("/planejamento-inbound/viagens", { params: { ...(de ? { de } : {}), ...(ate ? { ate } : {}) } });
    return res.data.data;
  },

  viagem: async (lh) => {
    const res = await api.get(`/planejamento-inbound/viagens/${encodeURIComponent(lh)}`);
    return res.data.data;
  },

  mapa: async () => {
    const res = await api.get("/planejamento-inbound/mapa");
    return res.data.data;
  },
};
