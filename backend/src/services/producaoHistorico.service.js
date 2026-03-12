const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { 
  buscarMetasProducao, 
  buscarQuantidadeRealizada
} = require("./googleSheetsMetaProducao.service");

/**
 * Salva os dados de produção por hora no banco de dados
 * @param {string} turno - T1, T2 ou T3
 * @param {string} dataStr - Data no formato YYYY-MM-DD
 * @returns {Promise<{success: boolean, message: string, registros?: number}>}
 */
async function salvarProducaoHistorico(turno, dataStr = null) {
  try {
    // Se não passar data, usa a data atual
    if (!dataStr) {
      const agora = new Date();
      const spString = agora.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      });
      const dataBrasil = new Date(spString);
      dataStr = dataBrasil.toISOString().slice(0, 10);
    }

    console.log(`\n💾 [HISTÓRICO] Iniciando salvamento automático`);
    console.log(`📅 Data: ${dataStr}`);
    console.log(`🕐 Turno: ${turno}`);

    // Buscar metas da planilha
    const metasResult = await buscarMetasProducao(turno, dataStr);
    
    if (!metasResult.success) {
      throw new Error("Erro ao buscar metas da planilha");
    }

    const { metasPorHora } = metasResult.data;
    console.log(`✅ Metas carregadas: ${Object.keys(metasPorHora).length} horas`);

    // Buscar quantidade realizada
    const quantidadeResult = await buscarQuantidadeRealizada(dataStr);
    const quantidadePorHora = quantidadeResult.success ? quantidadeResult.data : {};
    console.log(`✅ Quantidade realizada carregada: ${Object.keys(quantidadePorHora).length} horas`);

    // Buscar dados do banco como fallback
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
    
    const producaoPorHora = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM data::timestamp) as hora,
        SUM(CAST(quantidade AS INTEGER)) as realizado
      FROM dw_real
      WHERE data::date = CAST(${dataStr} AS date)
        AND id_turno = ${turnoId}
      GROUP BY EXTRACT(HOUR FROM data::timestamp)
      ORDER BY hora
    `;

    console.log(`✅ Produção do banco carregada: ${producaoPorHora.length} registros`);

    // Processar e salvar cada hora
    let registrosSalvos = 0;
    
    for (const [horaStr, meta] of Object.entries(metasPorHora)) {
      const h = parseInt(horaStr);
      
      // Priorizar quantidade da planilha, usar banco como fallback
      let realizadoHora = 0;
      
      if (quantidadePorHora[h] !== undefined && quantidadePorHora[h] > 0) {
        realizadoHora = Math.round(quantidadePorHora[h]);
      } else {
        const prod = producaoPorHora.find(p => Number(p.hora) === h);
        realizadoHora = prod ? Number(prod.realizado) : 0;
      }

      const percentual = meta > 0 ? ((realizadoHora / meta) * 100).toFixed(2) : 0;

      // Salvar no banco usando upsert
      await prisma.producaoHoraHistorico.upsert({
        where: {
          dataReferencia_turno_hora: {
            dataReferencia: new Date(dataStr),
            turno: turno,
            hora: h
          }
        },
        update: {
          meta: Math.round(meta),
          realizado: realizadoHora,
          percentual: parseFloat(percentual),
          updatedAt: new Date()
        },
        create: {
          dataReferencia: new Date(dataStr),
          turno: turno,
          hora: h,
          meta: Math.round(meta),
          realizado: realizadoHora,
          percentual: parseFloat(percentual)
        }
      });

      registrosSalvos++;
    }

    console.log(`✅ [HISTÓRICO] Salvamento concluído: ${registrosSalvos} registros`);
    
    return {
      success: true,
      message: `Dados do ${turno} salvos com sucesso`,
      registros: registrosSalvos
    };

  } catch (error) {
    console.error(`❌ [HISTÓRICO] Erro ao salvar dados do ${turno}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Verifica se já existe registro para o turno/data
 * Para evitar salvamentos duplicados
 */
async function verificarRegistroExistente(turno, dataStr) {
  try {
    const count = await prisma.producaoHoraHistorico.count({
      where: {
        dataReferencia: new Date(dataStr),
        turno: turno
      }
    });
    
    return count > 0;
  } catch (error) {
    console.error("Erro ao verificar registro existente:", error);
    return false;
  }
}

module.exports = {
  salvarProducaoHistorico,
  verificarRegistroExistente
};
