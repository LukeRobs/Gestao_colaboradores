const { google } = require('googleapis');

// 📊 CONFIGURAÇÕES DA PLANILHA OPA
const OPA_SPREADSHEET_ID = process.env.SHEETS_OPA_SPREADSHEET_ID || '1maB_sUQ-J5oVYUNJWuN5om19qjoSfX-aOnYakmlw0aI';
const OPA_SHEET = process.env.SHEETS_OPA_ABA || 'Report SPI';
// Não precisamos mais da constante OPA_RANGE pois usamos o range diretamente na função

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
 * 📊 Buscar dados do OPA do Google Sheets
 */
const buscarDadosOPA = async (filtros = {}) => {
  try {
    console.log('\n📊 ===== BUSCAR DADOS OPA =====');
    console.log('Filtros:', filtros);

    const sheets = getGoogleSheetsClient();

    // Buscar dados do OPA (A112:CZ163) - começar de A para manter índices consistentes
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: OPA_SPREADSHEET_ID,
      range: `${OPA_SHEET}!A112:CZ163`,
    });

    const rows = response.data.values;

    // Buscar cabeçalho do Safety Walk para pegar os nomes das pessoas (A1:CZ5)
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: OPA_SPREADSHEET_ID,
      range: `${OPA_SHEET}!A1:CZ5`,
    });

    const headerRows = headerResponse.data.values;

    if (!rows || rows.length < 6) {
      console.log('⚠️ Planilha vazia ou estrutura inválida');
      return {
        success: true,
        data: {
          totalInspecoes: 0,
          realizadas: 0,
          pendentes: 0,
          taxaConclusao: 0,
          registros: [],
          conclusaoPorTurno: [],
          semanasDisponiveis: [],
          semanaAtual: calcularSemanaAtual(),
        },
      };
    }

    console.log(`✅ Dados carregados: ${rows.length} linhas`);

    // Usar cabeçalho do Safety Walk para pegar os nomes
    const headerRow = headerRows[0];
    const emailRow = headerRows[1];
    const turnoRow = headerRows[3];
    const cargoRow = headerRows[4];

    console.log('📋 Estrutura identificada:');
    console.log('📋 Total de linhas:', rows.length);
    console.log('📋 Total de colunas:', headerRow.length);
    console.log('📋 Primeira linha OPA (índice 0):', rows[0]?.slice(0, 15));
    console.log('📋 Segunda linha OPA (índice 1):', rows[1]?.slice(0, 15));
    console.log('📋 Terceira linha OPA (índice 2):', rows[2]?.slice(0, 15));

    // Identificar responsáveis
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

    console.log(`✅ Total de responsáveis identificados: ${responsaveis.length}`);

    const registros = [];
    const semanasSet = new Set();

    // Processar linhas do OPA
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linhaSheets = 112 + i; // Linha real no Google Sheets
      
      if (!row || row.length === 0) {
        continue;
      }

      const pilar = row[1] || ''; // Coluna B
      const dataInicio = row[2] || ''; // Coluna C
      const semana = normalizarSemana(row[0] || ''); // Coluna A = Semana (W2 → W02)
      const numeroSemana = row[7] || ''; // Coluna H = Número da semana
      const descricaoSemana = row[9] || ''; // Coluna J = Descrição
      
      console.log(`🔍 Linha ${linhaSheets} (índice ${i}): Semana="${semana}", Pilar="${pilar}", NumSemana="${numeroSemana}", Descrição="${descricaoSemana}"`);
      console.log(`   📋 Primeiras 15 colunas:`, row.slice(0, 15));
      
      // Verificar se é OPA
      const pilarUpper = pilar.toUpperCase().trim();
      console.log(`   🔍 Pilar upper: "${pilarUpper}"`);
      
      if (!pilarUpper.includes('OPA')) {
        console.log(`   ⏭️ Pulando - Não contém OPA: "${pilar}" (upper: "${pilarUpper}")`);
        continue;
      }

      // Verificar se tem semana
      if (!semana || !semana.startsWith('W')) {
        console.log(`   ⏭️ Pulando - Sem semana válida: "${semana}"`);
        continue;
      }

      semanasSet.add(semana);
      
      console.log(`   ✅ Processando linha ${linhaSheets} (índice ${i}) - ${semana} - ${pilar}`);

      const dataInicioParsed = parseData(dataInicio);

      // Aplicar filtro de período
      const semanaAtual = calcularSemanaAtual();
      console.log(`   📅 Semana atual calculada: ${semanaAtual}, Semana da linha: ${semana}`);
      console.log(`   🔍 Filtros: periodo="${filtros.periodo}", semana="${filtros.semana}"`);
      
      if (filtros.periodo === 'semana_atual') {
        if (semana !== semanaAtual) {
          console.log(`   ⏭️ Pulando - Não é semana atual (${semanaAtual})`);
          continue;
        }
      } else if (filtros.periodo === 'semana_especifica' && filtros.semana) {
        if (semana !== filtros.semana) {
          console.log(`   ⏭️ Pulando - Não é semana selecionada (${filtros.semana})`);
          continue;
        }
      }

      console.log(`   ✅ Passou pelos filtros de período! Processando responsáveis...`);

      let countResponsaveis = 0;
      responsaveis.forEach((resp) => {
        const statusCelula = row[resp.colIndex] || '';
        
        if (!statusCelula || statusCelula.trim() === '') {
          console.log(`     ⏭️ ${resp.nome} (col ${resp.colIndex}): célula vazia`);
          return;
        }
        
        const status = statusCelula.trim();
        const statusLower = status.toLowerCase();
        
        console.log(`     🔍 ${resp.nome} (col ${resp.colIndex}, turno ${resp.turno}): status="${status}"`);
        
        // Ignorar férias e afastamentos
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
          console.log(`     ⏭️ ${resp.nome}: Ignorando - férias/afastamento`);
          return;
        }
        
        // Aplicar filtro de turno
        if (filtros.turno && resp.turno !== filtros.turno) {
          console.log(`     ⏭️ ${resp.nome}: Ignorando - turno ${resp.turno} != ${filtros.turno}`);
          return;
        }

        // Verificar se NÃO foi realizado primeiro
        const naoRealizado = statusLower.includes('não realizado') || 
                            statusLower.includes('nao realizado') ||
                            statusLower.includes('não') ||
                            statusLower.includes('nao');

        // Verificar se foi realizado
        const realizado = !naoRealizado && (
          statusLower.includes('ok') || 
          statusLower.includes('realizado') ||
          statusLower.includes('concluído') ||
          statusLower.includes('concluido') ||
          status === '✓' ||
          status === 'x' ||
          status === 'X'
        );

        console.log(`     ✅ ${resp.nome}: Adicionando registro - Status: ${realizado ? 'REALIZADO' : 'PENDENTE'}`);

        countResponsaveis++;
        registros.push({
          semana,
          pilar,
          acao: 'OPA',
          dataInicio: dataInicioParsed || '',
          dataFim: dataInicioParsed || '',
          responsavel: resp.nome,
          turno: resp.turno,
          cargo: resp.cargo,
          status: realizado ? 'REALIZADO' : 'PENDENTE',
          statusOriginal: status,
          dataPrevista: dataInicioParsed || '',
          setor: 'Operações',
          local: semana,
        });
      });

      console.log(`   📊 Responsáveis processados nesta linha: ${countResponsaveis}`);
    }

    console.log(`📊 Total de registros processados: ${registros.length}`);

    // Calcular métricas
    const totalInspecoes = registros.length;
    const realizadas = registros.filter(r => r.status === 'REALIZADO').length;
    const pendentes = totalInspecoes - realizadas;
    const taxaConclusao = totalInspecoes > 0 ? Math.round((realizadas / totalInspecoes) * 100) : 0;

    // Calcular conclusão por turno
    const turnosMap = new Map();
    registros.forEach(reg => {
      if (!turnosMap.has(reg.turno)) {
        turnosMap.set(reg.turno, { total: 0, realizadas: 0 });
      }
      const turnoData = turnosMap.get(reg.turno);
      turnoData.total++;
      if (reg.status === 'REALIZADO') {
        turnoData.realizadas++;
      }
    });

    const conclusaoPorTurno = Array.from(turnosMap.entries()).map(([turno, data]) => ({
      turno,
      total: data.total,
      realizadas: data.realizadas,
      percentual: data.total > 0 ? Math.round((data.realizadas / data.total) * 100) : 0,
    }));

    const semanasDisponiveis = Array.from(semanasSet).sort();
    const semanaAtual = calcularSemanaAtual();

    console.log('📈 Métricas calculadas:');
    console.log(`  - Total: ${totalInspecoes}`);
    console.log(`  - Realizadas: ${realizadas}`);
    console.log(`  - Pendentes: ${pendentes}`);
    console.log(`  - Taxa: ${taxaConclusao}%`);
    console.log(`  - Semanas disponíveis: ${semanasDisponiveis.join(', ')}`);
    console.log(`  - Semana atual: ${semanaAtual}`);

    return {
      success: true,
      data: {
        totalInspecoes,
        realizadas,
        pendentes,
        taxaConclusao,
        registros,
        conclusaoPorTurno,
        semanasDisponiveis,
        semanaAtual,
      },
    };
  } catch (error) {
    console.error('❌ Erro ao buscar dados do OPA:', error);
    throw error;
  }
};

module.exports = {
  buscarDadosOPA,
};
