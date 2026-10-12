const { prisma } = require("../../config/database");
const { getStatusDocas } = require("./dockManagementSheets.service");

// Tempo sem veículo na doca (idle_time do pátio) até a equipe ser desatrelada sozinha. A folga evita
// liberar entre um caminhão e o próximo, quando a mesma equipe segue na doca.
const MINUTOS_SEM_VEICULO = 10;

const USUARIO_AUTOMATICO = "Automático (sem veículo na doca)";

/**
 * Libera as docas cuja equipe ficou sem veículo: o pátio mostra a doca livre há pelo menos
 * MINUTOS_SEM_VEICULO, sem caminhão aguardando, e o último veículo saiu DEPOIS de a equipe ser alocada.
 * Equipe posicionada depois da saída do último veículo (esperando o próximo) não é mexida. Se a
 * planilha falhar ou a doca não constar nela, não libera nada.
 */
async function liberarDocasSemVeiculo() {
  const statusMap = await getStatusDocas();
  if (!statusMap.size) return { liberadas: 0 };

  const alocacoes = await prisma.mapaAlocacao.findMany({
    where: { numeroDoca: { not: null }, fim: null },
    include: { time: { select: { nome: true } } },
  });

  const agora = Date.now();
  let liberadas = 0;

  for (const a of alocacoes) {
    const doca = statusMap.get(a.numeroDoca);
    if (!doca || doca.fisicamenteOcupada || doca.caminhoesAguardando > 0) continue;
    if (doca.ociosaSegundos < MINUTOS_SEM_VEICULO * 60) continue;

    const veiculoSaiuEm = agora - doca.ociosaSegundos * 1000;
    if (a.inicio.getTime() > veiculoSaiuEm) continue; // equipe chegou depois da saída: espera o próximo veículo

    // Condição fim:null no update: se alguém liberou na mesma hora, não grava histórico duplicado.
    const { count } = await prisma.mapaAlocacao.updateMany({ where: { idAlocacao: a.idAlocacao, fim: null }, data: { fim: new Date() } });
    if (!count) continue;

    await prisma.mapaDocaHistorico.create({
      data: {
        idEstacao: a.idEstacao,
        numeroDoca: a.numeroDoca,
        acao: "LIBERADA",
        operacao: a.operacaoDoca,
        idTime: a.idTime,
        nomeTime: a.time?.nome ?? null,
        usuarioNome: USUARIO_AUTOMATICO,
      },
    });
    liberadas += 1;
  }

  return { liberadas };
}

module.exports = { liberarDocasSemVeiculo, MINUTOS_SEM_VEICULO };
