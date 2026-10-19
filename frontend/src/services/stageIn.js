import api from "./api";

export const StageInAPI = {
  // A estação vem do seletor (api.jsx injeta estacaoId); o backend só devolve o Stage IN dela.
  obter: async () => {
    const res = await api.get("/stage-in");
    return res.data.data;
  },
};
