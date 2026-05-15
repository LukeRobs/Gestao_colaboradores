const cron = require('node-cron');
const { salvarProducaoHistorico, salvarHoraUnica, verificarRegistroExistente } = require('../services/producaoHistorico.service');

function agoraBrasil() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function getDataHoje() {
  return agoraBrasil().toISOString().slice(0, 10);
}

function getDataOntem() {
  const d = agoraBrasil();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Determina qual hora/turno/data salvar com base no horário atual (HH:05).
 * Retorna a hora anterior e o contexto correto para T3 (que cruza meia-noite).
 */
function getInfoHoraAnterior() {
  const agora = agoraBrasil();
  const horaAtual = agora.getHours();
  const horaAnterior = (horaAtual - 1 + 24) % 24;

  let turno;
  if (horaAnterior >= 6 && horaAnterior <= 13) turno = "T1";
  else if (horaAnterior >= 14 && horaAnterior <= 21) turno = "T2";
  else turno = "T3";

  // T3 horas 0-5 → referência é ontem (quando T3 começou às 22h)
  // T3 horas 22-23 → referência é hoje
  let dataRef;
  if (turno === "T3" && horaAnterior <= 5) {
    dataRef = getDataOntem();
  } else {
    dataRef = getDataHoje();
  }

  return { hora: horaAnterior, turno, dataRef };
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

  // Job 4: Redundância horária — salva a hora anterior todo HH:05
  // Ex: 20:05 salva dados das 19:00; 15:05 salva dados das 14:00
  cron.schedule('5 * * * *', async () => {
    const { hora, turno, dataRef } = getInfoHoraAnterior();
    console.log(`\n⏰ [JOB HORA] ${agoraBrasil().toLocaleString('pt-BR')} → salvando h${hora} | ${turno} | ${dataRef}`);

    const resultado = await salvarHoraUnica(turno, dataRef, hora);

    if (resultado.success) {
      console.log(`✅ [JOB HORA] ${resultado.message}`);
    } else {
      console.error(`❌ [JOB HORA] Falha: ${resultado.message}`);
    }
  }, { timezone: "America/Sao_Paulo" });

  // Jobs de reconciliação — re-salva 30 minutos após o fechamento para capturar
  // lançamentos tardios que chegaram à planilha depois do save principal

  // Reconciliação T1 às 15:30
  cron.schedule('30 15 * * *', async () => {
    console.log('\n🔄 [RECONCILIAÇÃO T1] Re-salvando T1 às 15:30 para capturar lançamentos tardios');
    const resultado = await salvarProducaoHistorico('T1', getDataHoje());
    if (resultado.success) {
      console.log(`✅ [RECONCILIAÇÃO T1] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [RECONCILIAÇÃO T1] Falha: ${resultado.message}`);
    }
  }, { timezone: "America/Sao_Paulo" });

  // Reconciliação T2 às 23:30
  cron.schedule('30 23 * * *', async () => {
    console.log('\n🔄 [RECONCILIAÇÃO T2] Re-salvando T2 às 23:30 para capturar lançamentos tardios');
    const resultado = await salvarProducaoHistorico('T2', getDataHoje());
    if (resultado.success) {
      console.log(`✅ [RECONCILIAÇÃO T2] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [RECONCILIAÇÃO T2] Falha: ${resultado.message}`);
    }
  }, { timezone: "America/Sao_Paulo" });

  // Reconciliação T3 às 05:30 (data de referência é ontem, igual ao save principal do T3)
  cron.schedule('30 5 * * *', async () => {
    console.log('\n🔄 [RECONCILIAÇÃO T3] Re-salvando T3 às 05:30 para capturar lançamentos tardios');
    const resultado = await salvarProducaoHistorico('T3', getDataOntem());
    if (resultado.success) {
      console.log(`✅ [RECONCILIAÇÃO T3] ${resultado.message} - ${resultado.registros} registros`);
    } else {
      console.error(`❌ [RECONCILIAÇÃO T3] Falha: ${resultado.message}`);
    }
  }, { timezone: "America/Sao_Paulo" });

  console.log('✅ [JOBS] Jobs agendados com sucesso:');
  console.log('   📌 T1: Todos os dias às 15:00 (fechamento turno)');
  console.log('   📌 T1: Todos os dias às 15:30 (reconciliação)');
  console.log('   📌 T2: Todos os dias às 23:00 (fechamento turno)');
  console.log('   📌 T2: Todos os dias às 23:30 (reconciliação)');
  console.log('   📌 T3: Todos os dias às 05:00 (fechamento turno)');
  console.log('   📌 T3: Todos os dias às 05:30 (reconciliação)');
  console.log('   📌 Redundância: todo HH:05 salva a hora anterior');
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
