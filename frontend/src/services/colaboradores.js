// src/services/colaboradores.js
import api from "./api";

export const ColaboradoresAPI = {
  listar: async (params = {}) => {
    const res = await api.get("/colaboradores", { params });

    // Estrutura esperada do backend
    const { data, pagination } = res.data || {};

    return {
      data: Array.isArray(data) ? data : [],
      pagination: pagination || {
        page: 1,
        limit: params.limit || 10,
        total: 0,
      },
    };
  },

  buscarPorOpsId: async (opsId) => {
    const res = await api.get(`/colaboradores/${encodeURIComponent(opsId)}`);
    return res.data;
  },

  criar: async (data) => {
    const res = await api.post("/colaboradores", data);
    return res.data;
  },

  atualizar: async (opsId, data) => {
    const res = await api.put(`/colaboradores/${encodeURIComponent(opsId)}`, data);
    return res.data;
  },

  excluir: async (opsId) => {
    const res = await api.delete(`/colaboradores/${encodeURIComponent(opsId)}`);
    return res.data;
  },
};
