import api from "./api";

export const MedidasDisciplinaresAPI = {
  listar: (opsId) =>
    api
      .get("/medidas-disciplinares", {
        params: opsId ? { opsId } : {},
      })
      .then((res) => res.data.data),

  criar: (payload) =>
    api.post("/medidas-disciplinares", payload),

  presignUpload: (payload) =>
    api.post("/medidas-disciplinares/presign-upload", payload),

  presignDownload: (id) =>
    api.get(`/medidas-disciplinares/${id}/presign-download`),
};
