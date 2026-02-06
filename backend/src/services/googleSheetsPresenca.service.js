const { google } = require('googleapis');

// 📊 CONFIGURAÇÕES DA PLANILHA DE PRESENÇA
const PRESENCA_SPREADSHEET_ID = process.env.SHEETS_PRESENCA_SPREADSHEET_ID || '1lgrpflaIybMq7Z-8tZ7A6cueepYZ0yNBTSyDYvNaWNk';
const PRESENCA_SHEET = process.env.SHEETS_PRESENCA_ABA || 'Controle_Presenca';


// 🔧 Inicializar Google Sheets API com permissão de escrita
const getGoogleSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

// 📅 Formatar data para DD/MM/YYYY
const formatarData = (dataISO) => {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
};

// 🎨 Formatar horário de Time para HH:mm
const formatarHorario = (timeDate) => {
  if (!timeDate) return '';
  
  const d = new Date(timeDate);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

// 📐 Função auxiliar para converter número de coluna em letra (A, B, C, ..., Z, AA, AB, ...)
const getColumnLetter = (num) => {
  let letter = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
};

// � Garantir que a aba existe, se não, criar
const garantirAbaExiste = async (sheets, spreadsheetId, nomeAba) => {
  try {
    // Buscar informações da planilha
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    // Verificar se a aba já existe
    const abaExiste = spreadsheet.data.sheets.some(
      sheet => sheet.properties.title === nomeAba
    );

    if (abaExiste) {
      console.log(`✅ Aba "${nomeAba}" já existe`);
      return;
    }

    // Criar nova aba
    console.log(`📝 Criando nova aba "${nomeAba}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: nomeAba,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 50,
                },
              },
            },
          },
        ],
      },
    });

    console.log(`✅ Aba "${nomeAba}" criada com sucesso`);
  } catch (error) {
    console.error(`❌ Erro ao verificar/criar aba "${nomeAba}":`, error.message);
    throw error;
  }
};

// 📊 Exportar controle de presença para Google Sheets
const exportarControlePresenca = async (mes, dadosPresenca) => {
  try {
    console.log('\n📊 ===== EXPORTAR CONTROLE DE PRESENÇA =====');
    console.log(`📅 Mês: ${mes}`);
    console.log(`👥 Colaboradores: ${dadosPresenca.colaboradores?.length || 0}`);

    const sheets = getGoogleSheetsClient();
    const [ano, mesNum] = mes.split('-').map(Number);
    const dias = dadosPresenca.dias || [];

    // 🗓️ Nome da aba dinâmico por mês (ex: Presenca_2026_02)
    const nomeAba = `Presenca_${ano}_${String(mesNum).padStart(2, '0')}`;
    console.log(`📑 Aba de destino: ${nomeAba}`);

    // 🔍 Verificar se a aba existe, se não, criar
    await garantirAbaExiste(sheets, PRESENCA_SPREADSHEET_ID, nomeAba);

    // 🏗️ Construir cabeçalho
    const headers = [
      'OPS ID',
      'Nome Completo',
      'Turno',
      'Escala',
      ...dias.map(dia => {
        const dataISO = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        return formatarData(dataISO);
      })
    ];

    // 🏗️ Construir linhas de dados
    const rows = dadosPresenca.colaboradores.map(colab => {
      const dadosBasicos = [
        colab.opsId || '',
        colab.nome || '',
        colab.turno || '',
        colab.escala || ''
      ];

      // Adicionar status de cada dia
      const statusDias = dias.map(dia => {
        const dataISO = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const registro = colab.dias?.[dataISO];
        
        if (!registro) return '-';
        
        let status = registro.status || '-';
        
        // Se tem entrada/saída, adicionar horários
        if (registro.entrada || registro.saida) {
          const entrada = formatarHorario(registro.entrada);
          const saida = formatarHorario(registro.saida);
          
          if (entrada || saida) {
            status = `${status} (${entrada || '--'}/${saida || '--'})`;
          }
        }
        
        return status;
      });

      return [...dadosBasicos, ...statusDias];
    });

    // 📝 Preparar dados para envio
    const values = [headers, ...rows];

    console.log(`📊 Total de linhas: ${values.length}`);
    console.log(`📊 Total de colunas: ${headers.length}`);

    // 🧹 Limpar aba antes de escrever
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: PRESENCA_SPREADSHEET_ID,
        range: nomeAba,
      });
      console.log('✅ Aba limpa com sucesso');
    } catch (clearError) {
      console.warn('⚠️ Erro ao limpar aba (continuando):', clearError.message);
    }

    // ✍️ Escrever dados na planilha
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: PRESENCA_SPREADSHEET_ID,
      range: `${nomeAba}!A1`,
      valueInputOption: 'RAW',
      resource: { values },
    });

    console.log(`✅ Dados escritos: ${response.data.updatedCells} células`);

    // 🎯 Obter sheetId da aba para formatação
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: PRESENCA_SPREADSHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets.find(
      s => s.properties.title === nomeAba
    );
    
    const sheetId = sheet?.properties?.sheetId || 0;
    console.log(`📋 SheetId da aba "${nomeAba}": ${sheetId}`);

    // 🎨 Formatar cabeçalho (negrito e cor de fundo)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: PRESENCA_SPREADSHEET_ID,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: headers.length,
              },
            },
          },
        ],
      },
    });

    console.log(`✅ Exportação concluída: ${response.data.updatedCells} células atualizadas`);
    console.log(`📊 Linhas: ${values.length} | Colunas: ${headers.length}`);
    console.log(`📑 Aba: ${nomeAba}`);
    console.log('=================================\n');

    return {
      success: true,
      data: {
        mes,
        nomeAba,
        colaboradores: dadosPresenca.colaboradores.length,
        celulasAtualizadas: response.data.updatedCells,
        linhas: values.length,
        colunas: headers.length,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${PRESENCA_SPREADSHEET_ID}`,
      },
    };

  } catch (error) {
    console.error('❌ Erro ao exportar controle de presença:', error.message);
    throw error;
  }
};

// 🔄 Sincronizar controle de presença (para uso em jobs)
const sincronizarControlePresenca = async (prisma) => {
  try {
    console.log('\n🔄 ===== SINCRONIZAÇÃO AUTOMÁTICA =====');
    
    // Pegar mês atual
    const hoje = new Date();
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicioMes = new Date(ano, mesNum - 1, 1);
    const fimMes = new Date(ano, mesNum, 0, 23, 59, 59);

    // Buscar colaboradores ativos
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        status: 'ATIVO',
        dataDesligamento: null,
      },
      include: { 
        turno: true, 
        escala: true,
        ausencias: {
          where: {
            status: 'ATIVO',
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
          include: { tipoAusencia: true },
        },
        atestadosMedicos: {
          where: {
            status: 'ATIVO',
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
        },
      },
      orderBy: { nomeCompleto: 'asc' },
    });

    if (!colaboradores.length) {
      console.log('⚠️ Nenhum colaborador ativo encontrado');
      return { success: false, message: 'Nenhum colaborador ativo' };
    }

    const opsIds = colaboradores.map(c => c.opsId);

    // Buscar frequências do mês
    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: opsIds },
        dataReferencia: { gte: inicioMes, lte: fimMes },
      },
      include: { tipoAusencia: true },
      orderBy: [
        { dataReferencia: 'asc' },
        { manual: 'asc' },
        { idFrequencia: 'asc' },
      ],
    });

    // Processar dados (mesma lógica do controller)
    const freqMap = {};
    for (const f of frequencias) {
      const key = `${f.opsId}_${f.dataReferencia.toISOString().slice(0, 10)}`;
      
      if (!freqMap[key]) {
        freqMap[key] = f;
        continue;
      }
      
      if (f.manual && !freqMap[key].manual) {
        freqMap[key] = f;
        continue;
      }
      
      if (f.manual && freqMap[key].manual) {
        if (f.idFrequencia > freqMap[key].idFrequencia) freqMap[key] = f;
      }
    }

    const dias = Array.from(
      { length: new Date(ano, mesNum, 0).getDate() },
      (_, i) => i + 1
    );

    const resultado = colaboradores.map(c => {
      const diasMap = {};

      for (let d = 1; d <= dias.length; d++) {
        const dataCalendario = new Date(ano, mesNum - 1, d);
        dataCalendario.setHours(0, 0, 0, 0);
        const dataISO = dataCalendario.toISOString().slice(0, 10);
        const key = `${c.opsId}_${dataISO}`;

        // Prioridade: manual > ausência/atestado > frequência > DSR > falta
        if (freqMap[key]?.manual) {
          const f = freqMap[key];
          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo,
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: !!f.validado,
            manual: true,
          };
          continue;
        }

        // Status administrativo
        const atestado = c.atestadosMedicos?.find(
          a => dataCalendario >= new Date(a.dataInicio) && dataCalendario <= new Date(a.dataFim)
        );
        if (atestado) {
          diasMap[dataISO] = { status: 'AM', origem: 'atestado', manual: false };
          continue;
        }

        const ausencia = c.ausencias?.find(
          a => dataCalendario >= new Date(a.dataInicio) && dataCalendario <= new Date(a.dataFim)
        );
        if (ausencia) {
          diasMap[dataISO] = {
            status: ausencia.tipoAusencia?.codigo || 'AUS',
            origem: 'ausencia',
            manual: false,
          };
          continue;
        }

        // Frequência
        if (freqMap[key]) {
          const f = freqMap[key];
          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo,
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: f.validado,
            manual: f.manual ?? false,
          };
          continue;
        }

        // DSR
        const dow = dataCalendario.getDay();
        const dsrMap = { A: [0, 3], B: [1, 2], C: [4, 5] };
        const dias = dsrMap[String(c.escala?.nomeEscala || '').toUpperCase()];
        if (dias?.includes(dow)) {
          diasMap[dataISO] = { status: 'DSR', manual: false };
          continue;
        }

        // Falta
        diasMap[dataISO] = { status: '-', manual: false };
      }

      return {
        opsId: c.opsId,
        nome: c.nomeCompleto,
        turno: c.turno?.nomeTurno,
        escala: c.escala?.nomeEscala,
        dias: diasMap,
      };
    });

    // Exportar para Google Sheets
    const resultadoExportacao = await exportarControlePresenca(mes, {
      dias,
      colaboradores: resultado,
    });

    console.log('✅ Sincronização concluída com sucesso');
    console.log('=================================\n');

    return resultadoExportacao;

  } catch (error) {
    console.error('❌ Erro na sincronização:', error.message);
    throw error;
  }
};

module.exports = {
  exportarControlePresenca,
  sincronizarControlePresenca,
};