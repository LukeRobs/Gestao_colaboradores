/**
 * Auditoria de mudança de status do colaborador (ATIVO, INATIVO, FERIAS, AFASTADO...).
 *
 * `comAuditoriaStatus` envolve a operação que altera o status: lê o status antes,
 * executa, lê depois e, se mudou, grava quem/de/para/quando/origem NA MESMA
 * conexão (dentro da transação, quando `client` é um `tx`).
 *
 * Quando o colaborador passa a INATIVO (qualquer origem: edição, solicitação de desligamento,
 * job de desligamento agendado), o acesso dele ao sistema também é inativado: o usuário ligado
 * a ele (users.ops_id) fica com isActive = false. A autenticação confere isActive a cada
 * requisição, então a sessão aberta também deixa de funcionar. A reativação do colaborador
 * NÃO devolve o acesso sozinha (é uma decisão de segurança, feita na tela de usuários).
 *
 * Seguro antes da migração: se a tabela ainda não existe (ou o client Prisma não
 * foi regenerado), apenas executa a operação sem auditar — nunca derruba o fluxo.
 */
const { prisma } = require("../config/database");

let tabelaOk = null;
let ultimaChecagem = 0;
const RECHECAR_MS = 60 * 1000;

async function auditoriaDisponivel() {
  if (tabelaOk === true) return true;
  if (tabelaOk === false && Date.now() - ultimaChecagem < RECHECAR_MS) return false;

  ultimaChecagem = Date.now();
  try {
    const [{ existe }] = await prisma.$queryRaw`SELECT to_regclass('public.colaborador_status_auditoria') IS NOT NULL AS existe`;
    tabelaOk = Boolean(existe) && Boolean(prisma.colaboradorStatusAuditoria);
  } catch {
    tabelaOk = false;
  }
  return tabelaOk;
}

/**
 * Inativa o(s) usuário(s) de acesso ligado(s) ao colaborador: pelo Ops ID e, se o usuário não tem
 * Ops ID gravado, pelo mesmo e-mail. Nunca inativa o próprio usuário que está executando a ação
 * (evita se trancar para fora). Devolve a quantidade de usuários inativados.
 *
 * @param {object} client prisma ou tx
 * @param {{opsId:string, email?:string|null, exceptUserId?:string|null}} alvo
 */
async function desativarAcessosDoColaborador(client, { opsId, email = null, exceptUserId = null }) {
  const ligacao = [{ opsId }];
  if (email) ligacao.push({ opsId: null, email: { equals: String(email).trim(), mode: "insensitive" } });

  const r = await client.user.updateMany({
    where: { isActive: true, OR: ligacao, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    data: { isActive: false },
  });
  return r.count;
}

/**
 * @param {object} client prisma ou tx
 * @param {{opsId:string, userId?:string|null, origem:string, detalhe?:string|null, saida?:object}} ctx
 *        `saida` (opcional) recebe `acessosDesativados` com a quantidade de usuários inativados.
 * @param {() => Promise<any>} executar operação que altera o colaborador
 */
async function comAuditoriaStatus(client, { opsId, userId = null, origem, detalhe = null, saida = null }, executar) {
  const auditar = (await auditoriaDisponivel()) && Boolean(client.colaboradorStatusAuditoria);

  const antes = await client.colaborador.findUnique({ where: { opsId }, select: { status: true } });
  const resultado = await executar();
  const depois = await client.colaborador.findUnique({ where: { opsId }, select: { status: true, email: true } });

  if (antes && depois && antes.status !== depois.status) {
    let detalheFinal = detalhe;

    if (depois.status === "INATIVO") {
      const n = await desativarAcessosDoColaborador(client, { opsId, email: depois.email, exceptUserId: userId });
      if (saida) saida.acessosDesativados = n;
      if (n > 0) detalheFinal = [detalhe, `acesso ao sistema inativado (${n})`].filter(Boolean).join(" | ");
    }

    if (auditar) {
      await client.colaboradorStatusAuditoria.create({
        data: { opsId, statusAnterior: antes.status, statusNovo: depois.status, alteradoPor: userId, origem, detalhe: detalheFinal },
      });
    }
  }

  return resultado;
}

async function listarAuditoriaStatus(opsId) {
  if (!(await auditoriaDisponivel())) return null;

  const registros = await prisma.colaboradorStatusAuditoria.findMany({ where: { opsId }, orderBy: { criadoEm: "desc" } });
  const ids = [...new Set(registros.map((r) => r.alteradoPor).filter(Boolean))];
  const usuarios = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nomePorId = new Map(usuarios.map((u) => [u.id, u.name]));

  return registros.map((r) => ({ ...r, alteradoPorNome: r.alteradoPor ? nomePorId.get(r.alteradoPor) ?? null : "Sistema" }));
}

module.exports = { comAuditoriaStatus, desativarAcessosDoColaborador, listarAuditoriaStatus, auditoriaDisponivel };
