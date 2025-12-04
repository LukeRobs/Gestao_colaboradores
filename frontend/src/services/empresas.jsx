// src/services/empresas.jsx
import api from "./api";

export const EmpresasAPI = {
  async listar(params = {}) {
    const res = await api.get("/empresas", { params });

    // compatível com seu paginatedResponse
    const payload = res.data?.data ?? res.data;

    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;

    console.warn("[EmpresasAPI] Formato inesperado em listar:", res.data);
    return [];
  },

  async criar(data) {
    const res = await api.post("/empresas", data);
    return res.data?.data ?? res.data;
  },

  async atualizar(idEmpresa, data) {
    const res = await api.put(`/empresas/${idEmpresa}`, data);
    return res.data?.data ?? res.data;
  },

  async excluir(idEmpresa) {
    await api.delete(`/empresas/${idEmpresa}`);
  },
};
