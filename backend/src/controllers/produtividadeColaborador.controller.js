const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { buscarProdutividadeDetalhada } = require("../services/googleSheetsMetaProducao.service");

function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}

const carregarProdutividadeColaborador = async (req, res) => {
  try {
    const { data, turno } = req.query;
    
    console.log("📊 Carregando produtividade por colaborador:", { data, turno });
    
    if (!turno) {
      return res.status(400).json({
        success: false,
        message: "Turno é obrigatório (T1, T2 ou T3)"
      });
    }

    const agora = agoraBrasil();
    let dataReferencia = data ? new Date(`${data}T00:00:00.000Z`) : agora;
    
    // Lógica especial para T3
    if (turno === 'T3' && !data) {
      const horaAtual = agora.getHours();
      if (horaAtual < 22) {
        dataReferencia = new Date(agora);
        dataReferencia.setDate(dataReferencia.getDate() - 1);
      }
    }
    
    const dataStr = dataReferencia.toISOString().slice(0, 10);
    const turnoId = turno === "T1" ? 1 : turno === "T2" ? 2 : 3;

    // Buscar colaboradores do turno do banco de dados
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        turno: {
          idTurno: turnoId
        },
        status: "ATIVO"
      },
      include: {
        turno: true,
        setor: true,
        cargo: true
      },
      orderBy: {
        nomeCompleto: 'asc'
      }
    });

    console.log(`✅ Encontrados ${colaboradores.length} colaboradores no ${turno}`);

    // Tentar buscar do histórico salvo no banco primeiro
    // Usar gte/lt para evitar problemas de timezone com campo DATE
    const dataInicio = new Date(`${dataStr}T00:00:00.000Z`);
    const dataFim = new Date(`${dataStr}T23:59:59.999Z`);

    const historicoSalvo = await prisma.producaoColaboradorHistorico.findMany({
      where: {
        dataReferencia: { gte: dataInicio, lte: dataFim },
        turno,
      },
    });

    console.log(`🗄️ Histórico no banco para ${dataStr} / ${turno}: ${historicoSalvo.length} registros`);
    if (historicoSalvo.length > 0) {
      const comProducao = historicoSalvo.filter(h => h.total > 0).length;
      console.log(`📊 Registros com produção > 0: ${comProducao}`);
    }

    const removerAcentos = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    const producaoPorNome = new Map();
    const producaoPorOpsId = new Map();

    if (historicoSalvo.length > 0) {
      // Usar dados do banco
      console.log("✅ Usando dados do histórico salvo no banco");
      historicoSalvo.forEach(item => {
        const dadosPorHora = typeof item.dadosPorHora === "string"
          ? JSON.parse(item.dadosPorHora)
          : item.dadosPorHora || {};
        const mapped = { nome: item.nomeCompleto, opsId: item.opsId, total: item.total, dadosPorHora };
        producaoPorNome.set(removerAcentos(item.nomeCompleto), mapped);
        if (item.opsId) producaoPorOpsId.set(item.opsId.toLowerCase(), mapped);
      });
    } else {
      // Fallback: buscar da planilha em tempo real
      console.log("⚠️ Sem histórico no banco, buscando da planilha...");
      const produtividadeResult = await buscarProdutividadeDetalhada(dataStr, turno);
      const dadosPlanilha = produtividadeResult.success ? produtividadeResult.data : [];
      console.log(`✅ Dados da planilha: ${dadosPlanilha.length} colaboradores`);
      dadosPlanilha.forEach(item => {
        producaoPorNome.set(removerAcentos(item.nome), item);
        if (item.opsId) producaoPorOpsId.set(item.opsId.toLowerCase(), item);
      });
    }

    if (colaboradores.length > 0) {
      console.log("📋 Primeiros 3 nomes do banco:", colaboradores.slice(0, 3).map(c => c.nomeCompleto));
    }

    let matchesEncontrados = 0;

    // Definir horas do turno
    let horasTurno = [];
    if (turno === 'T1') {
      horasTurno = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    } else if (turno === 'T2') {
      horasTurno = [14, 15, 16, 17, 18, 19, 20, 21, 22];
    } else if (turno === 'T3') {
      horasTurno = [22, 23, 0, 1, 2, 3, 4, 5, 6];
    }

    // Processar dados por colaborador
    const dadosColaboradores = colaboradores.map(colaborador => {
      const dadosHoras = {};
      let totalIndividual = 0;

      // Inicializar todas as horas com 0
      horasTurno.forEach(hora => {
        dadosHoras[`${hora.toString().padStart(2, '0')}:00`] = 0;
      });

      // Buscar dados da planilha por OpsId primeiro, depois por nome como fallback
      const nomeNormalizado = removerAcentos(colaborador.nomeCompleto);
      const opsIdNormalizado = colaborador.opsId?.toLowerCase();
      const dadosProducao = 
        (opsIdNormalizado && producaoPorOpsId.get(opsIdNormalizado)) ||
        producaoPorNome.get(nomeNormalizado);

      if (dadosProducao && dadosProducao.dadosPorHora) {
        matchesEncontrados++;
        horasTurno.forEach(hora => {
          // Chaves podem ser number ou string dependendo da origem (planilha vs banco)
          const quantidade = dadosProducao.dadosPorHora[hora] ?? dadosProducao.dadosPorHora[String(hora)] ?? 0;
          dadosHoras[`${hora.toString().padStart(2, '0')}:00`] = quantidade;
          totalIndividual += quantidade;
        });
      }

      return {
        opsId: colaborador.opsId,
        nomeCompleto: colaborador.nomeCompleto,
        setor: colaborador.setor?.nomeSetor || 'N/A',
        cargo: colaborador.cargo?.nomeCargo || 'N/A',
        turno: colaborador.turno?.nomeTurno || turno,
        ...dadosHoras,
        total: totalIndividual
      };
    });

    // Ordenar por total decrescente
    dadosColaboradores.sort((a, b) => b.total - a.total);

    console.log(`📊 Matches encontrados: ${matchesEncontrados}/${colaboradores.length}`);

    // Calcular estatísticas adicionais
    const totais = dadosColaboradores.filter(c => c.total > 0);
    const mediaColaborador = totais.length > 0 
      ? Math.round(totais.reduce((sum, c) => sum + c.total, 0) / totais.length)
      : 0;
    
    const maiorProducao = totais.length > 0 ? Math.max(...totais.map(c => c.total)) : 0;
    const menorProducao = totais.length > 0 ? Math.min(...totais.map(c => c.total)) : 0;

    const response = {
      success: true,
      data: {
        colaboradores: dadosColaboradores,
        turno,
        data: dataStr,
        horasTurno: horasTurno.map(h => `${h.toString().padStart(2, '0')}:00`),
        totalColaboradores: colaboradores.length,
        resumo: {
          totalGeral: dadosColaboradores.reduce((sum, c) => sum + c.total, 0),
          mediaColaborador,
          maiorProducao,
          menorProducao,
          colaboradoresAtivos: totais.length,
          colaboradoresSemProducao: dadosColaboradores.length - totais.length
        }
      }
    };

    console.log(`✅ Resposta preparada com ${dadosColaboradores.length} colaboradores`);
    res.json(response);

  } catch (error) {
    console.error("❌ Erro ao carregar produtividade por colaborador:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error.message
    });
  }
};

module.exports = {
  carregarProdutividadeColaborador
};