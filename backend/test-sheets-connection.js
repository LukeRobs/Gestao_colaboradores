/**
 * Script de teste para verificar conexão com Google Sheets
 * 
 * Execute com: node test-sheets-connection.js
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEETS_PRESENCA_SPREADSHEET_ID || '1lgrpflaIybMq7Z-8tZ7A6cueepYZ0yNBTSyDYvNaWNk';

// Nome da aba de teste (usa mês atual)
const hoje = new Date();
const ano = hoje.getFullYear();
const mes = String(hoje.getMonth() + 1).padStart(2, '0');
const SHEET_NAME = `Presenca_${ano}_${mes}`;

async function testarConexao() {
  console.log('\n🔍 ===== TESTE DE CONEXÃO GOOGLE SHEETS =====\n');

  try {
    // 1. Verificar variáveis de ambiente
    console.log('📋 Verificando variáveis de ambiente...');
    
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error('❌ GOOGLE_CLIENT_EMAIL não configurado no .env');
    }
    console.log(`✅ GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL}`);

    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('❌ GOOGLE_PRIVATE_KEY não configurado no .env');
    }
    console.log('✅ GOOGLE_PRIVATE_KEY: Configurado');

    console.log(`✅ SPREADSHEET_ID: ${SPREADSHEET_ID}`);
    console.log(`✅ SHEET_NAME: ${SHEET_NAME}\n`);

    // 2. Inicializar cliente
    console.log('🔧 Inicializando cliente Google Sheets...');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Cliente inicializado\n');

    // 3. Testar acesso à planilha
    console.log('📊 Testando acesso à planilha...');
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log(`✅ Planilha encontrada: "${spreadsheet.data.properties.title}"`);
    console.log(`📍 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    // 4. Verificar abas
    console.log('📑 Verificando abas disponíveis...');
    
    const abas = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log(`✅ Abas encontradas: ${abas.join(', ')}`);

    if (!abas.includes(SHEET_NAME)) {
      console.log(`\n⚠️  ATENÇÃO: Aba "${SHEET_NAME}" não encontrada!`);
      console.log(`   O sistema criará automaticamente esta aba na primeira exportação.\n`);
    } else {
      console.log(`✅ Aba "${SHEET_NAME}" encontrada\n`);
    }

    // 5. Testar escrita
    console.log('✍️  Testando permissão de escrita...');
    
    const testData = [
      ['Teste de Conexão', new Date().toISOString()],
      ['Status', 'Conexão OK ✅']
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:B2`,
      valueInputOption: 'RAW',
      resource: { values: testData },
    });

    console.log('✅ Escrita realizada com sucesso\n');

    // 6. Testar leitura
    console.log('📖 Testando leitura...');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:B2`,
    });

    console.log('✅ Leitura realizada com sucesso');
    console.log('📄 Dados lidos:', response.data.values);

    // Sucesso!
    console.log('\n✅ ===== TESTE CONCLUÍDO COM SUCESSO! =====\n');
    console.log('🎉 Tudo configurado corretamente!');
    console.log('🚀 Você pode iniciar o servidor e usar a exportação.\n');

  } catch (error) {
    console.error('\n❌ ===== ERRO NO TESTE =====\n');
    
    if (error.code === 403) {
      console.error('❌ ERRO DE PERMISSÃO (403)');
      console.error('\n📝 Solução:');
      console.error('   1. Abra a planilha: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
      console.error('   2. Clique em "Compartilhar"');
      console.error('   3. Adicione o email: ' + process.env.GOOGLE_CLIENT_EMAIL);
      console.error('   4. Defina permissão como "Editor"');
      console.error('   5. Execute este teste novamente\n');
    } else if (error.code === 404) {
      console.error('❌ PLANILHA NÃO ENCONTRADA (404)');
      console.error('\n📝 Solução:');
      console.error('   1. Verifique se o SPREADSHEET_ID está correto no .env');
      console.error('   2. Verifique se a planilha existe');
      console.error('   3. Verifique se a conta de serviço tem acesso\n');
    } else {
      console.error('❌ Erro:', error.message);
      console.error('\n📝 Detalhes:', error);
    }

    process.exit(1);
  }
}

// Executar teste
testarConexao();
