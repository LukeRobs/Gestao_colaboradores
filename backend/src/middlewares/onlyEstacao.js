/**
 * Middleware: restringe acesso a uma lista de estações.
 * ADMIN global (sem estacaoId no dbContext) sempre passa.
 *
 * Uso: router.use(onlyEstacao([1]))
 */
module.exports = function onlyEstacao(estacaoIds = []) {
  return (req, res, next) => {
    // ADMIN sem filtro de estação → acesso total
    if (req.dbContext?.isGlobal) return next();

    const estacaoId = req.dbContext?.estacaoId ?? req.user?.idEstacao ?? null;

    if (!estacaoId || !estacaoIds.includes(estacaoId)) {
      return res.status(403).json({
        success: false,
        message: "Este módulo não está disponível para a sua estação.",
      });
    }

    next();
  };
};
