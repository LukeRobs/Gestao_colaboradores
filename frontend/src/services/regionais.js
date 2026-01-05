// src/services/regionais.js
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

export const RegionaisAPI = {
  listar: async (params = {}) => {
    const res = await api.get("/regionais", { params });
    return normalizeListResponse(res);
  },

  buscarPorId: async (idRegional) => {
    const res = await api.get(`/regionais/${idRegional}`);
    return normalizeItemResponse(res);
  },

  criar: async (data) => {
    const res = await api.post("/regionais", data);
    return normalizeItemResponse(res);
  },

  atualizar: async (idRegional, data) => {
    const res = await api.put(`/regionais/${idRegional}`, data);
    return normalizeItemResponse(res);
  },

  excluir: async (idRegional) => {
    const res = await api.delete(`/regionais/${idRegional}`);
    return normalizeItemResponse(res);
  },
};
