const { google } = require('googleapis');

// 📊 PLANILHA DAILY PLAN
const DW_SPREADSHEET_ID = '16s1jJEybU-NvjVWQZT6LLqbkfKJ0rX9nVg8u1sfJTA0';
const DW_SHEET = 'daily_plan';

// 🔧 Inicializar Google Sheets API (MESMO PADRÃO)
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

// 📅 Normalizar data para DD/MM
const formatarDataCurta = (dataISO) => {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
};

// 🧠 LINHAS FIXAS DA PLANILHA
const LINHAS_TURNO = {
  T1: 101, // linha 102 (index 101)
  T2: 102, // linha 103
  T3: 103  // linha 104
};

const TITULO_LINHA_INDEX = 100; // linha 101 (DW - Daily work [Planned])
const COLUNA_TITULO_INDEX = 1;  // coluna B

// 📊 Buscar DW Planejado
const buscarDwPlanejado = async (turno, dataISO) => {
  try {
    console.log('\n📊 ===== BUSCAR DW PLANEJADO =====');
    console.log(`📅 Data (ISO): ${dataISO}`);
    console.log(`🕐 Turno solicitado: ${turno}`);

    const sheets = getGoogleSheetsClient();
    const dataBusca = formatarDataCurta(dataISO);

    console.log(`🔍 Data formatada para planilha: ${dataBusca}`);

    // Buscar planilha inteira (seguro para esse layout)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: DW_SPREADSHEET_ID,
      range: `${DW_SHEET}!A1:ZZ200`,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      throw new Error('Aba daily_plan vazia');
    }

    // 🔎 Validar título
    const titulo = rows[TITULO_LINHA_INDEX]?.[COLUNA_TITULO_INDEX];
    console.log(`📌 Título encontrado: ${titulo}`);

    if (!titulo || !titulo.includes('DW - Daily work')) {
      throw new Error('Linha DW - Daily work [Planned] não encontrada');
    }

    // 🔎 Encontrar coluna da data
    let colunaDataIndex = -1;
    let linhaHeaderIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const idx = rows[i].indexOf(dataBusca);
      if (idx !== -1) {
        colunaDataIndex = idx;
        linhaHeaderIndex = i;
        break;
      }
    }

    if (colunaDataIndex === -1) {
      throw new Error(`Data ${dataBusca} não encontrada na planilha`);
    }

    console.log(`📍 Data encontrada na linha ${linhaHeaderIndex + 1}, coluna ${colunaDataIndex + 1}`);

    // 🔁 Normalizar turno
    const turnoMap = {
      manha: 'T1',
      tarde: 'T2',
      noite: 'T3'
    };
    const turnoBusca = turnoMap[turno] || turno.toUpperCase();

    const linhaTurnoIndex = LINHAS_TURNO[turnoBusca];

    if (linhaTurnoIndex === undefined) {
      throw new Error(`Turno inválido: ${turno}`);
    }

    // 🔢 Valor DW Planejado
    const valorRaw = rows[linhaTurnoIndex]?.[colunaDataIndex] || 0;
    const dwPlanejado = parseInt(valorRaw) || 0;

    console.log(`📊 DW Planejado (${turnoBusca}): ${dwPlanejado}`);
    console.log('=================================\n');

    return {
      success: true,
      data: {
        dataConsultada: dataBusca,
        turnoConsultado: turnoBusca,
        dwPlanejado
      }
    };

  } catch (error) {
    console.error('❌ Erro ao buscar DW Planejado:', error.message);
    throw error;
  }
};

module.exports = {
  buscarDwPlanejado
};
