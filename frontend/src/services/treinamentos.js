import api from "./api";

export const TreinamentosAPI = {
  listar: async () => {
    const res = await api.get("/treinamentos");
    return res.data.data;
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
