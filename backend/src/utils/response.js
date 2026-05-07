/**
 * Utilitários de Resposta HTTP
 * Padroniza respostas da API
 */

const successResponse = (
  res,
  data = null,
  message = "Operação realizada com sucesso",
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (
  res,
  message = "Erro ao processar requisição",
  statusCode = 400,
  errors = null
) => {
  return res.status(Number(statusCode)).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};

const createdResponse = (res, data, message = "Recurso criado com sucesso") => {
  return successResponse(res, data, message, 201);
};

const deletedResponse = (res, message = "Recurso excluído com sucesso") => {
  return successResponse(res, null, message, 200);
};

const notFoundResponse = (res, message = "Recurso não encontrado") => {
  return errorResponse(res, message, 404);
};

const unauthorizedResponse = (res, message = "Não autorizado") => {
  return errorResponse(res, message, 401);
};

const forbiddenResponse = (res, message = "Acesso negado") => {
  return errorResponse(res, message, 403);
};

const paginatedResponse = (
  res,
  data,
  pagination,
  message = "Dados recuperados com sucesso"
) => {
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    },
  });
};

module.exports = {
  successResponse,
  errorResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  paginatedResponse,
};
