/**
 * Script de teste para verificar leitura da planilha Atualização_colaborador
 * 
 * Como executar:
 * node test-planilha.js
 */

require('dotenv').config();
const { google } = require('googleapis');

const META_SPREADSHEET_ID = "17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0";
const ATUALIZACAO_SHEET = "Atualização_colaborador";

const normalizar = (v) =>
  String(v ?? "")
    .replace(/\u00A0/g, " ")
    .trim();

const formatarData = (dataISO) => {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

async function testarLeituraPlanilha() {
  try {
    console.log("🔍 Iniciando teste de leitura da planilha...\n");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
      retry: false,
    });

    console.log("✅ Autenticação configurada");
    console.log(`📊 Spreadsheet ID: ${META_SPREADSHEET_ID}`);
    console.log(` Aba: ${ATUALIZACAO_SHEET}\n`);

    console.log("🌎 Buscando dados do Google Sheets...");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: META_SPREADSHEET_ID,
      range: `${ATUALIZACAO_SHEET}!A:ZZ`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.error("❌ Aba vazia ou não encontrada!");
      return;
    }

    console.log(`✅ Planilha carregada: ${rows.length} linhas\n`);

    // Estrutura da planilha (formato de colunas):
    // Linha 1: "Soma Total Por Hora" | valor_hora1 | valor_hora2 | ...
    // Linha 2: "" | timestamp1 | timestamp2 | ...
    // Linha 3: "" | data1 | data2 | ...
    // Linha 4: "" | hora1 | hora2 | ...

    console.log("📋 ESTRUTURA DA PLANILHA:");
    console.log(`   Linha 0: ${rows[0][0]}`);
    console.log(`   Linha 1: ${rows[1][0]} (valores nas colunas seguintes)`);
    console.log(`   Linha 2: Timestamps`);
    console.log(`   Linha 3: Datas`);
    console.log(`   Linha 4: Horas\n`);

    const linhaSomaTotalPorHora = rows[1];
    const linhaDatas = rows[3];
    const linhaHoras = rows[4];

    console.log(`� Total de colunas: ${linhaSomaTotalPorHora.length}\n`);
    console.log("📋 Primeiras 20 colunas:");
    for (let i = 0; i < Math.min(20, linhaSomaTotalPorHora.length); i++) {
      console.log(`   [${i}] Data: "${linhaDatas[i]}" | Hora: "${linhaHoras[i]}" | Valor: "${linhaSomaTotalPorHora[i]}"`);
    }

    const dataISO = "2026-03-06"; // Data correta da planilha
    const dataBusca = formatarData(dataISO);
    
    console.log(`\n\n🔍 BUSCANDO DATA: ${dataBusca}\n`);

    const quantidadePorHora = {};
    
    for (let colIndex = 1; colIndex < linhaSomaTotalPorHora.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      const horaColuna = normalizar(linhaHoras[colIndex]);
      const valorColuna = linhaSomaTotalPorHora[colIndex];

      if (dataColuna !== dataBusca) {
        continue;
      }

      const horaMatch = horaColuna.match(/^(\d{1,2})/);
      if (!horaMatch) {
        continue;
      }

      const hora = parseInt(horaMatch[1]);
      
      if (hora < 0 || hora > 23) {
        continue;
      }

      if (valorColuna && valorColuna !== "") {
        const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
        const quantidade = parseFloat(valorStr) || 0;

        if (quantidade > 0) {
          quantidadePorHora[hora] = (quantidadePorHora[hora] || 0) + quantidade;
          console.log(`   ✅ Hora ${hora.toString().padStart(2, '0')} (col ${colIndex}): ${quantidade}`);
        }
      }
    }

    console.log("\n\n� RESUMO FINAL:");
    console.log(JSON.stringify(quantidadePorHora, null, 2));
    
    const totalRealizado = Object.values(quantidadePorHora).reduce((a, b) => a + b, 0);
    console.log(`\n✅ Total realizado: ${totalRealizado.toLocaleString('pt-BR')}`);
    console.log(`✅ Horas com dados: ${Object.keys(quantidadePorHora).length}`);

  } catch (error) {
    console.error("\n❌ ERRO:", error.message);
    console.error("\nStack:", error.stack);
    
    if (error.message.includes("credentials")) {
      console.error("\n💡 Verifique se as variáveis GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY estão configuradas no .env");
    }
  }
}

testarLeituraPlanilha();
