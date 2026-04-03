import api from "./api";

export const SugestoesAPI = {

  listar: (params = {}) =>
    api.get("/medidas-disciplinares/sugestoes", { params }).then((res) => res.data.data),

  aprovar: (id, payload) =>
    api.post(`/medidas-disciplinares/sugestoes/${id}/aprovar`, payload).then((res) => res.data),

  rejeitar: (id, payload) =>
    api.post(`/medidas-disciplinares/sugestoes/${id}/rejeitar`, payload).then((res) => res.data),

  contadores: (params = {}) =>
    api.get("/medidas-disciplinares/sugestoes/contadores", { params }).then((res) => res.data.data),

  backfill: () =>
    api.post("/medidas-disciplinares/sugestoes/backfill").then((res) => res.data),

};

export const MedidasDisciplinaresAPI = {

  /* ================= LISTAR ================= */

  listar: (params = {}) =>
    api
      .get("/medidas-disciplinares", { params })
      .then((res) => res.data.data),

  /* ================= BUSCAR ================= */

  buscar: (id) =>
    api
      .get(`/medidas-disciplinares/${id}`)
      .then((res) => res.data.data),

  /* ================= CRIAR ================= */

  criar: (payload) =>
    api.post("/medidas-disciplinares", payload),

  /* ================= PRESIGN UPLOAD ================= */

  presignUpload: (id) =>
    api.get(`/medidas-disciplinares/${id}/presign-upload`),

  /* ================= PRESIGN DOWNLOAD ================= */

  presignDownload: (id) =>
    api.get(`/medidas-disciplinares/${id}/presign-download`),

  /* ================= FINALIZAR ================= */

  finalizar: (id, payload) =>
    api.post(`/medidas-disciplinares/${id}/finalizar`, payload),

  /* ================= BAIXAR CARTA ================= */

  baixarCarta: async (id) => {

    const res = await api.get(`/medidas-disciplinares/${id}/presign-download`);

    const url = res.data.data.url;

    window.open(url, "_blank");

  },

  /* ================= BAIXAR DOCUMENTO ASSINADO ================= */

  baixarDocumentoAssinado: async (id) => {

    const res = await api.get(`/medidas-disciplinares/${id}/presign-download`);

    const url = res.data.data.url;

    window.open(url, "_blank");

  },

};