const { google } = require('googleapis');

// 📊 CONFIGURAÇÕES DA PLANILHA DDSMA
const DDSMA_SPREADSHEET_ID = process.env.SHEETS_DDSMA_SPREADSHEET_ID || '1maB_sUQ-J5oVYUNJWuN5om19qjoSfX-aOnYakmlw0aI';
const DDSMA_SHEET = process.env.SHEETS_DDSMA_ABA || 'Report SPI';
const DDSMA_RANGE = 'A59:CZ110'; // Intervalo específico do DDSMA (começando da coluna A para manter índices consistentes)

// 🔧 Inicializar Google Sheets API
const getGoogleSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
};

// 📅 Converter data DD/MM/YYYY para ISO
const parseData = (dataStr) => {
  if (!dataStr) return null;
  
  const dataLimpa = String(dataStr).trim();
  if (!dataLimpa) return null;
  
  if (dataLimpa.match(/^\d{4}-\d{2}-\d{2}$/)) return dataLimpa;
  
  if (dataLimpa.includes('/')) {
    const partes = dataLimpa.split('/');
    
    if (partes.length === 3) {
      const [dia, mes, ano] = partes;
      const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
      return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    } else if (partes.length === 2) {
      const [dia, mes] = partes;
      const anoAtual = '2026';
      return `${anoAtual}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
  }
  
  if (dataLimpa.includes('-')) {
    const partes = dataLimpa.split('-');
    if (partes.length === 3 && partes[0].length <= 2) {
      const [dia, mes, ano] = partes;
      const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
      return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
  }
  
  console.warn('⚠️ Formato de data não reconhecido:', dataStr);
  return null;
};

// 📅 Calcular semana atual do ano
const calcularSemanaAtual = () => {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const diasPassados = Math.floor((hoje - inicioAno) / (1000 * 60 * 60 * 24));
  const semanaAtual = Math.ceil((diasPassados + inicioAno.getDay() + 1) / 7);
  
  // ✅ PADRÃO: Sempre retornar COM zero à esquerda (W07 ao invés de W7)
  return `W${String(semanaAtual).padStart(2, '0')}`;
};

/**
 * 📅 Normalizar formato de semana para padrão W07 (com zero à esquerda)
 * @param {string} semana - Semana no formato W7 ou W07
 * @returns {string} - Semana normalizada no formato W07
 */
const normalizarSemana = (semana) => {
  if (!semana || typeof semana !== 'string') return semana;
  
  // Se já está no formato correto (W07), retornar
  if (semana.match(/^W\d{2}$/)) return semana;
  
  // Se está no formato W7 (sem zero), adicionar zero
  const match = semana.match(/^W(\d+)$/);
  if (match) {
    const numero = match[1];
    return `W${numero.padStart(2, '0')}`;
  }
  
  // Se não reconhecer o formato, retornar como está
  return semana;
};

/**
 * 📊 Buscar dados do DDSMA do Google Sheets
 */
const buscarDadosDDSMA = async (filtros = {}) => {
  try {
    console.log('\n📊 ===== BUSCAR DADOS DDSMA =====');
    console.log('Filtros:', filtros);

    const sheets = getGoogleSheetsClient();

    // Buscar dados do DDSMA (B59:AZ110)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: DDSMA_SPREADSHEET_ID,
      range: `${DDSMA_SHEET}!${DDSMA_RANGE}`,
    });

    const rows = response.data.values;

    // Buscar cabeçalho do Safety Walk para pegar os nomes das pessoas (A1:AZ5)
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: DDSMA_SPREADSHEET_ID,
      range: `${DDSMA_SHEET}!A1:CZ5`,
    });

    const headerRows = headerResponse.data.values;

    if (!rows || rows.length < 6) {
      console.log('⚠️ Planilha vazia ou estrutura inválida');
      console.log('⚠️ Linhas encontradas:', rows?.length || 0);
      return {
        success: true,
        data: {
          totalInspecoes: 0,
          realizadas: 0,
          pendentes: 0,
          taxaConclusao: 0,
          registros: [],
          conclusaoPorTurno: [],
          semanaAtual: calcularSemanaAtual(),
          semanasDisponiveis: [],
        }
      };
    }

    // Usar cabeçalho do Safety Walk para pegar os nomes
    const headerRow = headerRows[0];
    const emailRow = headerRows[1];
    const escalaRow = headerRows[2];
    const turnoRow = headerRows[3];
    const cargoRow = headerRows[4];

    console.log('📋 Estrutura identificada:');
    console.log('📋 Total de linhas:', rows.length);
    console.log('📋 Total de colunas:', headerRow.length);
    console.log('📋 Primeiras 15 colunas da linha 1:', headerRow.slice(0, 15));
    console.log('📋 Primeira linha de dados completa (linha 6):', rows[5]);

    const responsaveis = [];
    for (let i = 0; i < headerRow.length; i++) {
      const nome = headerRow[i];
      if (!nome || nome.trim() === '') continue;
      
      const email = emailRow[i] || '';
      const temEmailValido = email.includes('@shopee.com');
      
      if (temEmailValido) {
        responsaveis.push({
          colIndex: i,
          nome: nome.trim(),
          email: email.trim(),
          turno: turnoRow[i] || '',
          cargo: cargoRow[i] || '',
        });
        continue;
      }
      
      const nomeUpper = nome.toUpperCase().trim();
      const isControleColumn = 
        nomeUpper.startsWith('SEM') ||
        nomeUpper === 'PILAR' ||
        nomeUpper.includes('DATA') ||
        nomeUpper === 'ANO' ||
        nomeUpper === 'MÊS' ||
        nomeUpper === 'MES' ||
        nomeUpper.startsWith('CÓD') ||
        nomeUpper.startsWith('COD') ||
        nomeUpper === 'SEMANA' ||
        nomeUpper === 'RESPONSÁVEL' ||
        nomeUpper === 'RESPONSAVEL' ||
        nomeUpper === 'ATENDIMENTO SEMANAL' ||
        nomeUpper === 'ATENDIMENTO MENSAL' ||
        nomeUpper === 'TURNO' ||
        nomeUpper === 'CARGO';
      
      if (isControleColumn) continue;

      const turno = turnoRow[i] || '';
      if (turno && (turno === 'ADM' || turno === 'T1' || turno === 'T2' || turno === 'T3')) {
        responsaveis.push({
          colIndex: i,
          nome: nome.trim(),
          email: email.trim(),
          turno: turno,
          cargo: cargoRow[i] || '',
        });
      }
    }

    // Cargos isentos de realizar DDSMA
    const CARGOS_ISENTOS = [
      'gerência regional',
      'gerencia regional',
      'site leader',
      'coordenação',
      'coordenacao',
      'hse',
      'supervisor',
      'analista',
    ];

    const responsaveisFiltrados = responsaveis.filter(r => {
      const cargoLower = (r.cargo || '').toLowerCase().trim();
      return !CARGOS_ISENTOS.some(c => cargoLower.includes(c));
    });

    console.log(`✅ Total de responsáveis identificados: ${responsaveis.length}`);
    console.log(`✅ Após filtro de cargos isentos: ${responsaveisFiltrados.length}`);

    const registros = [];

    // IMPORTANTE: rows[0] = linha 59 do sheets (porque o range começa em B59)
    // Então começamos do índice 0, não do 5!
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linhaSheets = 59 + i; // Linha real no Google Sheets
      
      if (!row || row.length === 0) {
        console.log(`⚠️ Linha ${linhaSheets} (índice ${i}) vazia`);
        continue;
      }

      const pilar = row[1] || ''; // Coluna B (índice 1 quando começamos de A)
      const dataInicio = row[2] || ''; // Coluna C
      const dataFimParcial = row[3] || ''; // Coluna D
      const ano = row[4] || ''; // Coluna E
      const numeroSemana = row[7] || ''; // Coluna H = Número da semana (ex: "07")
      const descricaoSemana = row[9] || ''; // Coluna J = Descrição (ex: "Sem 07 (09/02 a 15/02)")
      
      console.log(`🔍 Linha ${linhaSheets} (índice ${i}): Pilar="${pilar}", Semana="${numeroSemana}", Descrição="${descricaoSemana}"`);
      
      // Verificar se é DDSMA
      if (pilar.toUpperCase() !== 'DDSMA') {
        console.log(`   ⏭️ Pulando - Não é DDSMA: "${pilar}"`);
        continue;
      }

      // Verificar se tem número de semana
      if (!numeroSemana) {
        console.log(`   ⏭️ Pulando - Sem número de semana`);
        continue;
      }

      const weekNumber = parseInt(numeroSemana);
      if (weekNumber < 5) {
        console.log(`   ⏭️ Pulando - Semana ${weekNumber} é menor que 5`);
        continue;
      }

      const semana = normalizarSemana(`W${numeroSemana}`);
      console.log(`   ✅ Processando linha ${linhaSheets} (índice ${i}) - ${semana} - ${pilar}`);

      const dataInicioParsed = parseData(dataInicio);
      const dataFimParsed = parseData(dataInicio); // Usar data início como fim também

      let countResponsaveis = 0;
      responsaveisFiltrados.forEach((resp) => {
        const statusCelula = row[resp.colIndex] || '';
        
        // Célula vazia = pessoa não está no escopo desta semana, ignorar completamente
        if (!statusCelula || statusCelula.trim() === '') return;
        
        const status = statusCelula.trim();
        const statusLower = status.toLowerCase();
        
        if (
          statusLower.includes('férias') ||
          statusLower.includes('ferias') ||
          statusLower.includes('afastado') ||
          statusLower.includes('afastamento') ||
          statusLower.includes('ausente') ||
          statusLower.includes('ausência') ||
          statusLower.includes('ausencia') ||
          statusLower.includes('licença') ||
          statusLower.includes('licenca')
        ) {
          return;
        }
        
        if (filtros.turno && resp.turno !== filtros.turno) return;

        // A célula pode conter:
        // - Percentual numérico: "100.00%", "20.00%", "0.00%" (cada 20% = 1 dia feito de 5)
        // - Texto: "Realizado", "OK", "Sim", "Não Realizado"
        let diasRealizadosCelula = 0;

        const percentMatch = status.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
        if (percentMatch) {
          // Valor percentual: 100% = 5 dias, 80% = 4, 60% = 3, 40% = 2, 20% = 1, 0% = 0
          const pct = parseFloat(percentMatch[1].replace(',', '.'));
          diasRealizadosCelula = Math.round((pct / 100) * 5);
        } else {
          // Texto legado
          const naoRealizado = statusLower.includes('não realizado') ||
                               statusLower.includes('nao realizado') ||
                               statusLower.startsWith('não') ||
                               statusLower.startsWith('nao');
          const realizado = !naoRealizado && (
            statusLower.includes('realizado') ||
            statusLower === 'ok' ||
            statusLower === 'sim'
          );
          diasRealizadosCelula = realizado ? 5 : 0;
        }

        const registro = {
          semana,
          pilar,
          acao: pilar || 'DDSMA',
          dataInicio: dataInicioParsed || '',
          dataFim: dataFimParsed || '',
          responsavel: resp.nome,
          email: resp.email,
          turno: resp.turno,
          cargo: resp.cargo,
          diasRealizadosCelula,
          status: diasRealizadosCelula >= 5 ? 'REALIZADO' : 'PENDENTE',
          statusOriginal: status,
          dataPrevista: dataInicioParsed || '',
          setor: 'Operações',
          local: semana,
        };

        registros.push(registro);
        countResponsaveis++;
      });
      
      console.log(`   📊 ${countResponsaveis} responsáveis processados nesta linha`);
    }

    console.log(`✅ Total de registros processados: ${registros.length}`);
    
    // Debug: mostrar todas as semanas disponíveis
    const semanasEncontradas = [...new Set(registros.map(r => r.semana))].sort();
    console.log(`📅 Semanas encontradas na planilha:`, semanasEncontradas);
    
    // Debug: mostrar alguns exemplos de registros
    if (registros.length > 0) {
      console.log(`📋 Primeiros 3 registros encontrados:`);
      registros.slice(0, 3).forEach(r => {
        console.log(`   - ${r.responsavel} (${r.turno}): ${r.status} - Semana ${r.semana}`);
      });
    } else {
      console.log('⚠️ Nenhum registro DDSMA encontrado!');
    }

    let registrosFiltrados = registros;
    
    if (filtros.periodo === 'semana_atual') {
      const semanaAtual = calcularSemanaAtual();
      console.log(`📅 Filtrando pela semana atual: "${semanaAtual}"`);
      console.log(`📅 Semanas nos registros:`, [...new Set(registros.map(r => r.semana))]);
      
      registrosFiltrados = registros.filter(reg => reg.semana === semanaAtual);
      console.log(`📊 Após filtro de semana atual: ${registrosFiltrados.length} registros`);
      
    } else if (filtros.periodo === 'semana_especifica' && filtros.semana) {
      console.log(`📅 Filtrando pela semana específica: ${filtros.semana}`);
      
      registrosFiltrados = registros.filter(reg => reg.semana === filtros.semana);
      console.log(`📊 Após filtro de semana específica: ${registrosFiltrados.length} registros`);
    }

    // =====================================================================
    // NOVA LÓGICA DDSMA: a célula já contém o % acumulado da semana
    // 100% = 5/5, 80% = 4/5, 60% = 3/5, 40% = 2/5, 20% = 1/5, 0% = 0/5
    // =====================================================================
    const TOTAL_DIAS_SEMANA = 5;

    // Como há 1 linha por pessoa por semana, usar diasRealizadosCelula diretamente
    const progressoPorPessoa = {};
    registrosFiltrados.forEach(r => {
      const key = r.responsavel;
      // Se aparecer mais de uma linha, pegar o maior valor
      if (!progressoPorPessoa[key] || r.diasRealizadosCelula > progressoPorPessoa[key].diasRealizados) {
        progressoPorPessoa[key] = {
          responsavel: r.responsavel,
          email: r.email,
          turno: r.turno,
          cargo: r.cargo,
          semana: r.semana,
          diasRealizados: r.diasRealizadosCelula,
        };
      }
    });

    // Montar registros consolidados por pessoa com progresso
    const registrosConsolidados = Object.values(progressoPorPessoa).map(p => {
      const diasFeitos = Math.min(p.diasRealizados, TOTAL_DIAS_SEMANA);
      const percentual = Math.round((diasFeitos / TOTAL_DIAS_SEMANA) * 100);
      const statusFinal = diasFeitos >= TOTAL_DIAS_SEMANA ? 'REALIZADO' : 'PENDENTE';
      return {
        ...p,
        diasRealizados: diasFeitos,
        totalDiasSemana: TOTAL_DIAS_SEMANA,
        percentualIndividual: percentual,
        progresso: `${diasFeitos}/${TOTAL_DIAS_SEMANA}`,
        status: statusFinal,
        statusOriginal: p.status,
        acao: 'DDSMA',
        pilar: 'DDSMA',
        dataInicio: '',
        dataFim: '',
        dataPrevista: '',
        setor: 'Operações',
        local: p.semana,
      };
    });

    const pessoasUnicas = registrosConsolidados.length;
    const realizadas = registrosConsolidados.filter(r => r.status === 'REALIZADO').length;
    const pendentes = pessoasUnicas - realizadas;

    // Taxa de conclusão baseada na média dos percentuais individuais
    const taxaConclusao = pessoasUnicas > 0
      ? Number((registrosConsolidados.reduce((acc, r) => acc + r.percentualIndividual, 0) / pessoasUnicas).toFixed(2))
      : 0;

    // Aderência por turno
    const progressoPorTurno = {};
    registrosConsolidados.forEach(r => {
      const turno = r.turno || 'Não informado';
      if (!progressoPorTurno[turno]) {
        progressoPorTurno[turno] = { pessoas: [], realizadas: 0 };
      }
      progressoPorTurno[turno].pessoas.push(r);
      if (r.status === 'REALIZADO') progressoPorTurno[turno].realizadas++;
    });

    const conclusaoPorTurno = Object.entries(progressoPorTurno)
      .map(([turno, dados]) => {
        const total = dados.pessoas.length;
        const realizadasTurno = dados.realizadas;
        const mediaPercentual = total > 0
          ? Number((dados.pessoas.reduce((acc, p) => acc + p.percentualIndividual, 0) / total).toFixed(2))
          : 0;
        return {
          turno,
          total,
          realizadas: realizadasTurno,
          percentual: mediaPercentual,
        };
      })
      .sort((a, b) => a.turno.localeCompare(b.turno));

    const semanasDisponiveis = [...new Set(registros.map(r => r.semana))]
      .filter(s => s && s.startsWith('W'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('W', ''));
        const numB = parseInt(b.replace('W', ''));
        return numA - numB;
      });

    const resultado = {
      totalInspecoes: pessoasUnicas,
      realizadas,
      pendentes,
      taxaConclusao,
      naoConformidades: 0,
      registros: registrosConsolidados,
      conclusaoPorTurno,
      naoConformidadesLista: [],
      semanaAtual: calcularSemanaAtual(),
      semanasDisponiveis,
    };

    console.log('📊 Métricas calculadas (nova lógica diária):', {
      totalInspecoes: pessoasUnicas,
      realizadas,
      pendentes,
      taxaConclusao,
      totalRegistrosConsolidados: registrosConsolidados.length,
      totalRegistrosOriginais: registros.length,
    });
    console.log('=================================\n');

    return {
      success: true,
      data: resultado,
    };

  } catch (error) {
    console.error('❌ Erro ao buscar dados do DDSMA:', error.message);
    throw error;
  }
};

/**
 * 🔄 Sincronizar dados do DDSMA
 */
const sincronizarDDSMA = async () => {
  try {
    console.log('\n🔄 ===== SINCRONIZAÇÃO DDSMA =====');
    
    const resultado = await buscarDadosDDSMA({ periodo: 'mes' });
    
    console.log('✅ Sincronização concluída');
    console.log('=================================\n');

    return resultado;

  } catch (error) {
    console.error('❌ Erro na sincronização do DDSMA:', error.message);
    throw error;
  }
};

module.exports = {
  buscarDadosDDSMA,
  sincronizarDDSMA,
};

