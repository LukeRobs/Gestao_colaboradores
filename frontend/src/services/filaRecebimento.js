import api from "./api";

export const FilaRecebimentoAPI = {
  // A estação vem do seletor (api.jsx injeta estacaoId); o backend só devolve a fila dela.
  listar: async () => {
    const res = await api.get("/fila-recebimento");
    return res.data.data;
  },

  // Veículos que já finalizaram, no dia operacional "YYYY-MM-DD" (sem ele, o do momento).
  recebidos: async ({ data } = {}) => {
    const res = await api.get("/fila-recebimento/recebidos", { params: data ? { data } : {} });
    return res.data.data;
  },
};
