import api from "./api";

export const AtestadosAPI = {
  listar: async ({ page = 1, limit = 20, data, nome } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (data) params.set("data", data);
    if (nome) params.set("nome", nome);
    const res = await api.get(`/atestados-medicos?${params}`);
    return res.data; // { data, pagination }
  },

  stats: async () => {
    const res = await api.get("/atestados-medicos/stats");
    return res.data.data; // { total, ativos, finalizados, cancelados }
  },

  buscarPorId: async (id) => {
    const res = await api.get(`/atestados-medicos/${id}`);
    return res.data.data;
  },

  criar: async (payload) => {
    const res = await api.post("/atestados-medicos", payload);
    return res.data.data;
  },

  atualizar: async (id, payload) => {
    const res = await api.put(`/atestados-medicos/${id}`, payload);
    return res.data.data;
  },

  finalizar: async (id) => {
    const res = await api.patch(`/atestados-medicos/${id}/finalizar`);
    return res.data.data;
  },

  cancelar: async (id) => {
    const res = await api.patch(`/atestados-medicos/${id}/cancelar`);
    return res.data.data;
  },

  presignUpload: async ({ cpf }) => {
    const res = await api.post("/atestados-medicos/presign-upload", { cpf });
    return res.data.data;
  },

  presignDownload: async (id) => {
    const res = await api.get(`/atestados-medicos/${id}/presign-download`);
    return res.data.data;
  },
};
