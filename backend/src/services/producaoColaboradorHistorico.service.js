const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { buscarProdutividadeDetalhada } = require("./googleSheetsMetaProducao.service");

/**
 * Salva o histórico de produtividade por colaborador no banco
 * @param {string} turno - T1, T2 ou T3
 * @param {string} dataStr - Data no formato YYYY-MM-DD
 */
async function salvarProducaoColaboradorHistorico(turno, dataStr = null) {
  try {
    if (!dataStr) {
      const agora = new Date();
      const spString = agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      dataStr = new Date(spString).toISOString().slice(0, 10);
    }

    console.log(`\n💾 [HISTÓRICO COLABORADOR] Iniciando salvamento`);
    console.log(`📅 Data: ${dataStr} | 🕐 Turno: ${turno}`);

    // Buscar colaboradores do turno no banco
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
    const colaboradores = await prisma.colaborador.findMany({
      where: { turno: { idTurno: turnoId }, status: "ATIVO" },
      include: { setor: true },
    });

    console.log(`✅ ${colaboradores.length} colaboradores encontrados no ${turno}`);

    // Buscar dados da planilha
    const prodResult = await buscarProdutividadeDetalhada(dataStr, turno);
    const dadosPlanilha = prodResult.success ? prodResult.data : [];

    console.log(`✅ ${dadosPlanilha.length} colaboradores com dados na planilha`);

    // Mapear por opsId e por nome para matching
    const removerAcentos = (str) =>
      String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    const porOpsId = new Map();
    const porNome = new Map();
    dadosPlanilha.forEach((item) => {
      if (item.opsId) porOpsId.set(item.opsId.toLowerCase(), item);
      porNome.set(removerAcentos(item.nome), item);
    });

    let salvos = 0;

    for (const colab of colaboradores) {
      const opsIdNorm = colab.opsId?.toLowerCase();
      const nomeNorm = removerAcentos(colab.nomeCompleto);
      const dados = (opsIdNorm && porOpsId.get(opsIdNorm)) || porNome.get(nomeNorm);

      const total = dados?.total || 0;
      const dadosPorHora = dados?.dadosPorHora || {};

      await prisma.producaoColaboradorHistorico.upsert({
        where: {
          dataReferencia_turno_opsId: {
            dataReferencia: new Date(dataStr),
            turno,
            opsId: colab.opsId,
          },
        },
        update: {
          nomeCompleto: colab.nomeCompleto,
          setor: colab.setor?.nomeSetor || null,
          total,
          dadosPorHora,
          updatedAt: new Date(),
        },
        create: {
          dataReferencia: new Date(dataStr),
          turno,
          opsId: colab.opsId,
          nomeCompleto: colab.nomeCompleto,
          setor: colab.setor?.nomeSetor || null,
          total,
          dadosPorHora,
        },
      });

      salvos++;
    }

    console.log(`✅ [HISTÓRICO COLABORADOR] ${salvos} registros salvos`);
    return { success: true, message: `${turno} salvo com sucesso`, registros: salvos };
  } catch (error) {
    console.error(`❌ [HISTÓRICO COLABORADOR] Erro:`, error.message);
    return { success: false, message: error.message };
  }
}

async function verificarRegistroExistente(turno, dataStr) {
  const count = await prisma.producaoColaboradorHistorico.count({
    where: { turno, dataReferencia: new Date(dataStr) },
  });
  return count > 0;
}

module.exports = { salvarProducaoColaboradorHistorico, verificarRegistroExistente };
