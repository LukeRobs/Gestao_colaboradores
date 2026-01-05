// src/services/estacoes.js
import api from "./api";

function normalizeListResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.data)) return res.data.data;
  if (res.data && Array.isArray(res.data.items)) return res.data.items;
  return res.data?.data || res.data || [];
}

function normalizeItemResponse(res) {
  if (!res) return null;
  if (res.data?.data) return res.data.data;
  return res.data || null;
}

export const EstacoesAPI = {
  listar: async (params = {}) => {
    const res = await api.get("/estacoes", { params });
    return normalizeListResponse(res);
  },

  buscarPorId: async (idEstacao) => {
    const res = await api.get(`/estacoes/${idEstacao}`);
    return normalizeItemResponse(res);
  },

  criar: async (data) => {
    const res = await api.post("/estacoes", data);
    return normalizeItemResponse(res);
  },

  atualizar: async (idEstacao, data) => {
    const res = await api.put(`/estacoes/${idEstacao}`, data);
    return normalizeItemResponse(res);
  },

  excluir: async (idEstacao) => {
    const res = await api.delete(`/estacoes/${idEstacao}`);
    return normalizeItemResponse(res);
  },
};
