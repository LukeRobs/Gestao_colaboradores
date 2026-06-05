const { google } = require("googleapis");

/* =====================================================
   CONFIG
===================================================== */

const DEFAULT_SPREADSHEET_ID = "17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0";
const DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID = "1QKrqffSjAXrOWtMeTwDYhhfbyU0BakjvSODg3C6bxCI";

const META_SHEET = "Meta";
const PRODUCAO_ONTIME_SHEET = "ProdutividadeSPX";

/* =====================================================
   CACHE POR SPREADSHEET ID
===================================================== */

const cacheMap = new Map();
const CACHE_TTL = 1 * 60 * 1000; // 1 min

function getCache(spreadsheetId) {
  if (!cacheMap.has(spreadsheetId)) {
    cacheMap.set(spreadsheetId, {
      meta: null, metaTs: null,
      ontime: null, ontimeTs: null,
    });
  }
  return cacheMap.get(spreadsheetId);
}

function isCacheValid(ts) {
  return ts && Date.now() - ts < CACHE_TTL;
}

function limparCache(spreadsheetId) {
  if (spreadsheetId) {
    cacheMap.delete(spreadsheetId);
    console.log(`🗑️ Cache limpo para ${spreadsheetId}`);
  } else {
    cacheMap.clear();
    console.log("🗑️ Todo cache limpo");
  }
}

/* =====================================================
   GOOGLE CLIENT
===================================================== */

const getGoogleSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth, retry: false });
};

/* =====================================================
   HELPERS
===================================================== */

const formatarData = (dataISO) => {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

const normalizar = (v) =>
  String(v ?? "").replace(/ /g, " ").trim();

// Converte "DD/MM/YYYY HH:MM:SS" (horário de SP) para objeto Date
function parseDateBR(str) {
  if (!str || !str.includes("/")) return null;
  const [datePart, timePart] = str.split(" ");
  if (!datePart) return null;
  const [dia, mes, ano] = datePart.split("/");
  const time = timePart || "00:00:00";
  return new Date(`${ano}-${mes}-${dia}T${time}-03:00`);
}

/* =====================================================
   CARREGAR ABA META
===================================================== */

async function carregarPlanilha(spreadsheetId) {
  const cache = getCache(spreadsheetId);
  if (isCacheValid(cache.metaTs)) {
    console.log("📦 Meta retornada do cache");
    return cache.meta;
  }

  console.log(`🌎 Buscando Meta no Google Sheets [${spreadsheetId}]...`);
  const sheets = getGoogleSheetsClient();

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${META_SHEET}!A:E`,
      valueRenderOption: "FORMATTED_VALUE",
    });
  } catch (err) {
    const msg = err?.message || "";
    if (
      msg.includes("Unable to parse range") ||
      msg.includes("404") ||
      msg.includes("not found")
    ) {
      const e = new Error(`Planilha não configurada para esta estação`);
      e.code = "SHEETS_NOT_CONFIGURED";
      throw e;
    }
    throw err;
  }

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    const e = new Error(`Planilha não configurada para esta estação`);
    e.code = "SHEETS_NOT_CONFIGURED";
    throw e;
  }

  cache.meta = rows;
  cache.metaTs = Date.now();
  console.log("✅ Meta armazenada em cache");
  return rows;
}

/* =====================================================
   CARREGAR ABA PRODUTIVIDADE ONTIME (ProdutividadeSPX)
===================================================== */

async function carregarProdutividadeOnTime(spreadsheetId) {
  const cache = getCache(spreadsheetId);
  if (isCacheValid(cache.ontimeTs)) {
    console.log("📦 ProdutividadeSPX retornada do cache");
    return cache.ontime;
  }

  console.log(`🌎 Buscando ProdutividadeSPX no Google Sheets [${spreadsheetId}]...`);
  const sheets = getGoogleSheetsClient();

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCAO_ONTIME_SHEET}!A:ZZ`,
      valueRenderOption: "FORMATTED_VALUE",
    });
  } catch (err) {
    const msg = err?.message || "";
    if (
      msg.includes("Unable to parse range") ||
      msg.includes("404") ||
      msg.includes("not found")
    ) {
      const e = new Error(`Planilha OnTime não configurada`);
      e.code = "SHEETS_NOT_CONFIGURED";
      throw e;
    }
    throw err;
  }

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  cache.ontime = rows;
  cache.ontimeTs = Date.now();
  console.log("✅ ProdutividadeSPX armazenada em cache");
  return rows;
}

/* =====================================================
   BUSCAR METAS POR TURNO E DATA
===================================================== */

async function buscarMetasProducao(turno, dataISO, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  try {
    console.log("🔍 Iniciando busca de metas:", { turno, dataISO, spreadsheetId });

    const rows = await carregarPlanilha(spreadsheetId);
    const dataBusca = formatarData(dataISO);

    const metasPorHora = {};
    let metaDia = 0;
    let metaProdutividade = 0;
    let linhasEncontradas = 0;

    // Helper para parsear um número no formato BR (1.234,56 ou 1234)
    function parseBR(raw) {
      const s = String(raw || "0").trim();
      if (s.includes(".") && s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
      if (s.includes(",") && !s.includes(".")) {
        const partes = s.split(",");
        return parseFloat(partes[1]?.length === 3 ? s.replace(",", "") : s.replace(",", ".")) || 0;
      }
      return parseFloat(s) || 0;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      const dataRow = normalizar(row[0]);
      const horaRaw = normalizar(row[1]);
      const hora = parseInt(horaRaw);

      const meta = parseBR(row[3]);

      // Coluna C (índice 2) — meta de produtividade por operador (items/pessoa)
      // Tomamos o primeiro valor positivo encontrado para o turno/data
      const colC = parseBR(row[2]);
      if (colC > 0 && metaProdutividade === 0) {
        // Só captura se ainda não foi definido — um valor por turno é suficiente
        const turnoTeste = row[4] ? normalizar(row[4]) : null;
        const horaNumC = hora;
        let turnoTesteFinal = turnoTeste;
        if (!turnoTesteFinal) {
          if (horaNumC >= 6 && horaNumC <= 13) turnoTesteFinal = "T1";
          else if (horaNumC >= 14 && horaNumC <= 21) turnoTesteFinal = "T2";
          else turnoTesteFinal = "T3";
        }
        if (dataRow === dataBusca && turnoTesteFinal === turno) {
          metaProdutividade = colC;
        }
      }

      let turnoRow = row[4] ? normalizar(row[4]) : null;
      if (!turnoRow) {
        if (hora >= 6 && hora <= 13) turnoRow = "T1";
        else if (hora >= 14 && hora <= 21) turnoRow = "T2";
        else turnoRow = "T3";
      }

      if (dataRow === dataBusca && turnoRow === turno && !isNaN(hora)) {
        linhasEncontradas++;
        metasPorHora[hora] = (metasPorHora[hora] || 0) + meta;
        metaDia += meta;
      }
    }

    if (linhasEncontradas === 0) {
      console.warn("⚠️ Nenhuma linha encontrada para:", { turno, data: dataBusca, spreadsheetId });
    }

    return {
      success: true,
      data: { dataConsultada: dataBusca, turnoConsultado: turno, metaDia, metasPorHora, metaProdutividade },
    };
  } catch (error) {
    console.error("❌ Erro ao buscar metas:", error.message);
    throw error;
  }
}

/* =====================================================
   BUSCAR QUANTIDADE REALIZADA POR HORA (ProdutividadeSPX)

   Lê a aba ProdutividadeSPX dinamicamente:
   - Linha 0 = cabeçalho (Operador, ID Ops, HH:MM..., Total, Atualizado em)
   - Linhas 1+ = um operador por linha
   - Soma todos os operadores por coluna de hora
   - dataISO ignorado pois a aba sempre reflete o período atual
===================================================== */

async function buscarQuantidadeRealizada(dataISO, spreadsheetId = DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID) {
  try {
    const rows = await carregarProdutividadeOnTime(spreadsheetId);
    if (!rows || rows.length < 2) return { success: false, data: {} };

    const headerRow = rows[0];

    // Mapeia índice de coluna → número da hora (ex: "16:00" → 16)
    const colToHora = {};
    let colAtualizadoEm = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const cell = normalizar(headerRow[i]);
      const matchHora = cell.match(/^(\d{1,2}):\d{2}$/);
      if (matchHora) {
        colToHora[i] = parseInt(matchHora[1], 10);
      } else if (cell.toLowerCase().includes("atualizado")) {
        colAtualizadoEm = i;
      }
    }

    // Data esperada no formato DD/MM/YYYY para filtrar pelo campo "Atualizado em"
    const dataBusca = dataISO ? formatarData(dataISO) : null;

    // Soma operadores por hora, filtrando pela data de atualização
    const quantidadePorHora = {};
    let operadoresFiltrados = 0;
    let maxTimestamp = null; // timestamp mais recente do campo "Atualizado em"

    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.length === 0) continue;

      const nomeOp = normalizar(row[0]);
      if (!nomeOp || nomeOp.toLowerCase() === "operador") continue;

      // Filtra pelo campo "Atualizado em" — só inclui operadores atualizados na data buscada
      let atualizadoEm = "";
      if (colAtualizadoEm >= 0) {
        atualizadoEm = normalizar(row[colAtualizadoEm] ?? "");
      }

      if (dataBusca && colAtualizadoEm >= 0) {
        const dataAtualizacao = atualizadoEm.split(" ")[0]; // extrai "DD/MM/YYYY"
        if (dataAtualizacao !== dataBusca) continue;
      }

      // Rastreia o timestamp mais recente entre os operadores filtrados
      if (atualizadoEm) {
        const tsDate = parseDateBR(atualizadoEm);
        if (tsDate && (!maxTimestamp || tsDate > maxTimestamp)) {
          maxTimestamp = tsDate;
        }
      }

      operadoresFiltrados++;

      for (const [colStr, hora] of Object.entries(colToHora)) {
        const col = parseInt(colStr);
        const valorCell = row[col];
        if (!valorCell || valorCell === "" || valorCell === "0") continue;

        const valorStr = String(valorCell).trim().replace(/\./g, "").replace(",", ".");
        const quantidade = parseFloat(valorStr) || 0;
        if (quantidade > 0) {
          quantidadePorHora[hora] = (quantidadePorHora[hora] || 0) + quantidade;
        }
      }
    }

    const ultimaAtualizacaoSheets = maxTimestamp ? maxTimestamp.toISOString() : null;
    console.log(`✅ Quantidade realizada OnTime: ${Object.keys(quantidadePorHora).length} horas | ${operadoresFiltrados} operadores | última atualização: ${ultimaAtualizacaoSheets ?? "—"}`);
    return { success: true, data: quantidadePorHora, ultimaAtualizacaoSheets };
  } catch (error) {
    console.error("❌ Erro ao buscar quantidade realizada OnTime:", error.message);
    return { success: false, data: {} };
  }
}

module.exports = {
  buscarMetasProducao,
  buscarQuantidadeRealizada,
  limparCache,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_PRODUCAO_ONTIME_SPREADSHEET_ID,
};
