const { prisma } = require("../../config/database");
const { normaliza } = require("./base");

/* =====================================================
   Áreas operacionais e quem pode operar cada uma.

   Regra: o usuário autorizado de uma área é o LÍDER DE OPERAÇÕES daquele
   setor — o setor dele é o do colaborador ligado ao usuário (User.opsId):
     Esteira A ou Esteira B  -> Esteira U (U = A + B)
     Esteira C               -> Full e Full D+1 (os dois saem da Esteira C)
     Esteira Linear          -> Linear
     Esteira Termoplástica   -> Termoplástica
     Expedição               -> Expedição
     Recebimento             -> Recebimento
   ADMIN e ALTA_GESTAO operam todas as áreas (gestão/suporte).
===================================================== */

const ROLES_TODAS_AS_AREAS = ["ADMIN", "ALTA_GESTAO"];

async function listarAreas() {
  return prisma.mapaArea.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } });
}

/** Códigos de área que o setor do colaborador indica. */
function codigosDoSetor(nomeSetor) {
  const n = normaliza(nomeSetor);
  if (n === "expedicao") return ["EXPEDICAO"];
  if (n === "recebimento") return ["RECEBIMENTO"];
  if (n.startsWith("esteira linear")) return ["LINEAR"];
  if (n.startsWith("esteira termoplastica")) return ["TERMOPLASTICA"];
  if (n === "esteira a" || n === "esteira b") return ["ESTEIRA_U"];
  if (n === "esteira c") return ["FULL", "FULL_D1"];
  return [];
}

/** Conjunto de idArea que o usuário pode operar. */
async function areasPermitidas(user) {
  const areas = await listarAreas();
  if (ROLES_TODAS_AS_AREAS.includes(user.role)) return new Set(areas.map((a) => a.idArea));

  if (!user.opsId) return new Set();

  // O opsId do usuário e o do colaborador podem diferir só em maiúscula/minúscula ("ops471046" x "Ops471046"):
  // a busca exata não achava o colaborador e a pessoa ficava sem nenhum setor para operar.
  const colaborador = await prisma.colaborador.findFirst({
    where: { opsId: { equals: String(user.opsId).trim(), mode: "insensitive" } },
    select: { setor: { select: { nomeSetor: true } } },
  });
  const codigos = codigosDoSetor(colaborador?.setor?.nomeSetor);
  return new Set(areas.filter((a) => codigos.includes(a.codigo)).map((a) => a.idArea));
}

module.exports = { listarAreas, areasPermitidas, codigosDoSetor };
