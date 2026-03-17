const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { buscarProdutividadeDetalhada } = require("./googleSheetsMetaProducao.service");

/**
 * Salva o histórico de produtividade por colaborador no banco.
 * - Só persiste quem tem total > 0 (evita poluir o banco com zeros)
 * - Usa upsert para sobrescrever em vez de duplicar
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

    // Buscar dados da planilha
    const prodResult = await buscarProdutividadeDetalhada(dataStr, turno);
    const dadosPlanilha = prodResult.success ? prodResult.data : [];

    console.log(`✅ ${dadosPlanilha.length} colaboradores com dados na planilha`);

    // Filtrar apenas quem tem produção real
    const comProducao = dadosPlanilha.filter((item) => (item.total || 0) > 0);
    console.log(`📊 ${comProducao.length} colaboradores com total > 0 (serão salvos)`);

    if (comProducao.length === 0) {
      console.log(`ℹ️ [HISTÓRICO COLABORADOR] Nenhum dado para salvar no momento`);
      return { success: true, message: `Nenhum dado com produção para ${turno}`, registros: 0 };
    }

    // Buscar colaboradores do banco para enriquecer com setor
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
    const colaboradoresBanco = await prisma.colaborador.findMany({
      where: { turno: { idTurno: turnoId }, status: "ATIVO" },
      select: {
        opsId: true,
        nomeCompleto: true,
        setor: { select: { nomeSetor: true } },
      },
    });

    const bancoPorOpsId = new Map();
    colaboradoresBanco.forEach((c) => {
      if (c.opsId) bancoPorOpsId.set(c.opsId.toLowerCase(), c);
    });

    let salvos = 0;
    let semOpsId = 0;

    for (const item of comProducao) {
      const opsIdNorm = item.opsId?.toLowerCase();

      if (!opsIdNorm) {
        console.warn(`⚠️ Item sem OpsId na planilha: ${item.nome}, pulando...`);
        semOpsId++;
        continue;
      }

      const colabBanco = bancoPorOpsId.get(opsIdNorm);
      const opsIdFinal = colabBanco?.opsId || item.opsId;
      const nomeFinal = colabBanco?.nomeCompleto || item.nome;
      const setorFinal = colabBanco?.setor?.nomeSetor || null;

      try {
        await prisma.producaoColaboradorHistorico.upsert({
          where: {
            dataReferencia_turno_opsId: {
              dataReferencia: new Date(dataStr),
              turno,
              opsId: opsIdFinal,
            },
          },
          update: {
            nomeCompleto: nomeFinal,
            setor: setorFinal,
            total: item.total,
            dadosPorHora: item.dadosPorHora,
          },
          create: {
            dataReferencia: new Date(dataStr),
            turno,
            opsId: opsIdFinal,
            nomeCompleto: nomeFinal,
            setor: setorFinal,
            total: item.total,
            dadosPorHora: item.dadosPorHora,
          },
        });

        salvos++;
        console.log(`  ✅ Salvo: ${opsIdFinal} | ${nomeFinal} | total: ${item.total}`);
      } catch (errItem) {
        console.error(`  ❌ Erro ao salvar ${opsIdFinal} (${nomeFinal}):`, errItem.message);
      }
    }

    if (semOpsId > 0) {
      console.warn(`⚠️ ${semOpsId} itens ignorados por não ter OpsId na planilha`);
    }

    console.log(`✅ [HISTÓRICO COLABORADOR] ${salvos} registros salvos/atualizados`);
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

/**
 * Disparo manual para debug — executa o salvamento imediatamente
 */
async function dispararSalvamentoManual(turno, dataStr) {
  console.log(`\n🧪 [MANUAL] Disparando salvamento manual — Turno: ${turno} | Data: ${dataStr}`);
  return salvarProducaoColaboradorHistorico(turno, dataStr);
}

module.exports = { salvarProducaoColaboradorHistorico, verificarRegistroExistente, dispararSalvamentoManual };
