/**
 * Grupos de estações "irmãs" — usuário (LIDERANCA/ALTA_GESTAO) de uma pode
 * trocar o seletor pra outra do mesmo grupo, com o mesmo nível de acesso.
 * Hoje só um grupo. Adicionar um novo par/trio no futuro é só acrescentar
 * um array aqui — nenhum outro ponto do sistema precisa mudar.
 */
const GRUPOS_ESTACOES = [
  [1, 6], // SoC_PE_Jabotao_dos_Guararapes + SoC_PE_Recife
];

/**
 * Retorna as estações do mesmo grupo que idEstacao (incluindo ela mesma),
 * ou [idEstacao] se ela não pertence a nenhum grupo, ou [] se idEstacao
 * for nulo/indefinido.
 */
function getEstacoesDoGrupo(idEstacao) {
  if (idEstacao === null || idEstacao === undefined) return [];
  const grupo = GRUPOS_ESTACOES.find((g) => g.includes(idEstacao));
  return grupo ? [...grupo] : [idEstacao];
}

module.exports = { GRUPOS_ESTACOES, getEstacoesDoGrupo };
