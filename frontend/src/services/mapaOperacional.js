import api from "./api";
import { comTratamentoDeConflito } from "./conflitoAlocacao";

function turnoParams({ turno, data } = {}) {
  const params = {};
  if (turno) params.turno = turno;
  if (data) params.data = data;
  return params;
}

export const MapaOperacionalAPI = {
  obterTurnoAtual: async () => {
    const res = await api.get("/mapa-operacional/turno-atual");
    return res.data.data;
  },

  listarEsteiras: async () => {
    const res = await api.get("/mapa-operacional/esteiras");
    return res.data.data;
  },

  listarAlocacoes: async (idEsteira, turnoSelecionado) => {
    const res = await api.get(`/mapa-operacional/esteiras/${idEsteira}/alocacoes`, {
      params: turnoParams(turnoSelecionado),
    });
    return res.data.data;
  },

  listarAutoAlocacoes: async (idEsteira, turnoSelecionado) => {
    const res = await api.get(`/mapa-operacional/esteiras/${idEsteira}/auto-alocacoes`, {
      params: turnoParams(turnoSelecionado),
    });
    return res.data.data;
  },

  obterProducaoTurno: async (idEsteira, turnoSelecionado) => {
    const res = await api.get(`/mapa-operacional/esteiras/${idEsteira}/producao-turno`, {
      params: turnoParams(turnoSelecionado),
    });
    return res.data.data;
  },

  // Conflitos (packing automático, outra esteira/doca, outra função) tratados em conflitoAlocacao.js
  alocar: (idEsteira, { braco, lado, opsId, diarista, labor }) =>
    comTratamentoDeConflito(async (extra) =>
      (await api.post(`/mapa-operacional/esteiras/${idEsteira}/alocacoes`, { braco, lado, opsId, diarista, labor, ...extra })).data.data
    ),

  encerrarAlocacao: async (idEsteira, idAlocacao) => {
    const res = await api.delete(`/mapa-operacional/esteiras/${idEsteira}/alocacoes/${idAlocacao}`);
    return res.data;
  },

  // Pesca: braco/lado nulos = tirar do braço ("sem braço").
  moverAlocacao: async (idEsteira, idAlocacao, { braco = null, lado = null } = {}) => {
    const res = await api.post(`/mapa-operacional/esteiras/${idEsteira}/alocacoes/${idAlocacao}/mover`, { braco, lado });
    return res.data.data;
  },

  listarMovimentacoesPesca: async (idEsteira, { data } = {}) => {
    const res = await api.get(`/mapa-operacional/esteiras/${idEsteira}/pesca/movimentacoes`, {
      params: data ? { data } : {},
    });
    return res.data.data;
  },

  // Fanouts por braço/lado (esteiras) ou por posição (Setup D+1). Escrita: só Admin e Alta Gestão.
  // params: { escopo: "ESTEIRA", idEsteira } ou { escopo: "SETUP_D1" }
  listarFanouts: async (params) => (await api.get("/mapa-operacional/fanouts", { params })).data.data,

  listarHistoricoFanouts: async (params) => (await api.get("/mapa-operacional/fanouts/historico", { params })).data.data,

  // Posição alterada há menos de 1 hora: o backend responde 409 e o usuário confirma (conflitoAlocacao.js).
  salvarFanouts: (corpo) => comTratamentoDeConflito(async (extra) => (await api.put("/mapa-operacional/fanouts/posicao", { ...corpo, ...extra })).data),

  moverFanouts: (corpo) => comTratamentoDeConflito(async (extra) => (await api.post("/mapa-operacional/fanouts/mover", { ...corpo, ...extra })).data),

  // Avisos da Label (estilo Waze): ocorrência sinalizada num braço, função ou doca. Expiram sozinhos.
  listarAvisos: async () => (await api.get("/mapa-operacional/avisos")).data.data,

  criarAviso: async (corpo) => (await api.post("/mapa-operacional/avisos", corpo)).data.data,

  encerrarAviso: async (idAviso) => (await api.delete(`/mapa-operacional/avisos/${idAviso}`)).data,

  buscarColaboradoresElegiveis: async ({ contexto, turno, search, semPresenca }) => {
    const params = { contexto, search };
    if (turno) params.turno = turno;
    if (semPresenca) params.semPresenca = true;
    const res = await api.get("/mapa-operacional/colaboradores-elegiveis", { params });
    return res.data.data;
  },

  listarEfetivo: async (turno) => {
    const res = await api.get("/mapa-operacional/efetivo", { params: turno ? { turno } : {} });
    return res.data.data;
  },

  alocarFullD1: async ({ opsId, diarista }) => {
    const res = await api.post("/mapa-operacional/full-d1/alocacoes", { opsId, diarista });
    return res.data;
  },

  encerrarAlocacaoFullD1: async (idAlocacao) => {
    const res = await api.delete(`/mapa-operacional/full-d1/alocacoes/${idAlocacao}`);
    return res.data;
  },

  obterPainelExecutivo: async (data) => {
    const res = await api.get("/mapa-operacional/painel-executivo", { params: data ? { data } : {} });
    return res.data.data;
  },

  // Com { turno, data } de um turno futuro: saldo do Daily Works daquele turno (pré-alocação).
  diaristasDisponiveis: async (turnoSelecionado) => {
    const res = await api.get("/mapa-operacional/diaristas-disponiveis", { params: turnoParams(turnoSelecionado) });
    return res.data.data;
  },

  // Pré-alocação de turno futuro (esteira sem braço e FULL D+1). idEsteira nulo/ausente = FULL D+1.
  listarAgendadas: async ({ turno, data, idEsteira, full }) => {
    const params = { turno, data };
    if (idEsteira) params.idEsteira = idEsteira;
    if (full) params.full = true;
    const res = await api.get("/mapa-operacional/agendadas", { params });
    return res.data.data;
  },

  agendarAlocacao: async ({ idEsteira, labor, opsId, diarista, turno, data }) => {
    const res = await api.post("/mapa-operacional/agendadas", { idEsteira, labor, opsId, diarista, turno, data });
    return res.data;
  },

  removerAgendada: async (idAgendada) => {
    const res = await api.delete(`/mapa-operacional/agendadas/${idAgendada}`);
    return res.data;
  },

  listarFullD1: async (turnoSelecionado) => {
    const res = await api.get("/mapa-operacional/full-d1", {
      params: turnoParams(turnoSelecionado),
    });
    return res.data.data;
  },
};
