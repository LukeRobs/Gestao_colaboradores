import api from "./api";

export const EscalasAPI = {
  listar: async () => {
    const res = await api.get("/escalas");
    return res.data?.data || [];
  },

  criar: async (data) => {
    const res = await api.post("/escalas", data);
    return res.data?.data;
  },

  atualizar: async (id, data) => {
    const res = await api.put(`/escalas/${id}`, data);
    return res.data?.data;
  },

  excluir: async (id) => {
    await api.delete(`/escalas/${id}`);
  },
};
