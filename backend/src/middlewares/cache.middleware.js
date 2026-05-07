const { cacheGet, cacheSet } = require("../services/redis.service");

const TTL = {
  OPERATIONAL: 90,    // presença/dashboard operacional — 90s
  ANALYTICS:   300,   // dashboards analíticos — 5min
  REPORT:      1800,  // relatórios históricos — 30min
};

/**
 * Constrói chave de cache contextualizada por estação + query params.
 * Nunca cacheia sem contexto de estação.
 */
function buildKey(prefix, req) {
  const estacaoId = req.dbContext?.estacaoId ?? "global";
  const params = new URLSearchParams(req.query).toString();
  return `${prefix}:estacao:${estacaoId}:${params || "default"}`;
}

/**
 * Middleware de cache genérico.
 * @param {string} prefix  — prefixo da chave (ex: "dashboard", "absenteismo")
 * @param {number} ttl     — TTL em segundos (usar constantes TTL acima)
 */
function withCache(prefix, ttl = TTL.ANALYTICS) {
  return async (req, res, next) => {
    // Só cacheia GET
    if (req.method !== "GET") return next();

    const key = buildKey(prefix, req);

    const cached = await cacheGet(key);
    if (cached !== null) {
      return res.status(200).json(cached);
    }

    // Intercepta res.json para salvar no cache após resposta
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Salva apenas respostas de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        cacheSet(key, body, ttl).catch(() => {}); // fire and forget
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { withCache, TTL };
