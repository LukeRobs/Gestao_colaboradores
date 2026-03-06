const cron = require('node-cron');
const { salvarProducaoHistorico, verificarRegistroExistente } = require('../services/producaoHistorico.service');

/**
 * Função auxiliar para obter a data de ontem no formato YYYY-MM-DD
 * Usado para salvar dados do turno T3 que termina às 7h do dia seguinte
 */
function getDataOntem() {
  const agora = new Date();
  const spString = agora.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  const dataBrasil = new Date(spString);
  dataBrasil.setDate(dataBrasil.getDate() - 1);
  return dataBrasil.toISOString().slice(0, 10);
}

/**
 * Função auxiliar para obter a data de hoje no formato YYYY-MM-DD
 */
function getDataHoje() {
  const agora = new Date();
  const spString = agora.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  const dataBrasil = new Date(spString);
  return dataBrasil.toISOString().slice(0, 10);
}

/**
 * Inicializa os jobs de salvamento automático
 */
function iniciarJobsProducao() {
  console.log('\n🤖 [JOBS] Inicializando jobs de salvamento automático de produção');
  
  // Job 1: Salvar T1 às 15:00 (fim do turno T1)
  cron.schedule('0 15 * * *', async () => {
    console.log('\n⏰ [JOB T1] Executando salvamento automático do T1 às 15:00');
    
    const dataHoje = getDataHoje();
    const jaExiste = await verificarRegistroExistente('T1', dataHoje);
    
    if (jaExiste) {
      console.log('ℹ️ [JOB T1] Dados já existem, atualizando...');
    }
    
    const resultado = await salvarProducaoHistorico('T1', dataHoje);
    
    if (resultado.success) {
      console.log(`✅ [JOB T1] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [JOB T1] Falha: ${resultado.message}`);
    }
  }, {
    timezone: "America/Sao_Paulo"
  });

  // Job 2: Salvar T2 às 23:00 (fim do turno T2)
  cron.schedule('0 23 * * *', async () => {
    console.log('\n⏰ [JOB T2] Executando salvamento automático do T2 às 23:00');
    
    const dataHoje = getDataHoje();
    const jaExiste = await verificarRegistroExistente('T2', dataHoje);
    
    if (jaExiste) {
      console.log('ℹ️ [JOB T2] Dados já existem, atualizando...');
    }
    
    const resultado = await salvarProducaoHistorico('T2', dataHoje);
    
    if (resultado.success) {
      console.log(`✅ [JOB T2] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [JOB T2] Falha: ${resultado.message}`);
    }
  }, {
    timezone: "America/Sao_Paulo"
  });

  // Job 3: Salvar T3 às 05:00 (fim do turno T3)
  // T3 começa às 21h de um dia e termina às 05h do dia seguinte, então salvamos com a data de ontem
  cron.schedule('0 5 * * *', async () => {
    console.log('\n⏰ [JOB T3] Executando salvamento automático do T3 às 05:00');
    
    const dataOntem = getDataOntem();
    const jaExiste = await verificarRegistroExistente('T3', dataOntem);
    
    if (jaExiste) {
      console.log('ℹ️ [JOB T3] Dados já existem, atualizando...');
    }
    
    const resultado = await salvarProducaoHistorico('T3', dataOntem);
    
    if (resultado.success) {
      console.log(`✅ [JOB T3] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [JOB T3] Falha: ${resultado.message}`);
    }
  }, {
    timezone: "America/Sao_Paulo"
  });

  console.log('✅ [JOBS] Jobs agendados com sucesso:');
  console.log('   📌 T1: Todos os dias às 15:00');
  console.log('   📌 T2: Todos os dias às 23:00');
  console.log('   📌 T3: Todos os dias às 05:00');
  console.log('   🌎 Timezone: America/Sao_Paulo\n');
}

/**
 * Função para testar o salvamento manualmente (útil para debug)
 */
async function testarSalvamentoManual(turno) {
  console.log(`\n🧪 [TESTE] Testando salvamento manual do ${turno}`);
  
  let dataStr;
  if (turno === 'T3') {
    dataStr = getDataOntem();
  } else {
    dataStr = getDataHoje();
  }
  
  const resultado = await salvarProducaoHistorico(turno, dataStr);
  
  if (resultado.success) {
    console.log(`✅ [TESTE] ${resultado.message} - ${resultado.registros} registros`);
  } else {
    console.error(`❌ [TESTE] Falha: ${resultado.message}`);
  }
  
  return resultado;
}

module.exports = {
  iniciarJobsProducao,
  testarSalvamentoManual
};
