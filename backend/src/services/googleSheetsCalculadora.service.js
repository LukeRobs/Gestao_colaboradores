const { google } = require("googleapis");

const SPREADSHEET_ID = "16s1jJEybU-NvjVWQZT6LLqbkfKJ0rX9nVg8u1sfJTA0";
const SHEET = "Calculadora";

// Colunas de Diarista por turno (0-based): C=2, D=3, E=4
const TURNO_COL = { 1: 3, 2: 4, 3: 5 };

let cache = null;
let cacheTs = null;
const CACHE_TTL = 5 * 60 * 1000;

function isCacheValid() {
  return cache && cacheTs && Date.now() - cacheTs < CACHE_TTL;
}

function getClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth, retry: false });
}

async function carregarCalculadora() {
  if (isCacheValid()) return cache;

  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:E`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  cache = res.data.values || [];
  cacheTs = Date.now();
  return cache;
}

/**
 * Busca a quantidade planejada de diaristas na aba Calculadora.
 * @param {string} dataISO - formato "YYYY-MM-DD"
 * @param {number} idTurno - 1, 2 ou 3
 * @returns {Promise<number>}
 */
async function buscarDwPlanejadoCalculadora(dataISO, idTurno) {
  const rows = await carregarCalculadora();

  // Converte dataISO para número serial do Excel/Sheets para comparar com UNFORMATTED_VALUE
  // Sheets retorna datas como número serial quando UNFORMATTED_VALUE
  // Alternativa: usar FORMATTED_VALUE e comparar string
  // Vamos recarregar com FORMATTED_VALUE para facilitar
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:F`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const allRows = res.data.values || [];

  // Formata a data buscada para dd/mm/yyyy
  const [ano, mes, dia] = dataISO.split("-");
  const dataBusca = `${dia}/${mes}/${ano}`;

  const col = TURNO_COL[Number(idTurno)];
  if (col === undefined) return 0;

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || !row[1]) continue;

    if (row[1].trim() === dataBusca) {
      const val = row[col];
      return parseInt(val) || 0;
    }
  }

  return 0;
}

/**
 * Busca múltiplas quantidades planejadas de uma vez (batch).
 * @param {Array<{dataISO: string, idTurno: number}>} requests
 * @returns {Promise<Map<string, number>>} Map com chave "dataISO_idTurno" e valor quantidade
 */
async function buscarDwPlanejadoCalculadoraBatch(requests) {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:F`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const allRows = res.data.values || [];
  const resultado = new Map();

  for (const { dataISO, idTurno } of requests) {
    const [ano, mes, dia] = dataISO.split("-");
    const dataBusca = `${dia}/${mes}/${ano}`;
    const col = TURNO_COL[Number(idTurno)];

    if (col === undefined) {
      resultado.set(`${dataISO}_${idTurno}`, 0);
      continue;
    }

    let encontrado = false;
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || !row[1]) continue;

      if (row[1].trim() === dataBusca) {
        const val = parseInt(row[col]) || 0;
        resultado.set(`${dataISO}_${idTurno}`, val);
        encontrado = true;
        break;
      }
    }

    if (!encontrado) {
      resultado.set(`${dataISO}_${idTurno}`, 0);
    }
  }

  return resultado;
}

module.exports = { buscarDwPlanejadoCalculadora, buscarDwPlanejadoCalculadoraBatch };
