// src/services/colaboradores.js
import api  from "./api";

function normalizeListResponse(res) {
  // tenta detectar estruturas comuns (paginação, data wrapper, array direto)
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.data)) return res.data.data;
  if (res.data && Array.isArray(res.data.colaboradores)) return res.data.colaboradores;
  if (res.data && Array.isArray(res.data.items)) return res.data.items;
  if (res.data && Array.isArray(res.data)) return res.data;
  // fallback
  return res.data || [];
}

export const ColaboradoresAPI = {
  listar: async (params = {}) => {
    const res = await api.get("/colaboradores", { params });
    return normalizeListResponse(res);
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
