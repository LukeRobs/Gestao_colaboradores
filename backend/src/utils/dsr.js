/**
 * Utilitário central de DSR.
 * Fonte única de verdade para identificar dias de DSR por escala.
 * Usa o campo diasDsr do banco; fallback legado apenas para escalas antigas sem diasDsr.
 */

const { prisma } = require("../config/database");

// Cache em memória para evitar queries repetidas (TTL = 10 min)
const _cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function getDiasDsr(nomeEscala, tx = prisma) {
  if (!nomeEscala) return [];

  const cacheKey = String(nomeEscala).toUpperCase();
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.dias;

  const escala = await tx.escala.findFirst({
    where: { nomeEscala: { equals: nomeEscala, mode: "insensitive" } },
    select: { diasDsr: true },
  });

  // diasDsr preenchido no banco → usa
  if (escala?.diasDsr?.length) {
    _cache.set(cacheKey, { dias: escala.diasDsr, ts: Date.now() });
    return escala.diasDsr;
  }

  // Fallback legado apenas enquanto houver escalas sem diasDsr
  const legado = { E: [0, 1], G: [2, 3], C: [4, 5] };
  const dias = legado[cacheKey] ?? [];
  _cache.set(cacheKey, { dias, ts: Date.now() });
  return dias;
}

/**
 * Verifica se uma data específica é DSR para uma escala.
 * @param {Date|string} data
 * @param {string} nomeEscala
 * @param {object} tx - transação Prisma opcional
 */
async function isDiaDSR(data, nomeEscala, tx = prisma) {
  const dias = await getDiasDsr(nomeEscala, tx);
  const dow = new Date(data).getUTCDay(); // UTC: consistente com Date.UTC() usado na construção das datas
  return dias.includes(dow);
}

/**
 * Versão síncrona — usa apenas o mapa legado ou diasDsr já carregado.
 * Use apenas quando não for possível usar async (ex: dentro de loops síncronos com dados já carregados).
 * Prefira isDiaDSR sempre que possível.
 */
function isDiaDSRSync(data, diasDsr = []) {
  const dow = new Date(data).getUTCDay(); // UTC: consistente com Date.UTC() usado na construção das datas
  return diasDsr.includes(dow);
}

module.exports = { getDiasDsr, isDiaDSR, isDiaDSRSync };
