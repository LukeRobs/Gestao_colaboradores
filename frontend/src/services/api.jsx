import axios from "axios";

// Cria instância do Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + "/api", // exemplo: http://localhost:3000
  timeout: 600000, // Aumentado para 5 minutos (para imports longos como CSV grande)
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de request: adiciona token e estacaoId automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (!config.headers) config.headers = {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Injeta estacaoId como query param se estiver selecionado
  // Passa _skipEstacao: true na config para ignorar o filtro de estação
  const estacaoId = localStorage.getItem("estacao_selecionada");
  if (estacaoId && !config._skipEstacao) {
    config.params = { ...config.params, estacaoId: Number(estacaoId) };
  }
  delete config._skipEstacao;

  return config;
});

// Interceptor de response: trata erros e 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    console.log("[API Error]", status, data);

    if (status === 401) {
      console.warn("[API] Token expirado ou inválido. Redirecionando para login.");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;