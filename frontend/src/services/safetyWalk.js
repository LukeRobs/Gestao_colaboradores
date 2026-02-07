import api from './api';

/**
 * Buscar dados do Safety Walk
 * @param {Object} params - Parâmetros de filtro
 * @param {string} params.periodo - 'hoje', 'semana', 'mes'
 * @param {string} params.turno - 'T1', 'T2', 'T3' ou undefined
 * @returns {Promise} Dados do Safety Walk
 */
export const getSafetyWalkData = async (params = {}) => {
  const response = await api.get('/safety-walk', { params });
  return response.data;
};

/**
 * Buscar detalhes de uma inspeção específica
 * @param {string} id - ID da inspeção
 * @returns {Promise} Detalhes da inspeção
 */
export const getSafetyWalkById = async (id) => {
  const response = await api.get(`/safety-walk/${id}`);
  return response.data;
};

/**
 * Exportar dados do Safety Walk para Excel
 * @param {Object} params - Parâmetros de filtro
 * @returns {Promise} Arquivo Excel
 */
export const exportSafetyWalk = async (params = {}) => {
  const response = await api.get('/safety-walk/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Sincronizar dados do Google Sheets
 * @returns {Promise} Resultado da sincronização
 */
export const syncSafetyWalk = async () => {
  const response = await api.post('/safety-walk/sync');
  return response.data;
};
