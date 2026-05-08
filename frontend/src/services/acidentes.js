import api from "./api";

export const AcidentesAPI = {
  listar: async ({ page = 1, limit = 20, nome, data } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (nome) params.set("nome", nome);
    if (data) params.set("data", data);
    const res = await api.get(`/acidentes?${params}`);
    return res.data; // { data, pagination }
  },

  stats: async () => {
    const res = await api.get("/acidentes/stats");
    return res.data.data; // { total, ativos, cancelados }
  },

  criar: async (payload) => {
    const res = await api.post("/acidentes", payload);
    return res.data.data;
  },

  presignUpload: async ({ cpf, files }) => {
    const res = await api.post("/acidentes/presign-upload", {
      cpf: cpf.replace(/\D/g, ""),
      files,
    });
    return res.data.data; // [{ uploadUrl, key }]
  },

  me: async () => {
    const res = await api.get("/auth/me");
    return res.data.data;
  },

  cancelar: async (id, motivo) => {
    const res = await api.post(`/acidentes/${id}/cancelar`, { motivo });
    return res.data.data;
  },
};
