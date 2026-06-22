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
  listarLideres: async () => {
    const res = await api.get("/colaboradores/lideres");

    // padrão successResponse { success, data }
    return res.data?.data || [];
  },
  listarCargos: async () => {
    const res = await api.get("/cargos", { params: { limit: 200 } });
    return res.data?.data || [];
  },
  listarEscalas: async () => {
    const res = await api.get("/colaboradores/escalas");
    return res.data?.data || [];
  },

  listarSetores: async () => {
    const res = await api.get("/colaboradores/setores");
    return res.data?.data || [];
  },

  listarFiltros: async () => {
    const res = await api.get("/colaboradores/filtros");
    return res.data?.data || { escalas: [], turnos: [], setores: [], cargos: [] };
  },

  exportarCsv: async (params = {}) => {
    const res = await api.get("/colaboradores/export/csv", {
      params,
      responseType: "blob",
    });
    return res;
  },

  backfillNcPreAdmissao: async () => {
    const res = await api.post("/colaboradores/backfill-nc-pre-admissao");
    return res.data;
  },
};