import api from "./api";

export const TurnosAPI = {
  listar: async () => {
    const res = await api.get("/turnos");
    return res.data?.data || [];
  },

  criar: async (data) => {
    const res = await api.post("/turnos", data);
    return res.data?.data;
  },

  atualizar: async (id, data) => {
    const res = await api.put(`/turnos/${id}`, data);
    return res.data?.data;
  },

  excluir: async (id) => {
    await api.delete(`/turnos/${id}`);
  },
};
