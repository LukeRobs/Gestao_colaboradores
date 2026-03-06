const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { 
  buscarMetasProducao, 
  buscarQuantidadeRealizada 
} = require("../services/googleSheetsMetaProducao.service");

function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}

const carregarGestaoOperacional = async (req, res) => {
  try {
    const { data, turno } = req.query;
    
    console.log("📊 Requisição recebida:", { data, turno });
    console.log("👤 Usuário:", req.user?.name, "| Role:", req.user?.role);
    
    if (!turno) {
      return res.status(400).json({
        success: false,
        message: "Turno é obrigatório (T1, T2 ou T3)"
      });
    }

    const agora = agoraBrasil();
    const dataReferencia = data ? new Date(`${data}T00:00:00.000Z`) : agora;
    const dataStr = dataReferencia.toISOString().slice(0, 10);

    console.log("📅 Data processada:", dataStr);

    // Buscar metas da planilha
    console.log("🔍 Buscando metas da planilha...");
    const metasResult = await buscarMetasProducao(turno, dataStr);
    
    if (!metasResult.success) {
      throw new Error("Erro ao buscar metas da planilha");
    }

    const { metaDia, metasPorHora } = metasResult.data;
    console.log("✅ Metas carregadas:", { metaDia, horasComMeta: Object.keys(metasPorHora).length });
    console.log("📋 Detalhamento das metas por hora:");
    for (const [hora, meta] of Object.entries(metasPorHora)) {
      console.log(`   Hora ${hora}: ${meta}`);
    }

    // Buscar quantidade realizada da aba Atualização_colaborador
    console.log("🔍 Buscando quantidade realizada da planilha...");
    const quantidadeResult = await buscarQuantidadeRealizada(dataStr);
    const quantidadePorHora = quantidadeResult.success ? quantidadeResult.data : {};
    console.log("✅ Quantidade realizada carregada:", Object.keys(quantidadePorHora).length, "horas");

    // Buscar dados de produção por hora do banco (fallback)
    console.log("🔍 Buscando produção do banco (fallback)...");
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

    console.log("✅ Produção carregada:", producaoPorHora.length, "registros");

    // Calcular totais
    const horaAtual = agora.getHours();
    let metaHoraProjetada = 0;
    let realizado = 0;
    const producaoComMeta = [];

    console.log("⏰ Hora atual:", horaAtual);
    console.log("📊 Quantidade por hora da planilha:", quantidadePorHora);
    console.log("📊 Produção por hora do banco:", producaoPorHora);

    // Processar todas as horas que têm meta
    for (const [horaStr, meta] of Object.entries(metasPorHora)) {
      const h = parseInt(horaStr);
      
      console.log(`\n🔍 Processando hora ${h}:`);
      console.log(`  - Meta: ${meta}`);
      console.log(`  - Hora atual: ${horaAtual}, Hora ${h} < Hora atual? ${h < horaAtual}`);
      
      // Somar meta projetada apenas das horas COMPLETAS (antes da hora atual)
      if (h < horaAtual) {
        metaHoraProjetada += meta;
        console.log(`  - Meta projetada acumulada: ${metaHoraProjetada}`);
      }

      // Priorizar quantidade da planilha, usar banco como fallback
      let realizadoHora = 0;
      let origem = "nenhum";
      
      if (quantidadePorHora[h] !== undefined && quantidadePorHora[h] > 0) {
        realizadoHora = Math.round(quantidadePorHora[h]);
        origem = "planilha";
        console.log(`  ✅ Usando quantidade da planilha: ${realizadoHora}`);
      } else {
        const prod = producaoPorHora.find(p => Number(p.hora) === h);
        realizadoHora = prod ? Number(prod.realizado) : 0;
        origem = realizadoHora > 0 ? "banco" : "zero";
        if (realizadoHora > 0) {
          console.log(`  ⚠️ Usando quantidade do banco: ${realizadoHora}`);
        } else {
          console.log(`  ❌ Sem dados para esta hora`);
        }
      }
      
      // Somar realizado de TODAS as horas que têm dados (não apenas completas)
      if (realizadoHora > 0) {
        realizado += realizadoHora;
        console.log(`  - Realizado acumulado: ${realizado}`);
      }

      const percentual = meta > 0 ? ((realizadoHora / meta) * 100).toFixed(1) : 0;

      producaoComMeta.push({
        hora: h.toString().padStart(2, '0'),
        meta: Math.round(meta),
        realizado: realizadoHora,
        percentual: Number(percentual)
      });
      
      console.log(`  - Percentual: ${percentual}%`);
      console.log(`  - Origem dos dados: ${origem}`);
    }

    // Ordenar por hora
    producaoComMeta.sort((a, b) => parseInt(a.hora) - parseInt(b.hora));

    // Calcular médias e produtividade
    // Contar apenas horas que têm realizado > 0
    const horasComDados = producaoComMeta.filter(p => p.realizado > 0).length;
    const mediaHoraRealizado = horasComDados > 0 ? Math.round(realizado / horasComDados) : 0;
    
    // Produtividade = (realizado / meta projetada) * 770
    const produtividade = metaHoraProjetada > 0 ? Math.round((realizado / metaHoraProjetada) * 770) : 0;

    // Performance = (realizado / meta do dia) * 100
    const performance = metaDia > 0 
      ? ((realizado / metaDia) * 100).toFixed(2)
      : 0;

    console.log("\n📊 TOTAIS FINAIS:");
    console.log(`  - Meta Dia: ${metaDia}`);
    console.log(`  - Meta Hora Projetada: ${metaHoraProjetada}`);
    console.log(`  - Realizado Total: ${realizado}`);
    console.log(`  - Horas com Dados: ${horasComDados}`);

    console.log(`\n📊 CÁLCULOS:`);
    console.log(`  - Performance: (${realizado} / ${metaDia}) * 100 = ${performance}%`);
    console.log(`  - Produtividade: (${realizado} / ${metaHoraProjetada}) * 770 = ${produtividade}`);
    console.log(`  - Média Hora: ${realizado} / ${horasComDados} = ${mediaHoraRealizado}`);

    // Capacidade por hora (mesma estrutura das metas)
    const capacidadePorHora = Object.entries(metasPorHora).map(([hora, capacidade]) => ({
      hora,
      capacidade: Math.round(capacidade),
      totalProducao: Math.round(metaDia)
    }));

    console.log("✅ Resposta preparada com sucesso");
    console.log("\n📤 DADOS ENVIADOS AO FRONTEND:");
    console.log(JSON.stringify({
      kpis: {
        metaDia: Math.round(metaDia),
        metaHoraProjetada: Math.round(metaHoraProjetada),
        realizado,
        mediaHoraRealizado,
        produtividade,
        performance: Number(performance)
      },
      producaoPorHora: producaoComMeta.slice(0, 3) // Mostrar apenas primeiras 3 horas
    }, null, 2));

    return res.json({
      success: true,
      data: {
        dataReferencia: dataStr,
        turno,
        kpis: {
          metaDia: Math.round(metaDia),
          metaHoraProjetada: Math.round(metaHoraProjetada),
          realizado,
          mediaHoraRealizado,
          produtividade,
          performance: Number(performance)
        },
        producaoPorHora: producaoComMeta,
        capacidadePorHora
      }
    });
  } catch (error) {
    console.error("❌ Erro gestão operacional:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Erro ao carregar dados operacionais",
      error: error.message
    });
  }
};

module.exports = { carregarGestaoOperacional };
