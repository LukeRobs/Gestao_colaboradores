const { google } = require('googleapis');

// 📊 CONFIGURAÇÕES DA PLANILHA DE COLABORADORES
const COLABORADORES_SPREADSHEET_ID = process.env.SHEETS_COLABORADORES_SPREADSHEET_ID || '1KV1aZh5k2moYIaUQRWPguf1hjB2nJT44sybzkk0Ki7U';
const COLABORADORES_SHEET = process.env.SHEETS_COLABORADORES_ABA || 'db';

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
const formatarData = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
};

// 📊 Exportar todos os colaboradores para o Google Sheets
const exportarColaboradores = async (prisma) => {
  console.log('\n📊 ===== EXPORTAR COLABORADORES =====');

  const colaboradores = await prisma.colaborador.findMany({
    include: {
      setor: true,
      cargo: true,
      turno: true,
      empresa: true,
      escala: true,
      estacao: true,
      lider: true,
    },
    orderBy: { nomeCompleto: 'asc' },
  });

  console.log(`👥 Colaboradores encontrados: ${colaboradores.length}`);

  const headers = [
    'OPS ID',
    'Matrícula',
    'Nome',
    'CPF',
    'E-mail',
    'Telefone',
    'Gênero',
    'Data Nascimento',
    'Data Admissão',
    'Data Desligamento',
    'Status',
    'Empresa',
    'Setor',
    'Cargo',
    'Turno',
    'Escala',
    'Estação',
    'Líder',
  ];

  const rows = colaboradores.map((c) => [
    c.opsId || '',
    c.matricula || '',
    c.nomeCompleto || '',
    c.cpf || '',
    c.email || '',
    c.telefone || '',
    c.genero || '',
    formatarData(c.dataNascimento),
    formatarData(c.dataAdmissao),
    formatarData(c.dataDesligamento),
    c.status || '',
    c.empresa?.razaoSocial || '',
    c.setor?.nomeSetor || '',
    c.cargo?.nomeCargo || '',
    c.turno?.nomeTurno || '',
    c.escala?.nomeEscala || '',
    c.estacao?.nomeEstacao || '',
    c.lider?.nomeCompleto || '',
  ]);

  const values = [headers, ...rows];

  const sheets = getGoogleSheetsClient();

  // 🧹 Limpar aba antes de escrever
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: COLABORADORES_SPREADSHEET_ID,
      range: COLABORADORES_SHEET,
    });
  } catch (clearError) {
    console.warn('⚠️ Erro ao limpar aba (continuando):', clearError.message);
  }

  // ✍️ Escrever dados na planilha
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: COLABORADORES_SPREADSHEET_ID,
    range: `${COLABORADORES_SHEET}!A1`,
    valueInputOption: 'RAW',
    resource: { values },
  });

  // 🕐 Registrar hora da última atualização na célula T1
  const horaAtualizacao = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: COLABORADORES_SPREADSHEET_ID,
    range: `${COLABORADORES_SHEET}!T1`,
    valueInputOption: 'RAW',
    resource: {
      values: [[`Última atualização: ${horaAtualizacao}`]],
    },
  });

  console.log(`🕐 Hora de atualização registrada: ${horaAtualizacao}`);
  console.log(`✅ Exportação concluída: ${response.data.updatedCells} células atualizadas`);
  console.log('=================================\n');

  return {
    success: true,
    data: {
      totalRegistros: colaboradores.length,
      celulasAtualizadas: response.data.updatedCells,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${COLABORADORES_SPREADSHEET_ID}`,
    },
  };
};

module.exports = {
  exportarColaboradores,
};
