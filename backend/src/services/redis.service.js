const { Redis } = require("@upstash/redis");
const logger = require("../utils/logger");

let client = null;

function getClient() {
  if (client) return client;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // cache desabilitado — sistema funciona sem Redis
  }

  client = new Redis({ url, token });
  return client;
}

/**
 * Busca valor do cache.
 * Retorna null se não encontrado, Redis offline ou cache desabilitado.
 */
async function cacheGet(key) {
  const redis = getClient();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (value !== null) {
      logger.debug(`[CACHE HIT] ${key}`);
    }
    return value;
  } catch (err) {
    logger.warn(`[CACHE GET ERROR] ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Salva valor no cache com TTL em segundos.
 * Falha silenciosa — não bloqueia resposta.
 */
async function cacheSet(key, value, ttlSeconds) {
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    logger.debug(`[CACHE SET] ${key} (ttl=${ttlSeconds}s)`);
  } catch (err) {
    logger.warn(`[CACHE SET ERROR] ${key}: ${err.message}`);
  }
}

/**
 * Invalida chaves por padrão (prefixo).
 * Uso: invalidar cache de uma estação ao atualizar dados.
 */
async function cacheInvalidate(pattern) {
  const redis = getClient();
  if (!redis) return;

  try {
    let cursor = 0;
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);

    if (deleted > 0) {
      logger.debug(`[CACHE INVALIDATE] pattern="${pattern}" deleted=${deleted}`);
    }
  } catch (err) {
    logger.warn(`[CACHE INVALIDATE ERROR] ${pattern}: ${err.message}`);
  }
}

function isEnabled() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, isEnabled };
