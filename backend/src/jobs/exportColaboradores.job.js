const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { exportarColaboradores } = require('../services/googleSheetsColaboradores.service');

const prisma = new PrismaClient();

// 🔄 Configuração do intervalo de exportação
const EXPORT_ENABLED = process.env.EXPORT_COLABORADORES_ENABLED !== 'false';
const INTERVAL_HORAS = Number(process.env.EXPORT_COLABORADORES_INTERVAL_HORAS) || 2;

// 📊 Job de exportação automática de colaboradores
const iniciarJobExportColaboradores = () => {
  if (!EXPORT_ENABLED) {
    console.log('⚠️ Exportação automática de colaboradores desabilitada (EXPORT_COLABORADORES_ENABLED=false)');
    return;
  }

  console.log(`🚀 Iniciando job de exportação de colaboradores`);
  console.log(`⏰ Intervalo: a cada ${INTERVAL_HORAS} horas`);

  // Executar imediatamente na inicialização
  executarExport();

  // Agendar execução periódica no minuto 0, a cada N horas
  const cronExpression = `0 */${INTERVAL_HORAS} * * *`;

  cron.schedule(cronExpression, () => {
    executarExport();
  });

  console.log('✅ Job de exportação de colaboradores iniciado com sucesso\n');
};

// 🔄 Executar exportação e atualizar o controle de última/próxima execução
const executarExport = async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n⏰ [${timestamp}] Executando exportação de colaboradores...`);

  const agora = new Date();
  const proximaExecucao = new Date(agora.getTime() + INTERVAL_HORAS * 60 * 60 * 1000);

  try {
    const resultado = await exportarColaboradores(prisma);

    await prisma.exportColaboradoresConfig.upsert({
      where: { id: 1 },
      update: {
        ultimaExecucao: agora,
        proximaExecucao,
        status: 'SUCESSO',
        mensagemErro: null,
        totalRegistros: resultado.data.totalRegistros,
      },
      create: {
        id: 1,
        ultimaExecucao: agora,
        proximaExecucao,
        status: 'SUCESSO',
        totalRegistros: resultado.data.totalRegistros,
      },
    });

    console.log(`✅ Exportação concluída: ${resultado.data.totalRegistros} colaboradores`);
    console.log(`🔗 Planilha: ${resultado.data.spreadsheetUrl}`);

    return resultado;
  } catch (error) {
    console.error(`❌ Erro na exportação de colaboradores:`, error.message);

    await prisma.exportColaboradoresConfig.upsert({
      where: { id: 1 },
      update: {
        ultimaExecucao: agora,
        proximaExecucao,
        status: 'ERRO',
        mensagemErro: error.message,
      },
      create: {
        id: 1,
        ultimaExecucao: agora,
        proximaExecucao,
        status: 'ERRO',
        mensagemErro: error.message,
      },
    });

    throw error;
  }
};

module.exports = {
  iniciarJobExportColaboradores,
  executarExport,
};
