import api from "./api";

export const FilaRecebimentoAPI = {
  // A estação vem do seletor (api.jsx injeta estacaoId); o backend só devolve a fila dela.
  listar: async () => {
    const res = await api.get("/fila-recebimento");
    return res.data.data;
  },
};
