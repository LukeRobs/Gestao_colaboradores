/**
 * Utilitário central de DSR.
 * Fonte única de verdade para identificar dias de DSR por escala.
 * Usa o campo diasDsr do banco; fallback legado apenas para escalas antigas sem diasDsr.
 */

const { prisma } = require("../config/database");

// Cache em memória para evitar queries repetidas (TTL = 10 min)
const _cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function getDiasDsr(nomeEscala, tx = prisma, idEstacao = null) {
  if (!nomeEscala) return [];

  const nome = String(nomeEscala).toUpperCase();
  const cacheKey = idEstacao != null ? `${nome}:${idEstacao}` : nome;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.dias;

  // Busca prioritária: nome + estação (evita colisão quando a mesma escala existe em múltiplas estações)
  let escala = idEstacao != null
    ? await tx.escala.findFirst({
        where: { nomeEscala: { equals: nomeEscala, mode: "insensitive" }, idEstacao },
        select: { diasDsr: true },
      })
    : null;

  // Fallback: busca só pelo nome se não encontrou com estação
  if (!escala) {
    escala = await tx.escala.findFirst({
      where: { nomeEscala: { equals: nomeEscala, mode: "insensitive" } },
      select: { diasDsr: true },
    });
  }

  // diasDsr preenchido no banco → usa
  if (escala?.diasDsr?.length) {
    _cache.set(cacheKey, { dias: escala.diasDsr, ts: Date.now() });
    return escala.diasDsr;
  }

  // Fallback legado apenas enquanto houver escalas sem diasDsr
  const legado = { E: [0, 1], G: [2, 3], C: [4, 5] };
  const dias = legado[nome] ?? [];
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

// Escalas elegíveis à folga dominical automática (mesma regra do folgaDominical.service)
const ESCALAS_FOLGA_DOMINICAL = ["B", "C", "G", "I"];
const JUSTIFICATIVA_FOLGA_DOMINICAL = "DSR_FOLGA_DOMINICAL_AUTOMATICA";

/**
 * Filtro extra para o deleteMany de DSR futuro em troca de escala: se a nova
 * escala também participa da folga dominical, preserva a folga já gerada.
 */
function preservarFolgaDominicalWhere(nomeNovaEscala) {
  if (!ESCALAS_FOLGA_DOMINICAL.includes(String(nomeNovaEscala).toUpperCase())) return {};
  return { OR: [{ justificativa: null }, { justificativa: { not: JUSTIFICATIVA_FOLGA_DOMINICAL } }] };
}

module.exports = { getDiasDsr, isDiaDSR, isDiaDSRSync, preservarFolgaDominicalWhere };
