/**
 * Servidor Principal
 * Inicia o servidor Express e conecta ao banco de dados
 */

const app = require('./app');
const config = require('./config/config');
const { testConnection } = require('./config/database');
const logger = require('./utils/logger');
const { iniciarSyncPresencaSheets } = require('./jobs/syncPresencaSheets.job');

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================

const startServer = async () => {
  try {
    // Testa a conexão com o banco de dados
    await testConnection();

    // Inicia o servidor
    const server = app.listen(config.port, () => {
      logger.success('='.repeat(50));
      logger.success('🚀 SERVIDOR INICIADO COM SUCESSO!');
      logger.success('='.repeat(50));
      logger.info(`📍 Ambiente: ${config.env}`);
      logger.info(`🌐 URL: http://localhost:${config.port}`);
      logger.info(`📊 API: http://localhost:${config.port}/api`);
      logger.info(`❤️  Health Check: http://localhost:${config.port}/api/health`);
      logger.success('='.repeat(50));
      
      // Inicia job de sincronização de presença com Google Sheets
      logger.info('🔄 Iniciando jobs automáticos...');
      iniciarSyncPresencaSheets();
    });

    // Tratamento de erros não capturados
    process.on('unhandledRejection', (err) => {
      logger.error('❌ ERRO NÃO TRATADO (Unhandled Rejection):');
      logger.error(err);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error('❌ ERRO NÃO CAPTURADO (Uncaught Exception):');
      logger.error(err);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.warn('⚠️  SIGTERM recebido. Encerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.warn('\n⚠️  SIGINT recebido (Ctrl+C). Encerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('❌ Erro ao iniciar o servidor:');
    logger.error(error);
    process.exit(1);
  }
};

// Inicia o servidor
startServer();



