import api from "./api";

export const TreinamentosAPI = {
  listar: async ({ page = 1, limit = 50, tema, processo, lider, dataInicio, dataFim } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (tema)       params.set("tema",       tema);
    if (processo)   params.set("processo",   processo);
    if (lider)      params.set("lider",      lider);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim)    params.set("dataFim",    dataFim);
    const res = await api.get(`/treinamentos?${params}`);
    return res.data; // { data, pagination }
  },

  stats: async () => {
    const res = await api.get("/treinamentos/stats");
    return res.data.data; // { total, finalizados, pendentes, cancelados }
  },

  criar: async (payload) => {
    const res = await api.post("/treinamentos", payload);
    return res.data.data;
  },

  presignAta: async (id) => {
    const res = await api.post(`/treinamentos/${id}/presign-ata`);
    return res.data;
  },

  finalizar: async (id, payload) => {
    const res = await api.post(`/treinamentos/${id}/finalizar`, payload);
    return res.data.data;
  },

  atualizarParticipantes: async (id, participantes) => {
    const res = await api.put(`/treinamentos/${id}/participantes`, { participantes });
    return res.data.data;
  },

  cancelar: async (id, motivo) => {
    const res = await api.post(`/treinamentos/${id}/cancelar`, { motivo });
    return res.data.data;
  },
};
