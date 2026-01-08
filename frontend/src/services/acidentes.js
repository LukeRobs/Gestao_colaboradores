// src/services/acidentes.js
import api from "./api";

export const AcidentesAPI = {
  async listar(params = {}) {
    const res = await api.get("/acidentes", { params });
    return res.data.data || [];
  },

  async criar(payload) {
    const res = await api.post("/acidentes", payload);
    return res.data.data;
  },

  async presignUpload({ cpf, files }) {
    const cpfLimpo = cpf.replace(/\D/g, "");

    const res = await api.post("/acidentes/presign-upload", {
      cpf: cpfLimpo,
      files,
    });

    return res.data.data; // [{ uploadUrl, key }]
  },

  async me() {
    const res = await api.get("/auth/me");
    return res.data.data;
  },
};
