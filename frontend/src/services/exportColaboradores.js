import api from "./api";

export const ExportColaboradoresAPI = {
  status: async () => {
    const res = await api.get("/colaboradores/export/status");
    return res.data.data;
  },
  exportarAgora: async () => {
    const res = await api.post("/colaboradores/export/agora");
    return res.data;
  },
};
