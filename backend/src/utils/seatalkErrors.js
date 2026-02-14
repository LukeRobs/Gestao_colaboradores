/**
 * Códigos de erro da API do Seatalk
 * Referência: https://open.seatalk.io/docs/reference_server-api-error-code
 */

const SEATALK_ERROR_CODES = {
  0: "Success",
  100: "App access token is expired or invalid",
  101: "User access token is expired or invalid",
  102: "Tenant access token is expired or invalid",
  103: "Invalid authorization type",
  104: "Invalid authorization header",
  105: "Authorization header is missing",
  
  200: "Invalid request parameters",
  201: "Request parameter is missing",
  202: "Invalid request body",
  
  300: "Permission denied",
  301: "Bot not in group",
  302: "Bot is not a group member",
  303: "Bot has been removed from group",
  
  400: "Resource not found",
  401: "Group not found",
  402: "User not found",
  403: "Message not found",
  
  500: "Internal server error",
  501: "Service temporarily unavailable",
  502: "Rate limit exceeded",
  503: "Request timeout",
  
  600: "Invalid app_id or app_secret",
  601: "App is disabled",
  602: "App has no permission",
  
  7000: "Invalid request - check group_id, message format, or bot permissions",
}

/**
 * Obtém mensagem de erro amigável baseada no código
 * @param {number} code - Código de erro da API
 * @returns {string} Mensagem de erro
 */
function getSeatalkErrorMessage(code) {
  return SEATALK_ERROR_CODES[code] || `Unknown error (code: ${code})`
}

/**
 * Verifica se o erro é relacionado a autenticação
 * @param {number} code - Código de erro
 * @returns {boolean}
 */
function isAuthError(code) {
  return [100, 101, 102, 103, 104, 105, 600].includes(code)
}

/**
 * Verifica se o erro é relacionado a permissões
 * @param {number} code - Código de erro
 * @returns {boolean}
 */
function isPermissionError(code) {
  return [300, 301, 302, 303, 602].includes(code)
}

/**
 * Verifica se o erro é temporário (pode tentar novamente)
 * @param {number} code - Código de erro
 * @returns {boolean}
 */
function isRetryableError(code) {
  return [500, 501, 502, 503].includes(code)
}

/**
 * Cria erro customizado com informações do Seatalk
 * @param {object} response - Resposta da API do Seatalk
 * @returns {Error}
 */
function createSeatalkError(response) {
  const code = response.code || response.data?.code
  const message = response.message || response.data?.message
  
  const errorMessage = getSeatalkErrorMessage(code)
  const fullMessage = `Seatalk API Error (${code}): ${errorMessage}`
  
  const error = new Error(fullMessage)
  error.code = code
  error.seatalkMessage = message
  error.isAuthError = isAuthError(code)
  error.isPermissionError = isPermissionError(code)
  error.isRetryable = isRetryableError(code)
  
  return error
}

/**
 * Obtém sugestão de solução baseada no código de erro
 * @param {number} code - Código de erro
 * @returns {string}
 */
function getSolution(code) {
  const solutions = {
    100: "Verifique se SEATALK_APP_ID e SEATALK_APP_SECRET estão corretos no .env",
    101: "Token de usuário expirado. Faça login novamente.",
    102: "Token de tenant expirado. Renove o token.",
    103: "Tipo de autorização inválido. Use 'Bearer'.",
    104: "Header de autorização inválido. Formato: 'Authorization: Bearer <token>'",
    105: "Header de autorização ausente. Adicione o token na requisição.",
    
    200: "Verifique os parâmetros da requisição.",
    201: "Parâmetro obrigatório ausente. Verifique a documentação.",
    202: "Body da requisição inválido. Verifique o formato JSON.",
    
    300: "Permissão negada. Verifique as permissões do bot.",
    301: "Bot não está no grupo. Adicione o bot ao grupo.",
    302: "Bot não é membro do grupo. Adicione o bot como membro.",
    303: "Bot foi removido do grupo. Adicione novamente.",
    
    400: "Recurso não encontrado.",
    401: "Grupo não encontrado. Verifique o group_id.",
    402: "Usuário não encontrado.",
    403: "Mensagem não encontrada.",
    
    500: "Erro interno do servidor. Tente novamente mais tarde.",
    501: "Serviço temporariamente indisponível. Tente novamente.",
    502: "Limite de requisições excedido. Aguarde 1 minuto.",
    503: "Timeout na requisição. Tente novamente.",
    
    600: "App ID ou App Secret inválidos. Verifique as credenciais.",
    601: "App está desabilitado. Habilite no console do Seatalk.",
    602: "App não tem permissão. Habilite 'Send Message to Group Chat'.",
    
    7000: "Requisição inválida. Verifique: 1) Bot está no grupo? 2) Group ID correto? 3) Formato da mensagem está correto?",
  }
  
  return solutions[code] || "Consulte a documentação do Seatalk."
}

module.exports = {
  SEATALK_ERROR_CODES,
  getSeatalkErrorMessage,
  isAuthError,
  isPermissionError,
  isRetryableError,
  createSeatalkError,
  getSolution,
}
