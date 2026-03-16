module.exports = function blockOperacao(req, res, next) {
  if (req.user && req.user.role === "OPERACAO") {
    // Permitir acesso a rotas específicas
    if (
      req.originalUrl.startsWith("/api/ponto") ||
      req.originalUrl.startsWith("/api/auth") ||
      req.originalUrl.startsWith("/api/dashboard/gestao-operacional") ||
      req.originalUrl.startsWith("/api/dashboard/produtividade-colaborador")
    ) {
      return next();
    }

    return res.status(403).json({
      message: "Acesso restrito para perfil Operação",
    });
  }

  next();
};
