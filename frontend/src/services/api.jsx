import axios from "axios";

// Cria instância do Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + "/api", // exemplo: http://localhost:3000
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de request: adiciona token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // pega token do localStorage

  if (!config.headers) config.headers = {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log("[API] Enviando token:", token.slice(0, 15) + "...");
  } else {
    console.log("[API] Nenhum token encontrado no localStorage");
  }

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
