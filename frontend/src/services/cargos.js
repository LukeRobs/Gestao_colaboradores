import api from "./api";

export const CargosAPI = {
  async listar({ limit = 100, search }) {
    const params = {};
    if (limit) params.limit = limit;
    if (search) params.search = search;

    const response = await api.get("/cargos", { params });
    return response.data.data;
  },

  async criar(data) {
    const response = await api.post("/cargos", data);
    return response.data.data;
  },

  async atualizar(id, data) {
    const response = await api.put(`/cargos/${id}`, data);
    return response.data.data;
  },

  async excluir(id) {
    const response = await api.delete(`/cargos/${id}`);
    return response.data.data;
  },
};
