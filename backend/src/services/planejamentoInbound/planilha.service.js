const { google } = require("googleapis");

/**
 * Leitura da planilha do Planning Inbound ("Telemetria LineHual"): a mesma que alimenta o painel
 * "Monitoring · Inbound" em Apps Script. Uma única chamada (batchGet) traz todas as abas de que o
 * COPEOPLE precisa, com cache curto e uma só leitura em andamento por vez, para várias telas não
 * multiplicarem as chamadas ao Google.
 *
 * Abas usadas (as colunas são lidas por posição quando a aba tem nomes repetidos):
 *  - Monitoring    programação das viagens (uma linha por LH e por dia de coleta)
 *  - Telemetria    posições dos veículos (várias leituras por viagem)
 *  - Spp X perfil  duas tabelas lado a lado: A:I = perfil de pacote por LH, J:T = SPP/TOs/sacas por LH
 *  - dbLh/dbLhPE4  realizado por estação (ETA real, descarga, status do SPX)
 *  - motorista     nome do motorista por LH
 */

const SPREADSHEET_ID = process.env.PLANEJAMENTO_INBOUND_SHEET_ID || "1RU3qiW-4caGnezQP3bVA-eGpnirGY5Mbq8FWlCc6mQM";
const CACHE_TTL_MS = 60 * 1000;

const RANGES = {
  monitoring: "'Monitoring'!A:AG",
  telemetria: "'Telemetria'!A:W",
  spp: "'Spp X perfil'!A:T",
  dbLh: "'dbLh'!A:Q",
  dbLhPE4: "'dbLhPE4'!A:Q",
  motorista: "'motorista'!A:B",
};

let cache = null; // { lidoEm, abas }
let emAndamento = null;

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

async function lerAbas() {
  const nomes = Object.keys(RANGES);
  const resposta = await getClient().spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: nomes.map((n) => RANGES[n]),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const abas = {};
  resposta.data.valueRanges.forEach((vr, i) => {
    abas[nomes[i]] = vr.values || [];
  });
  return { lidoEm: Date.now(), abas };
}

/** Abas da planilha (arrays de linhas, cabeçalho incluso). `forcar` ignora o cache. */
async function carregar({ forcar = false } = {}) {
  if (!forcar && cache && Date.now() - cache.lidoEm < CACHE_TTL_MS) return cache;
  if (emAndamento) return emAndamento;
  emAndamento = lerAbas()
    .then((r) => {
      cache = r;
      return r;
    })
    .catch((err) => {
      // Planilha fora do ar: serve o último que deu certo (mesmo vencido) em vez de derrubar a tela.
      if (cache) return cache;
      throw err;
    })
    .finally(() => {
      emAndamento = null;
    });
  return emAndamento;
}

module.exports = { carregar, SPREADSHEET_ID };
