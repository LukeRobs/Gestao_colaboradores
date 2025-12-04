import api from "./api";

export const SetoresAPI = {
  listar: async (params = {}) => {
    const res = await api.get("/setores", { params });
    return res.data.data || []; // <-- garante array sempre
  },

  criar: async (data) => {
    const res = await api.post("/setores", data);
    return res.data.data;
  },

  atualizar: async (id, data) => {
    const res = await api.put(`/setores/${id}`, data);
    return res.data.data;
  },

  excluir: async (id) => {
    await api.delete(`/setores/${id}`);
  },
};
