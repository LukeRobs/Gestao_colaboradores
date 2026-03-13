const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { 
  buscarMetasProducao, 
  buscarQuantidadeRealizada,
  buscarRankingColaboradores
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
    let dataReferencia = data ? new Date(`${data}T00:00:00.000Z`) : agora;
    
    // LÓGICA ESPECIAL PARA T3 - apenas quando NÃO passa data específica
    // T3 trabalha das 22h de um dia até 6h do dia seguinte
    // Se hoje é 12/03 e são 15h, o T3 "de hoje" ainda não começou (só às 22h)
    // Então ao buscar T3 sem data específica, deve mostrar o T3 de ontem
    if (turno === 'T3' && !data) {
      const horaAtual = agora.getHours();
      
      // Se for antes das 22h, o T3 de hoje ainda não começou
      // Buscar dados do T3 de ontem
      if (horaAtual < 22) {
        dataReferencia = new Date(agora);
        dataReferencia.setDate(dataReferencia.getDate() - 1);
        console.log("⏰ T3: Hora atual < 22h, ajustando para dia anterior");
        console.log(`   Hoje: ${agora.toISOString().slice(0, 10)}, Buscando: ${dataReferencia.toISOString().slice(0, 10)}`);
      }
    }
    
    const dataStr = dataReferencia.toISOString().slice(0, 10);

    console.log("📅 Data final para busca:", dataStr);

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
    
    // Para T3, precisamos buscar dados de duas datas (ontem 22h-23h e hoje 0h-6h)
    let quantidadePorHora = {};
    if (turno === 'T3') {
      // Buscar dados de ontem (22h-23h)
      const quantidadeOntem = await buscarQuantidadeRealizada(dataStr);
      if (quantidadeOntem.success) {
        // Pegar apenas horas 22 e 23
        if (quantidadeOntem.data[22]) quantidadePorHora[22] = quantidadeOntem.data[22];
        if (quantidadeOntem.data[23]) quantidadePorHora[23] = quantidadeOntem.data[23];
      }
      
      // Buscar dados de hoje (0h-6h)
      const dataHoje = new Date(dataStr);
      dataHoje.setDate(dataHoje.getDate() + 1);
      const dataHojeStr = dataHoje.toISOString().slice(0, 10);
      
      const quantidadeHoje = await buscarQuantidadeRealizada(dataHojeStr);
      if (quantidadeHoje.success) {
        // Pegar horas 0 a 5
        for (let h = 0; h <= 5; h++) {
          if (quantidadeHoje.data[h]) quantidadePorHora[h] = quantidadeHoje.data[h];
        }
      }
      
      console.log("✅ T3: Quantidade realizada carregada de duas datas:", Object.keys(quantidadePorHora).length, "horas");
    } else {
      const quantidadeResult = await buscarQuantidadeRealizada(dataStr);
      quantidadePorHora = quantidadeResult.success ? quantidadeResult.data : {};
      console.log("✅ Quantidade realizada carregada:", Object.keys(quantidadePorHora).length, "horas");
    }

    // Buscar dados de produção por hora do banco (fallback)
    console.log("🔍 Buscando produção do banco (fallback)...");
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
    
    // Primeiro tenta buscar do histórico (dados consolidados)
    let producaoPorHora = [];
    try {
      const historicoProducao = await prisma.producaoHoraHistorico.findMany({
        where: {
          dataReferencia: new Date(dataStr),
          turno: turno,
        },
        orderBy: {
          hora: 'asc'
        }
      });
      
      if (historicoProducao.length > 0) {
        producaoPorHora = historicoProducao.map(h => ({
          hora: h.hora,
          realizado: Number(h.realizado)
        }));
        console.log("✅ Produção carregada do histórico:", producaoPorHora.length, "registros");
      } else {
        // Fallback: buscar de dw_real
        // Para T3, buscar de duas datas
        if (turno === 'T3') {
          // Buscar 22h-23h de ontem
          const producaoOntem = await prisma.$queryRaw`
            SELECT 
              EXTRACT(HOUR FROM data::timestamp) as hora,
              SUM(CAST(quantidade AS INTEGER)) as realizado
            FROM dw_real
            WHERE data::date = CAST(${dataStr} AS date)
              AND id_turno = ${turnoId}
              AND EXTRACT(HOUR FROM data::timestamp) >= 22
            GROUP BY EXTRACT(HOUR FROM data::timestamp)
            ORDER BY hora
          `;
          
          // Buscar 0h-5h de hoje
          const dataHoje = new Date(dataStr);
          dataHoje.setDate(dataHoje.getDate() + 1);
          const dataHojeStr = dataHoje.toISOString().slice(0, 10);
          
          const producaoHoje = await prisma.$queryRaw`
            SELECT 
              EXTRACT(HOUR FROM data::timestamp) as hora,
              SUM(CAST(quantidade AS INTEGER)) as realizado
            FROM dw_real
            WHERE data::date = CAST(${dataHojeStr} AS date)
              AND id_turno = ${turnoId}
              AND EXTRACT(HOUR FROM data::timestamp) < 6
            GROUP BY EXTRACT(HOUR FROM data::timestamp)
            ORDER BY hora
          `;
          
          producaoPorHora = [...producaoOntem, ...producaoHoje];
          console.log("✅ T3: Produção carregada do dw_real de duas datas:", producaoPorHora.length, "registros");
        } else {
          producaoPorHora = await prisma.$queryRaw`
            SELECT 
              EXTRACT(HOUR FROM data::timestamp) as hora,
              SUM(CAST(quantidade AS INTEGER)) as realizado
            FROM dw_real
            WHERE data::date = CAST(${dataStr} AS date)
              AND id_turno = ${turnoId}
            GROUP BY EXTRACT(HOUR FROM data::timestamp)
            ORDER BY hora
          `;
          console.log("✅ Produção carregada do dw_real:", producaoPorHora.length, "registros");
        }
      }
    } catch (error) {
      console.error("⚠️ Erro ao buscar produção do banco:", error.message);
      producaoPorHora = [];
    }

    // Buscar ranking de produtividade de colaboradores (Top 15)
    console.log("🔍 Buscando ranking de produtividade de colaboradores...");
    const rankingResult = await buscarRankingColaboradores(dataStr, turno, 15);
    const rankingProdutividade = rankingResult.success ? rankingResult.data : [];
    
    console.log("✅ Ranking carregado:", rankingProdutividade.length, "colaboradores");

    // Buscar total de presentes (colaboradores presentes) do turno específico
    console.log("🔍 Buscando total de colaboradores presentes do turno", turno, "...");
    console.log("📅 Data para busca:", dataStr, "| Data objeto:", new Date(dataStr));
    let totalPresentes = 0;
    try {
      // Para T3, buscar frequência da data de início (ontem)
      // Colaboradores do T3 batem ponto na data de início do turno (22h)
      const frequencias = await prisma.frequencia.findMany({
        where: {
          dataReferencia: new Date(dataStr),
        },
        include: {
          tipoAusencia: true,
          colaborador: {
            include: {
              turno: true
            }
          }
        },
      });

      console.log(`📋 Total de registros de frequência encontrados: ${frequencias.length}`);
      
      const presentesSet = new Set();
      let totalComHoraEntrada = 0;
      let totalDoTurno = 0;
      
      frequencias.forEach(f => {
        if (f.horaEntrada) {
          totalComHoraEntrada++;
          // Considera presente se tem horaEntrada registrada E é do turno correto
          if (f.colaborador?.turno?.nomeTurno === turno) {
            presentesSet.add(f.opsId);
            totalDoTurno++;
          }
        }
      });
      
      totalPresentes = presentesSet.size;
      console.log(`📊 Colaboradores com horaEntrada: ${totalComHoraEntrada}`);
      console.log(`📊 Colaboradores do ${turno} com horaEntrada: ${totalDoTurno}`);
      console.log(`✅ Total de colaboradores presentes do ${turno} (unique): ${totalPresentes}`);
    } catch (error) {
      console.error("⚠️ Erro ao buscar colaboradores presentes:", error.message);
      console.error("Stack:", error.stack);
      console.log("⚠️ Continuando com totalPresentes = 0");
    }

    // Buscar diaristas presentes
    console.log("🔍 Buscando diaristas presentes...");
    console.log("📅 Data para busca:", dataStr, "| Turno ID:", turnoId);
    let diaristasPresentes = 0;
    try {
      // Para T3, buscar diaristas da data de início (ontem)
      const diaristasReais = await prisma.dwReal.findMany({
        where: {
          data: new Date(dataStr),
          idTurno: turnoId,
        },
      });

      console.log(`📋 Total de registros de diaristas encontrados: ${diaristasReais.length}`);
      
      if (diaristasReais.length > 0) {
        console.log("📊 Detalhamento dos diaristas:");
        diaristasReais.forEach((dw, index) => {
          console.log(`   ${index + 1}. Empresa ID: ${dw.idEmpresa}, Quantidade: ${dw.quantidade}`);
        });
      }
      
      diaristasPresentes = diaristasReais.reduce(
        (total, dw) => total + Number(dw.quantidade || 0),
        0
      );
      console.log("✅ Total de diaristas presentes (soma):", diaristasPresentes);
    } catch (error) {
      console.error("⚠️ Erro ao buscar diaristas presentes:", error.message);
      console.error("Stack:", error.stack);
      console.log("⚠️ Continuando com diaristasPresentes = 0");
    }

    // Calcular totais
    const horaAtual = agora.getHours();
    let metaHoraProjetada = 0;
    let metaHoraAtual = 0; // Meta específica da hora atual
    let realizado = 0;
    const producaoComMeta = [];

    // Verificar se o turno já finalizou
    let turnoFinalizado = false;
    if (turno === "T1" && horaAtual >= 14) {
      turnoFinalizado = true;
    } else if (turno === "T2" && horaAtual >= 22) {
      turnoFinalizado = true;
    } else if (turno === "T3" && horaAtual >= 6 && horaAtual < 22) {
      // T3 trabalha das 22h às 5h, então finaliza às 6h
      // Só considera finalizado se estiver entre 6h e 21h (antes do próximo T3)
      turnoFinalizado = true;
    }

    console.log("⏰ Hora atual:", horaAtual);
    console.log("🏁 Turno finalizado:", turnoFinalizado);
    console.log("📊 Quantidade por hora da planilha:", quantidadePorHora);
    console.log("📊 Produção por hora do banco:", producaoPorHora);
    
    // Buscar meta da hora atual
    if (metasPorHora[horaAtual]) {
      metaHoraAtual = metasPorHora[horaAtual];
      console.log(`🎯 Meta da hora atual (${horaAtual}h): ${metaHoraAtual}`);
    }

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

      // Priorizar dados conforme status do turno
      let realizadoHora = 0;
      let origem = "nenhum";
      
      if (turnoFinalizado) {
        // Turno finalizado: priorizar banco, usar planilha como fallback
        const prod = producaoPorHora.find(p => Number(p.hora) === h);
        if (prod && Number(prod.realizado) > 0) {
          realizadoHora = Number(prod.realizado);
          origem = "banco";
          console.log(`  ✅ Turno finalizado - Usando quantidade do banco: ${realizadoHora}`);
        } else if (quantidadePorHora[h] !== undefined && quantidadePorHora[h] > 0) {
          realizadoHora = Math.round(quantidadePorHora[h]);
          origem = "planilha";
          console.log(`  ⚠️ Turno finalizado - Usando quantidade da planilha (fallback): ${realizadoHora}`);
        } else {
          console.log(`  ❌ Sem dados para esta hora`);
        }
      } else {
        // Turno em andamento: priorizar planilha, usar banco como fallback
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
    
    console.log("\n🔍 DEBUG PRODUTIVIDADE:");
    console.log(`  - Total Realizado: ${realizado}`);
    console.log(`  - Total Presentes (${turno}): ${totalPresentes}`);
    console.log(`  - Diaristas Presentes (${turno}): ${diaristasPresentes}`);
    
    // Produtividade = (Total realizado) / (Total presentes + diaristas presentes)
    const totalPresentesComDiaristas = totalPresentes + diaristasPresentes;
    console.log(`  - Soma (Presentes + Diaristas): ${totalPresentes} + ${diaristasPresentes} = ${totalPresentesComDiaristas}`);
    
    const produtividade = totalPresentesComDiaristas > 0 
      ? Math.round(realizado / totalPresentesComDiaristas) 
      : 0;
    
    console.log(`  - Cálculo: ${realizado} / ${totalPresentesComDiaristas} = ${produtividade}`);
    console.log(`  - Verificação: ${produtividade} × ${totalPresentesComDiaristas} = ${produtividade * totalPresentesComDiaristas}`);

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
    console.log(`  - Total Presentes (${turno}): ${totalPresentes}`);
    console.log(`  - Diaristas Presentes (${turno}): ${diaristasPresentes}`);
    console.log(`  - Total Presentes + Diaristas: ${totalPresentesComDiaristas}`);
    console.log(`  - Produtividade: ${realizado} / ${totalPresentesComDiaristas} = ${produtividade}`);
    console.log(`  - Verificação: ${produtividade} * ${totalPresentesComDiaristas} = ${produtividade * totalPresentesComDiaristas} (deve ser próximo de ${realizado})`);
    console.log(`  - Média Hora: ${realizado} / ${horasComDados} = ${mediaHoraRealizado}`);

    // Capacidade por hora (mesma estrutura das metas) + dados de realizado
    const capacidadePorHora = Object.entries(metasPorHora).map(([hora, capacidade]) => {
      const h = parseInt(hora);
      const prodHora = producaoComMeta.find(p => parseInt(p.hora) === h);
      
      return {
        hora,
        capacidade: Math.round(capacidade),
        realizado: prodHora ? prodHora.realizado : 0,
        percentual: prodHora ? prodHora.percentual : 0,
        totalProducao: Math.round(metaDia)
      };
    });

    console.log("✅ Resposta preparada com sucesso");
    console.log("\n📤 DADOS ENVIADOS AO FRONTEND:");
    console.log(JSON.stringify({
      kpis: {
        metaDia: Math.round(metaDia),
        metaHoraProjetada: Math.round(metaHoraProjetada),
        metaHoraAtual: Math.round(metaHoraAtual),
        horaAtual,
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
        ultimaAtualizacao: new Date().toISOString(), // Timestamp da resposta
        kpis: {
          metaDia: Math.round(metaDia),
          metaHoraProjetada: Math.round(metaHoraProjetada),
          metaHoraAtual: Math.round(metaHoraAtual),
          horaAtual,
          realizado,
          mediaHoraRealizado,
          produtividade,
          performance: Number(performance),
          totalPresentes,
          diaristasPresentes
        },
        producaoPorHora: producaoComMeta,
        capacidadePorHora,
        rankingProdutividade: rankingProdutividade.map(r => ({
          nome: r.nome,
          total: Number(r.total)
        }))
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

const consultarHistoricoProducao = async (req, res) => {
  try {
    const { dataInicio, dataFim, turno } = req.query;
    
    console.log("📊 Consultando histórico:", { dataInicio, dataFim, turno });
    
    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        success: false,
        message: "dataInicio e dataFim são obrigatórios"
      });
    }

    const where = {
      dataReferencia: {
        gte: new Date(dataInicio),
        lte: new Date(dataFim)
      }
    };

    if (turno) {
      where.turno = turno;
    }

    const historico = await prisma.producaoHoraHistorico.findMany({
      where,
      orderBy: [
        { dataReferencia: 'desc' },
        { turno: 'asc' },
        { hora: 'asc' }
      ]
    });

    console.log("✅ Histórico carregado:", historico.length, "registros");

    // Agrupar por data e turno
    const agrupado = historico.reduce((acc, item) => {
      const key = `${item.dataReferencia.toISOString().slice(0, 10)}_${item.turno}`;
      if (!acc[key]) {
        acc[key] = {
          data: item.dataReferencia.toISOString().slice(0, 10),
          turno: item.turno,
          producaoPorHora: []
        };
      }
      acc[key].producaoPorHora.push({
        hora: item.hora.toString().padStart(2, '0'),
        meta: Number(item.meta),
        realizado: Number(item.realizado),
        percentual: Number(item.percentual)
      });
      return acc;
    }, {});

    return res.json({
      success: true,
      data: Object.values(agrupado)
    });
  } catch (error) {
    console.error("❌ Erro ao consultar histórico:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro ao consultar histórico",
      error: error.message
    });
  }
};

/**
 * Verifica se os turnos foram salvos no horário esperado
 * Retorna lista de turnos que falharam e precisam de salvamento manual
 */
const verificarStatusSalvamentos = async () => {
  try {
    const agora = agoraBrasil();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    const dataHoje = agora.toISOString().slice(0, 10);
    
    // Definir horários esperados de salvamento (com margem de 10 minutos)
    const horariosSalvamento = {
      T1: { hora: 15, minutos: 10 }, // Deve salvar às 15:00, verificar após 15:10
      T2: { hora: 23, minutos: 10 }, // Deve salvar às 23:00, verificar após 23:10
      T3: { hora: 5, minutos: 10 }   // Deve salvar às 05:00, verificar após 05:10
    };
    
    const turnosPendentes = [];
    
    // Verificar cada turno
    for (const [turno, horario] of Object.entries(horariosSalvamento)) {
      // Verificar se já passou do horário esperado + margem
      let deveriaTerSalvo = false;
      let dataVerificar = dataHoje;
      
      if (turno === 'T3') {
        // T3 salva às 05:00 com data de ontem
        if (horaAtual > horario.hora || (horaAtual === horario.hora && minutoAtual >= horario.minutos)) {
          deveriaTerSalvo = true;
          // Usar data de ontem para T3
          const ontem = new Date(agora);
          ontem.setDate(ontem.getDate() - 1);
          dataVerificar = ontem.toISOString().slice(0, 10);
        }
      } else {
        // T1 e T2 salvam com data de hoje
        if (horaAtual > horario.hora || (horaAtual === horario.hora && minutoAtual >= horario.minutos)) {
          deveriaTerSalvo = true;
        }
      }
      
      if (deveriaTerSalvo) {
        // Verificar se existe registro no banco
        const count = await prisma.producaoHoraHistorico.count({
          where: {
            dataReferencia: new Date(dataVerificar),
            turno: turno
          }
        });
        
        if (count === 0) {
          turnosPendentes.push({
            turno,
            data: dataVerificar,
            horarioEsperado: `${horario.hora.toString().padStart(2, '0')}:00`,
            mensagem: `Dados do ${turno} não foram salvos automaticamente`
          });
        }
      }
    }
    
    return {
      success: true,
      temPendencias: turnosPendentes.length > 0,
      turnosPendentes,
      horaAtual: `${horaAtual.toString().padStart(2, '0')}:${minutoAtual.toString().padStart(2, '0')}`
    };
  } catch (error) {
    console.error("❌ Erro ao verificar status dos salvamentos:", error);
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = { 
  carregarGestaoOperacional, 
  consultarHistoricoProducao,
  verificarStatusSalvamentos
};
