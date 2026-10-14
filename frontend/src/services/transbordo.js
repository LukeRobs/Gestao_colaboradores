import api from "./api";

export const TransbordoAPI = {
  // data: dia operacional "YYYY-MM-DD" (sem ela, o do momento). A estação vem do seletor (api.jsx injeta estacaoId).
  listar: async ({ data } = {}) => {
    const res = await api.get("/transbordo", { params: data ? { data } : {} });
    return res.data.data;
  },
};
