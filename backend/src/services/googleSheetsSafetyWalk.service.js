const { google } = require('googleapis');

// 📊 CONFIGURAÇÕES DA PLANILHA SAFETY WALK
const SAFETY_WALK_SPREADSHEET_ID = process.env.SHEETS_SAFETY_WALK_SPREADSHEET_ID || '1maB_sUQ-J5oVYUNJWuN5om19qjoSfX-aOnYakmlw0aI';
const SAFETY_WALK_SHEET = process.env.SHEETS_SAFETY_WALK_ABA || 'Report SPI';

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

// 📅 Formatar data ISO para DD/MM/YYYY
const formatarData = (dataISO) => {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
};

// 📅 Converter data DD/MM/YYYY para ISO
const parseData = (dataStr) => {
  if (!dataStr) return null;
  
  // Limpar string
  const dataLimpa = String(dataStr).trim();
  if (!dataLimpa) return null;
  
  // Se já está em formato ISO (YYYY-MM-DD)
  if (dataLimpa.match(/^\d{4}-\d{2}-\d{2}$/)) return dataLimpa;
  
  // Se está em formato DD/MM/YYYY
  if (dataLimpa.includes('/')) {
    const partes = dataLimpa.split('/');
    
    if (partes.length === 3) {
      // Formato completo: DD/MM/YYYY
      const [dia, mes, ano] = partes;
      const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
      return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    } else if (partes.length === 2) {
      // Formato sem ano: DD/M ou DD/MM - assumir ano atual (2026)
      const [dia, mes] = partes;
      const anoAtual = '2026'; // Ano atual do sistema
      return `${anoAtual}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
  }
  
  // Se está em formato DD-MM-YYYY
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
  
  console.log(`📅 Cálculo de semana atual:`, {
    hoje: hoje.toISOString().split('T')[0],
    diasPassados,
    diaSemanaInicioAno: inicioAno.getDay(),
    semanaCalculada: semanaAtual,
    resultado: `W${String(semanaAtual).padStart(2, '0')}`
  });
  
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
 * 📊 Buscar dados do Safety Walk do Google Sheets
 * Estrutura da planilha:
 * - Linha 1: Cabeçalhos (semana, pilar, datas, líderes)
 * - Linha 2: E-mails dos líderes
 * - Linha 3: Escala do líder
 * - Linha 4: Turno
 * - Linha 5: Cargo
 * - Linha 6+: Dados (W2, Safety Walk, datas, status por líder)
 * 
 * @param {Object} filtros - Filtros opcionais
 * @param {string} filtros.periodo - 'semana_atual' ou 'semana_especifica'
 * @param {string} filtros.semana - Semana específica (ex: 'W2', 'W10')
 * @param {string} filtros.turno - 'T1', 'T2', 'T3', 'ADM'
 * @returns {Object} Dados processados do Safety Walk
 */
const buscarDadosSafetyWalk = async (filtros = {}) => {
  try {
    console.log('\n📊 ===== BUSCAR DADOS SAFETY WALK =====');
    console.log('Filtros:', filtros);

    const sheets = getGoogleSheetsClient();

    // Buscar dados da planilha - ler até coluna CZ para pegar todas as pessoas
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SAFETY_WALK_SPREADSHEET_ID,
      range: `${SAFETY_WALK_SHEET}!A1:CZ1000`,
    });

    const rows = response.data.values;

    if (!rows || rows.length < 6) {
      console.log('⚠️ Planilha vazia ou estrutura inválida');
      return {
        totalInspecoes: 0,
        realizadas: 0,
        pendentes: 0,
        taxaConclusao: 0,
        naoConformidades: 0,
        registros: [],
        conclusaoPorTurno: [],
        naoConformidadesLista: [],
      };
    }

    // Extrair informações das linhas de cabeçalho
    const headerRow = rows[0]; // Linha 1: nomes dos líderes
    const emailRow = rows[1];  // Linha 2: e-mails
    const escalaRow = rows[2]; // Linha 3: escala
    const turnoRow = rows[3];  // Linha 4: turno
    const cargoRow = rows[4];  // Linha 5: cargo

    console.log('📋 Estrutura identificada:');
    console.log('- Primeiras 20 colunas:', headerRow.slice(0, 20));
    console.log('- Total de colunas:', headerRow.length);

    // Mapear líderes - começar da coluna onde aparecem os nomes
    // Pular colunas de controle (Semana, Pilar, Datas, Ano, Mês, etc.)
    // Começar onde tem nomes de pessoas (geralmente após coluna 12)
    const lideres = [];
    for (let i = 0; i < headerRow.length; i++) {
      const nome = headerRow[i];
      if (!nome || nome.trim() === '') continue;
      
      // Pular colunas de controle/sistema
      // Usar lógica mais específica: se tem email válido (@shopee.com), é pessoa
      const email = emailRow[i] || '';
      const temEmailValido = email.includes('@shopee.com');
      
      // Se tem email válido, é definitivamente uma pessoa
      if (temEmailValido) {
        lideres.push({
          colIndex: i,
          nome: nome.trim(),
          email: email.trim(),
          turno: turnoRow[i] || '',
          cargo: cargoRow[i] || '',
        });
        continue;
      }
      
      // Se não tem email, verificar se é coluna de controle
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
        nomeUpper === 'LÍDER' ||
        nomeUpper === 'LIDER' ||
        nomeUpper === 'ATENDIMENTO SEMANAL' ||
        nomeUpper === 'ATENDIMENTO MENSAL' ||
        nomeUpper === 'TURNO' ||
        nomeUpper === 'CARGO';
      
      if (isControleColumn) {
        continue; // Pular colunas de controle
      }

      // Se chegou aqui e não tem email, pode ser pessoa sem email cadastrado
      // Verificar se tem turno definido (ADM, T1, T2, T3)
      const turno = turnoRow[i] || '';
      if (turno && (turno === 'ADM' || turno === 'T1' || turno === 'T2' || turno === 'T3')) {
        lideres.push({
          colIndex: i,
          nome: nome.trim(),
          email: email.trim(),
          turno: turno,
          cargo: cargoRow[i] || '',
        });
      }
    }

    console.log(`✅ Total de líderes identificados: ${lideres.length}`);

    // Processar dados (a partir da linha 6 - índice 5)
    const registros = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (let i = 5; i < rows.length; i++) {
      const row = rows[i];
      
      // Pular linhas vazias
      if (!row || row.length === 0 || !row[0]) continue;

      const semana = normalizarSemana(row[0] || ''); // Ex: W2 → W02
      const pilar = row[1] || '';  // Ex: Safety Walk
      const dataInicio = row[2] || '';
      const dataFim = row[3] || '';
      
      const dataInicioParsed = parseData(dataInicio);
      const dataFimParsed = parseData(dataFim);

      // Filtrar apenas Safety Walk
      if (!pilar.toLowerCase().includes('safety')) continue;

      // Filtrar apenas W5 em diante (desconsiderar W1-W4)
      const weekNumber = parseInt(semana.replace('W', ''));
      if (weekNumber < 5) continue;

      // Processar status de cada líder
      lideres.forEach((lider) => {
        const statusCelula = row[lider.colIndex] || '';
        
        // Se a célula está vazia, significa que não precisa realizar (política da empresa)
        // Não deve ser contabilizado
        if (!statusCelula || statusCelula.trim() === '') {
          return; // Pula este registro
        }
        
        const status = statusCelula.trim();
        const statusLower = status.toLowerCase();
        
        // Verificar se está em férias, afastamento ou ausência justificada
        // Esses casos não devem ser contabilizados
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
          return; // Pula este registro - não contabiliza
        }
        
        // Filtro de turno
        if (filtros.turno && lider.turno !== filtros.turno) return;

        // Determinar se está realizado - LÓGICA MAIS RESTRITIVA
        // Apenas considerar realizado se tiver palavras-chave MUITO específicas
        // Qualquer coisa diferente disso é considerado PENDENTE
        const palavrasRealizadas = ['realizado', 'concluído', 'concluido', 'completo'];
        const realizado = palavrasRealizadas.some(palavra => statusLower === palavra) ||
                         statusLower === 'ok' ||
                         statusLower.startsWith('realizado') ||
                         statusLower.startsWith('concluído') ||
                         statusLower.startsWith('concluido');
        
        // Log para debug - ver o que está sendo processado
        if (semana === 'W7' || semana === 'W6') {
          console.log(`🔍 ${semana} Debug - ${lider.nome} (${lider.turno}): "${status}" → ${realizado ? 'REALIZADO' : 'PENDENTE'}`);
        }

        const registro = {
          semana,
          pilar,
          acao: pilar || 'Safety Walk', // Ação é o tipo de inspeção (pilar)
          dataInicio: dataInicioParsed || '',
          dataFim: dataFimParsed || '',
          responsavel: lider.nome,
          email: lider.email,
          turno: lider.turno,
          cargo: lider.cargo,
          status: realizado ? 'REALIZADO' : 'PENDENTE',
          statusOriginal: status,
          dataPrevista: dataFimParsed || dataInicioParsed || '',
          setor: 'Operações', // Pode ser ajustado conforme necessário
          local: semana,
        };

        registros.push(registro);
      });
    }

    console.log(`✅ Total de registros processados: ${registros.length}`);
    
    // Debug: mostrar todas as semanas disponíveis
    const semanasEncontradas = [...new Set(registros.map(r => r.semana))].sort();
    console.log(`📅 Semanas encontradas na planilha:`, semanasEncontradas);

    // Aplicar filtro de período/semana
    let registrosFiltrados = registros;
    
    if (filtros.periodo === 'semana_atual') {
      // Filtrar pela semana atual
      const semanaAtual = calcularSemanaAtual();
      console.log(`📅 Filtrando pela semana atual: ${semanaAtual}`);
      
      registrosFiltrados = registros.filter(reg => reg.semana === semanaAtual);
      console.log(`📊 Após filtro de semana atual: ${registrosFiltrados.length} registros`);
      
      // Debug: mostrar status dos registros filtrados
      const statusCount = registrosFiltrados.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`📊 Status dos registros filtrados:`, statusCount);
      
      // Debug: mostrar alguns exemplos de registros
      if (registrosFiltrados.length > 0) {
        console.log(`📋 Primeiros 3 registros da ${semanaAtual}:`);
        registrosFiltrados.slice(0, 3).forEach(r => {
          console.log(`   - ${r.responsavel} (${r.turno}): ${r.status} - "${r.statusOriginal}"`);
        });
      }
      
    } else if (filtros.periodo === 'semana_especifica' && filtros.semana) {
      // Filtrar por semana específica
      console.log(`📅 Filtrando pela semana específica: ${filtros.semana}`);
      
      registrosFiltrados = registros.filter(reg => reg.semana === filtros.semana);
      console.log(`📊 Após filtro de semana específica: ${registrosFiltrados.length} registros`);
      
      // Debug: mostrar status dos registros filtrados
      const statusCount = registrosFiltrados.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`📊 Status dos registros filtrados:`, statusCount);
      
      // Debug: mostrar alguns exemplos de registros
      if (registrosFiltrados.length > 0) {
        console.log(`📋 Primeiros 3 registros da ${filtros.semana}:`);
        registrosFiltrados.slice(0, 3).forEach(r => {
          console.log(`   - ${r.responsavel} (${r.turno}): ${r.status} - "${r.statusOriginal}"`);
        });
      }
      
    } else {
      // Sem filtro de período - mostrar todas as semanas
      console.log(`📊 Sem filtro de período - mostrando todos os registros`);
    }

    // Calcular métricas - CONTAR PESSOAS ÚNICAS, NÃO REGISTROS
    const pessoasUnicas = new Set(registrosFiltrados.map(r => r.responsavel));
    const pessoasRealizaram = new Set(
      registrosFiltrados
        .filter(r => r.status === 'REALIZADO')
        .map(r => r.responsavel)
    );
    
    const totalInspecoes = pessoasUnicas.size; // Total de pessoas únicas
    const realizadas = pessoasRealizaram.size; // Pessoas que realizaram pelo menos uma
    const pendentes = totalInspecoes - realizadas; // Pessoas que não realizaram nenhuma
    const taxaConclusao = totalInspecoes > 0 
      ? Number(((realizadas / totalInspecoes) * 100).toFixed(2))
      : 0;

    // Conclusão por turno - PESSOAS ÚNICAS (não registros)
    // Usar registrosFiltrados para respeitar o filtro de semana
    const pessoasComValorPorTurno = {};
    const pessoasRealizaramPorTurno = {};
    
    registrosFiltrados.forEach(r => {
      const turno = r.turno || 'Não informado';
      
      // Inicializar se não existe
      if (!pessoasComValorPorTurno[turno]) {
        pessoasComValorPorTurno[turno] = new Set();
      }
      if (!pessoasRealizaramPorTurno[turno]) {
        pessoasRealizaramPorTurno[turno] = new Set();
      }
      
      // Esta pessoa tem pelo menos um valor (conta no total)
      pessoasComValorPorTurno[turno].add(r.responsavel);
      
      // Se realizou, adicionar às realizadas
      if (r.status === 'REALIZADO') {
        pessoasRealizaramPorTurno[turno].add(r.responsavel);
      }
    });

    // Montar resultado: apenas pessoas que têm valores
    const conclusaoPorTurno = Object.entries(pessoasComValorPorTurno)
      .map(([turno, pessoasSet]) => {
        const total = pessoasSet.size; // Pessoas com pelo menos um valor
        const realizadas = pessoasRealizaramPorTurno[turno]?.size || 0; // Pessoas que realizaram
        
        return {
          turno: turno || 'Não informado',
          total,
          realizadas,
          percentual: total > 0 
            ? Number(((realizadas / total) * 100).toFixed(2))
            : 0,
        };
      })
      .sort((a, b) => a.turno.localeCompare(b.turno));

    // Extrair lista de semanas disponíveis (únicas e ordenadas)
    const semanasDisponiveis = [...new Set(registros.map(r => r.semana))]
      .filter(s => s && s.startsWith('W'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('W', ''));
        const numB = parseInt(b.replace('W', ''));
        return numA - numB;
      });

    const resultado = {
      totalInspecoes,
      realizadas,
      pendentes,
      taxaConclusao,
      naoConformidades: 0, // Será implementado quando houver dados de NC
      registros: registrosFiltrados,
      conclusaoPorTurno,
      naoConformidadesLista: [], // Será implementado quando houver dados de NC
      semanaAtual: calcularSemanaAtual(),
      semanasDisponiveis,
    };

    console.log('📊 Métricas calculadas:', {
      totalInspecoes,
      realizadas,
      pendentes,
      taxaConclusao,
    });
    console.log('=================================\n');

    return {
      success: true,
      data: resultado,
    };

  } catch (error) {
    console.error('❌ Erro ao buscar dados do Safety Walk:', error.message);
    throw error;
  }
};

/**
 * 🔄 Sincronizar dados do Safety Walk (para uso em jobs)
 */
const sincronizarSafetyWalk = async () => {
  try {
    console.log('\n🔄 ===== SINCRONIZAÇÃO SAFETY WALK =====');
    
    const resultado = await buscarDadosSafetyWalk({ periodo: 'mes' });
    
    console.log('✅ Sincronização concluída');
    console.log('=================================\n');

    return resultado;

  } catch (error) {
    console.error('❌ Erro na sincronização do Safety Walk:', error.message);
    throw error;
  }
};

module.exports = {
  buscarDadosSafetyWalk,
  sincronizarSafetyWalk,
};
