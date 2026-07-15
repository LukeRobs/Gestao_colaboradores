const { prisma } = require("../config/database");
const {
  buscarMetasProducao,
  buscarQuantidadeRealizada,
  limparCache,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID,
} = require("../services/googleSheetsMetaProducao.service");
const {
  obterConfigFonteProducao,
  obterFonteProducaoAtiva,
  fonteParaNomeAba,
  definirFonteProducao,
} = require("../services/fonteProducao.service");
const { salvarProducaoHistorico } = require("../services/producaoHistorico.service");

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
    
    const agora = agoraBrasil();

    console.log("\n========================================");
    console.log("📊 REQUISIÇÃO RECEBIDA");
    console.log("========================================");
    console.log("  data (query param):", data ?? "(não enviado)");
    console.log("  turno:", turno);
    console.log("  agora (SP):", agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    console.log("  hora atual (SP):", agora.getHours());
    console.log("👤 Usuário:", req.user?.name, "| Role:", req.user?.role);
    console.log("🏢 dbContext:", JSON.stringify(req.dbContext));
    console.log("========================================\n");
    
    if (!turno) {
      return res.status(400).json({
        success: false,
        message: "Turno é obrigatório (T1, T2 ou T3)"
      });
    }

    // Resolver spreadsheetIds da estação do usuário
    const estacaoIdCtx = req.dbContext?.estacaoId ?? null;
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    let producaoSpreadsheetId = DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID;

    console.log(`🔍 estacaoIdCtx: ${estacaoIdCtx} | req.user.idEstacao: ${req.user?.idEstacao}`);

    if (estacaoIdCtx) {
      const estacao = await prisma.estacao.findUnique({
        where: { idEstacao: estacaoIdCtx },
        select: { sheetsMetaProducaoId: true },
      });
      if (estacao?.sheetsMetaProducaoId) {
        spreadsheetId = estacao.sheetsMetaProducaoId;
      }
      // sheetsProducaoOnTimeId disponível após rodar: npx prisma migrate dev && npx prisma generate
      console.log(`📊 Meta: ${spreadsheetId} | Produção: ${producaoSpreadsheetId}`);
    }

    // Convenção T3: "T3 do dia X" = turno que começa às 22h do dia X.
    // O ajuste de data para o período "ao vivo" é feito no frontend.
    // O backend usa a data recebida diretamente como referência do turno.
    const dataStr = data
      ? data
      : agora.toISOString().slice(0, 10);

    // Para T3, calcular a data do dia seguinte (horas 00-05)
    const dataStrT3Seguinte = (() => {
      const d = new Date(dataStr);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    console.log("📅 dataStr (data de referência do turno):", dataStr);
    if (turno === 'T3') {
      console.log("📅 dataStrT3Seguinte (dia seguinte para horas 00-05):", dataStrT3Seguinte);
    }

    // Buscar metas da planilha
    console.log("🔍 Buscando metas da planilha...");
    const metasResult = await buscarMetasProducao(turno, dataStr, spreadsheetId);
    
    if (!metasResult.success) {
      throw new Error("Erro ao buscar metas da planilha");
    }

    const { metaDia, metasPorHora, metaProdutividade } = metasResult.data;
    console.log("✅ Metas carregadas:", { metaDia, horasComMeta: Object.keys(metasPorHora).length });
    console.log("📋 Detalhamento das metas por hora:");
    for (const [hora, meta] of Object.entries(metasPorHora)) {
      console.log(`   Hora ${hora}: ${meta}`);
    }

    // Buscar quantidade realizada da planilha OnTime (respeitando a fonte ativa: PRIMARY/BACKUP)
    const fonteProducaoAtiva = await obterFonteProducaoAtiva();
    const sheetNameOnTime = fonteParaNomeAba(fonteProducaoAtiva);
    console.log(`📡 Fonte de produção ativa: ${fonteProducaoAtiva} (${sheetNameOnTime})`);

    let quantidadePorHora = {};
    let ultimaAtualizacaoSheets = null;

    if (turno === 'T3') {
      const [quantidadeOntem, quantidadeHoje] = await Promise.all([
        buscarQuantidadeRealizada(dataStr, producaoSpreadsheetId, sheetNameOnTime),
        buscarQuantidadeRealizada(dataStrT3Seguinte, producaoSpreadsheetId, sheetNameOnTime),
      ]);

      if (quantidadeOntem.success) {
        if (quantidadeOntem.data[22]) quantidadePorHora[22] = quantidadeOntem.data[22];
        if (quantidadeOntem.data[23]) quantidadePorHora[23] = quantidadeOntem.data[23];
        if (quantidadeOntem.ultimaAtualizacaoSheets) ultimaAtualizacaoSheets = quantidadeOntem.ultimaAtualizacaoSheets;
      }
      if (quantidadeHoje.success) {
        for (let h = 0; h <= 5; h++) {
          if (quantidadeHoje.data[h]) quantidadePorHora[h] = quantidadeHoje.data[h];
        }
        if (quantidadeHoje.ultimaAtualizacaoSheets) {
          if (!ultimaAtualizacaoSheets || quantidadeHoje.ultimaAtualizacaoSheets > ultimaAtualizacaoSheets) {
            ultimaAtualizacaoSheets = quantidadeHoje.ultimaAtualizacaoSheets;
          }
        }
      }
    } else {
      const quantidadeResult = await buscarQuantidadeRealizada(dataStr, producaoSpreadsheetId, sheetNameOnTime);
      quantidadePorHora = quantidadeResult.success ? quantidadeResult.data : {};
      ultimaAtualizacaoSheets = quantidadeResult.ultimaAtualizacaoSheets ?? null;
    }

    // Buscar dados de produção por hora do banco
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;
    
    let producaoPorHora = [];
    try {
      // Para todos os turnos: tenta producaoHoraHistorico primeiro, fallback para planilha (quantidadePorHora)
      // T3 armazena todas as 8 horas (22,23,0-5) sob a mesma dataReferencia (data de início do turno)
      const historicoProducao = await prisma.producaoHoraHistorico.findMany({
        where: {
          dataReferencia: new Date(dataStr),
          turno: turno,
        },
        orderBy: { hora: 'asc' }
      });

      if (historicoProducao.length > 0) {
        producaoPorHora = historicoProducao.map(h => ({
          hora: h.hora,
          realizado: Number(h.realizado)
        }));
        console.log(`✅ [${turno}] Produção carregada do histórico: ${producaoPorHora.length} registros →`,
          producaoPorHora.map(p => `h${p.hora}=${p.realizado}`).join(', '));
      } else {
        console.log(`⚠️ [${turno}] Sem histórico para ${dataStr} — dados virão da planilha OnTime (quantidadePorHora)`);
      }
    } catch (error) {
      console.error("⚠️ Erro ao buscar produção do banco:", error.message);
      producaoPorHora = [];
    }

    // Buscar total de presentes (colaboradores presentes) do turno específico
    console.log("🔍 Buscando total de colaboradores presentes do turno", turno, "...");
    console.log("📅 Data para busca:", dataStr, "| Data objeto:", new Date(dataStr));
    const estacaoId = estacaoIdCtx;
    // Setores que entram no divisor de produtividade
    const SETORES_PRODUCAO = ["Esteira", "Processamento Manual"];

    let totalPresentes = 0;
    try {
      const frequencias = await prisma.frequencia.findMany({
        where: {
          dataReferencia: new Date(dataStr),
          ...(estacaoId && { colaborador: { is: { idEstacao: estacaoId } } }),
        },
        include: {
          colaborador: {
            include: {
              turno: true,
              setor: true,
            }
          }
        },
      });

      console.log(`📋 Total de registros de frequência encontrados: ${frequencias.length}`);

      const presentesSet = new Set();
      let totalDoTurno = 0;

      frequencias.forEach(f => {
        if (!f.horaEntrada) return;
        if (f.colaborador?.turno?.nomeTurno !== turno) return;
        // Apenas setores de produção contam para o divisor
        const nomeSetor = f.colaborador?.setor?.nomeSetor;
        if (!SETORES_PRODUCAO.includes(nomeSetor)) return;
        presentesSet.add(f.opsId);
        totalDoTurno++;
      });

      totalPresentes = presentesSet.size;
      console.log(`📊 Colaboradores do ${turno} presentes (Esteira + Proc. Manual): ${totalDoTurno}`);
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
    let metaHoraAtual = 0;
    let realizado = 0;
    const producaoComMeta = [];

    // Verificar se o turno já finalizou
    // Se a data selecionada é anterior a hoje, o turno sempre finalizou
    const dataHoje = agora.toISOString().slice(0, 10);
    const dataSelecionadaAnterior = dataStr < dataHoje;

    let turnoFinalizado = false;
    if (dataSelecionadaAnterior) {
      // Data passada: para T3, só finaliza se o dia seguinte também já passou
      if (turno === 'T3') {
        const dataHojeObj = new Date(dataStr);
        dataHojeObj.setDate(dataHojeObj.getDate() + 1);
        const dataFimT3 = dataHojeObj.toISOString().slice(0, 10);
        turnoFinalizado = dataFimT3 < dataHoje || (dataFimT3 === dataHoje && horaAtual >= 6);
      } else {
        turnoFinalizado = true;
      }
    } else if (turno === "T1" && horaAtual >= 14) {
      turnoFinalizado = true;
    } else if (turno === "T2" && horaAtual >= 22) {
      turnoFinalizado = true;
    } else if (turno === "T3" && horaAtual >= 6 && horaAtual < 22) {
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

    // Para T3, converter horaAtual para posição dentro do turno
    // T3: 22h=pos0, 23h=pos1, 0h=pos2, 1h=pos3, 2h=pos4, 3h=pos5, 4h=pos6, 5h=pos7
    // Uma hora "h" está completa se sua posição no turno < posição da hora atual
    const posicaoNoTurnoT3 = (h) => (h >= 22 ? h - 22 : h + 2);
    const posicaoAtualT3 = posicaoNoTurnoT3(horaAtual);

    // Processar todas as horas que têm meta
    for (const [horaStr, meta] of Object.entries(metasPorHora)) {
      const h = parseInt(horaStr);
      
      console.log(`\n🔍 Processando hora ${h}:`);
      console.log(`  - Meta: ${meta}`);

      // Verificar se a hora já passou (completa)
      let horaCompleta;
      if (turno === 'T3') {
        horaCompleta = posicaoNoTurnoT3(h) < posicaoAtualT3;
      } else {
        horaCompleta = h < horaAtual;
      }
      console.log(`  - Hora atual: ${horaAtual}, Hora ${h} completa? ${horaCompleta}`);
      
      // Somar meta projetada apenas das horas COMPLETAS (antes da hora atual)
      if (horaCompleta) {
        metaHoraProjetada += meta;
        console.log(`  - Meta projetada acumulada: ${metaHoraProjetada}`);
      }

      // Priorizar dados conforme status do turno
      let realizadoHora = 0;
      let origem = "nenhum";

      if (turnoFinalizado) {
        const prod = producaoPorHora.find(p => Number(p.hora) === h);
        const valorBanco    = prod ? Number(prod.realizado) : 0;
        const valorPlanilha = quantidadePorHora[h] !== undefined
          ? Math.round(quantidadePorHora[h])
          : 0;

        if (dataSelecionadaAnterior) {
          // Data passada → banco é fonte confirmada; planilha como fallback
          if (valorBanco > 0) {
            realizadoHora = valorBanco;
            origem = "banco";
            console.log(`  ✅ Data passada - Usando banco: ${realizadoHora}`);
          } else if (valorPlanilha > 0) {
            realizadoHora = valorPlanilha;
            origem = "planilha";
            console.log(`  ⚠️ Data passada - Usando planilha (fallback): ${realizadoHora}`);
          } else {
            console.log(`  ❌ Sem dados para esta hora`);
          }
        } else {
          // Turno de hoje que acabou → planilha tem prioridade (operadores
          // podem ter enviado dados após o salvamento automático do banco)
          if (valorPlanilha > 0) {
            realizadoHora = valorPlanilha;
            origem = "planilha";
            console.log(`  ✅ Turno hoje finalizado - Usando planilha: ${realizadoHora}`);
          } else if (valorBanco > 0) {
            realizadoHora = valorBanco;
            origem = "banco";
            console.log(`  ⚠️ Turno hoje finalizado - Usando banco (fallback): ${realizadoHora}`);
          } else {
            console.log(`  ❌ Sem dados para esta hora`);
          }
        }
      } else {
        // Turno em andamento: planilha é sempre mais atualizada
        const horaIniciada = turno === 'T3'
          ? posicaoNoTurnoT3(h) <= posicaoAtualT3
          : h <= horaAtual;

        if (!horaIniciada) {
          realizadoHora = 0;
          origem = "futuro";
          console.log(`  ⏭️ Hora ${h} ainda não iniciou — ignorando`);
        } else if (quantidadePorHora[h] !== undefined && quantidadePorHora[h] > 0) {
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

    // Ordenar por hora — T3 começa às 22h, então 22,23 vêm antes de 0,1,2,3,4,5
    if (turno === 'T3') {
      producaoComMeta.sort((a, b) => {
        const ordemT3 = (h) => (parseInt(h) >= 22 ? parseInt(h) - 22 : parseInt(h) + 2);
        return ordemT3(a.hora) - ordemT3(b.hora);
      });
    } else {
      producaoComMeta.sort((a, b) => parseInt(a.hora) - parseInt(b.hora));
    }

    // Calcular médias e produtividade
    // Contar apenas horas que têm realizado > 0
    const horasComDados = producaoComMeta.filter(p => p.realizado > 0).length;
    const mediaHoraRealizado = horasComDados > 0 ? Math.round(realizado / horasComDados) : 0;
    
    console.log("\n🔍 DEBUG PRODUTIVIDADE:");
    console.log(`  - Total Realizado: ${realizado}`);
    console.log(`  - Total Presentes (${turno}): ${totalPresentes}`);
    console.log(`  - Diaristas Presentes (${turno}): ${diaristasPresentes}`);
    
    // Produtividade = (Total realizado) / (Total presentes)
    const totalPresentesSemDiaristas = totalPresentes    
    const produtividade = totalPresentesSemDiaristas > 0 
      ? Math.round(realizado / totalPresentesSemDiaristas) 
      : 0;
    
    console.log(`  - Cálculo: ${realizado} / ${totalPresentesSemDiaristas} = ${produtividade}`);
    console.log(`  - Verificação: ${produtividade} × ${totalPresentesSemDiaristas} = ${produtividade * totalPresentesSemDiaristas}`);

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
    console.log(`  - Total Presentes + Diaristas: ${totalPresentesSemDiaristas}`);
    console.log(`  - Produtividade: ${realizado} / ${totalPresentesSemDiaristas} = ${produtividade}`);
    console.log(`  - Verificação: ${produtividade} * ${totalPresentesSemDiaristas} = ${produtividade * totalPresentesSemDiaristas} (deve ser próximo de ${realizado})`);
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

    console.log("\n========================================");
    console.log("📤 RESUMO FINAL - DADOS ENVIADOS AO FRONTEND");
    console.log("========================================");
    console.log(`  turno: ${turno} | dataStr: ${dataStr}${turno === 'T3' ? ` | dataStrT3Seguinte: ${dataStrT3Seguinte}` : ''}`);
    console.log(`  turnoFinalizado: ${turnoFinalizado} | horaAtual: ${horaAtual}`);
    console.log(`  metaDia: ${Math.round(metaDia)} | realizado: ${realizado} | performance: ${performance}%`);
    console.log("  producaoComMeta (todas as horas):");
    producaoComMeta.forEach(p => {
      console.log(`    h${p.hora}: meta=${p.meta}, realizado=${p.realizado}, %=${p.percentual}`);
    });
    console.log("========================================\n");

    return res.json({
      success: true,
      data: {
        dataReferencia: data ?? dataStr,
        turno,
        ultimaAtualizacao: ultimaAtualizacaoSheets ?? new Date().toISOString(),
        fonteProducaoAtiva,
        kpis: {
          metaDia: Math.round(metaDia),
          metaHoraProjetada: Math.round(metaHoraProjetada),
          metaHoraAtual: Math.round(metaHoraAtual),
          horaAtual,
          realizado,
          mediaHoraRealizado,
          produtividade,
          // meta de produtividade lida da coluna C do sheet "Meta"
          // se a planilha não tiver essa coluna, retorna 0 e o front usa 770 como padrão
          metaProdutividade: Math.round(metaProdutividade || 0),
          performance: Number(performance),
          totalPresentes,
          diaristasPresentes
        },
        producaoPorHora: producaoComMeta,
        capacidadePorHora,
      }
    });
  } catch (error) {
    console.error("❌ Erro gestão operacional:", error);
    console.error("Stack:", error.stack);

    if (error.code === 'SHEETS_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        code: 'SHEETS_NOT_CONFIGURED',
        message: 'Planilha de produtividade ainda não configurada para esta estação.',
      });
    }

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

/**
 * Retorna qual fonte de produção (planilha) está ativa: PRIMARY (ProdutividadeSPX) ou BACKUP (db30s)
 */
const obterFonteProducao = async (req, res) => {
  try {
    const config = await obterConfigFonteProducao();
    return res.json({
      success: true,
      data: {
        fonte: config?.fonte === "BACKUP" ? "BACKUP" : "PRIMARY",
        atualizadoEm: config?.atualizadoEm ?? null,
        atualizadoPorNome: config?.atualizadoPorNome ?? null,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao obter fonte de produção:", error);
    return res.status(500).json({ success: false, message: "Erro ao obter fonte de produção", error: error.message });
  }
};

/**
 * Troca a fonte de produção ativa (PRIMARY/BACKUP) — restrito a ADMIN/ALTA_GESTAO na rota
 */
const alterarFonteProducao = async (req, res) => {
  try {
    const { fonte, turno, data } = req.body;
    if (!["PRIMARY", "BACKUP"].includes(fonte)) {
      return res.status(400).json({ success: false, message: "Campo 'fonte' deve ser PRIMARY ou BACKUP" });
    }

    const config = await definirFonteProducao(fonte, req.user);

    // Limpa o cache da planilha OnTime para a troca surtir efeito imediatamente
    limparCache(DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID);

    console.log(`🔀 Fonte de produção alterada para ${fonte} por ${req.user?.name} (${req.user?.role})`);

    // Ressincroniza o histórico do turno/data em tela com a nova fonte imediatamente.
    // Sem isso, horas sem dado ainda na planilha nova caem no fallback do banco,
    // que fica com valores da fonte anterior (escala diferente) até o próximo job horário.
    if (turno && ["T1", "T2", "T3"].includes(turno)) {
      const resultResync = await salvarProducaoHistorico(turno, data || null);
      console.log(`🔄 Histórico ressincronizado após troca de fonte:`, resultResync);
    }

    return res.json({
      success: true,
      data: {
        fonte: config.fonte,
        atualizadoEm: config.atualizadoEm,
        atualizadoPorNome: config.atualizadoPorNome,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao alterar fonte de produção:", error);
    return res.status(500).json({ success: false, message: "Erro ao alterar fonte de produção", error: error.message });
  }
};

module.exports = {
  carregarGestaoOperacional,
  consultarHistoricoProducao,
  verificarStatusSalvamentos,
  obterFonteProducao,
  alterarFonteProducao,
};
