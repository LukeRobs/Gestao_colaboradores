const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sincronizarControlePresenca } = require('../services/googleSheetsPresenca.service');

const prisma = new PrismaClient();

// 🔄 Configuração do intervalo de sincronização
const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES || 5;
const SYNC_ENABLED = process.env.SYNC_ENABLED === 'true';

// 📊 Job de sincronização automática
const iniciarSyncPresencaSheets = () => {
  if (!SYNC_ENABLED) {
    console.log('⚠️ Sincronização automática de presença desabilitada (SYNC_ENABLED=false)');
    return;
  }

  console.log(`🚀 Iniciando job de sincronização de presença`);
  console.log(`⏰ Intervalo: a cada ${SYNC_INTERVAL} minutos`);

  // Executar imediatamente na inicialização
  executarSincronizacao();

  // Agendar execução periódica
  // Formato: */5 * * * * = a cada 5 minutos
  const cronExpression = `*/${SYNC_INTERVAL} * * * *`;
  
  cron.schedule(cronExpression, () => {
    executarSincronizacao();
  });

  console.log('✅ Job de sincronização iniciado com sucesso\n');
};

// 🔄 Executar sincronização
const executarSincronizacao = async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n⏰ [${timestamp}] Executando sincronização de presença...`);

  try {
    const resultado = await sincronizarControlePresenca(prisma);
    
    if (resultado.success) {
      console.log(`✅ Sincronização concluída com sucesso`);
      console.log(`📊 ${resultado.data.colaboradores} colaboradores | ${resultado.data.celulasAtualizadas} células atualizadas`);
      console.log(`🔗 Planilha: ${resultado.data.spreadsheetUrl}`);
    } else {
      console.log(`⚠️ Sincronização sem dados: ${resultado.message}`);
    }
  } catch (error) {
    console.error(`❌ Erro na sincronização:`, error.message);
  }
};

module.exports = {
  iniciarSyncPresencaSheets,
};
