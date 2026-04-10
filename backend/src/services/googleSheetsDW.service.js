const { google } = require("googleapis");

/* =====================================================
   CONFIG
===================================================== */

const DW_SPREADSHEET_ID = "16s1jJEybU-NvjVWQZT6LLqbkfKJ0rX9nVg8u1sfJTA0";
const DW_SHEET = "daily_plan";

/* =====================================================
   CACHE
===================================================== */

let sheetCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function isCacheValid() {
  return (
    sheetCache &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL
  );
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

  return google.sheets({
    version: "v4",
    auth,
    retry: false,
  });
};

/* =====================================================
   HELPERS
===================================================== */

const formatarDataCurta = (dataISO) => {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
};

const normalizar = (v) =>
  String(v ?? "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, "");

/* =====================================================
   CARREGAR PLANILHA
===================================================== */

async function carregarPlanilha() {
  if (isCacheValid()) {
    console.log("📦 DW retornado do cache");
    return sheetCache;
  }

  console.log("🌎 Buscando DW no Google Sheets...");

  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: DW_SPREADSHEET_ID,
    range: `${DW_SHEET}!A1:ZZ200`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    throw new Error("Aba daily_plan vazia");
  }

  sheetCache = rows;
  cacheTimestamp = Date.now();

  console.log("✅ DW armazenado em cache");

  return rows;
}

/* =====================================================
   BUSCAR DW PLANEJADO
===================================================== */

async function buscarDwPlanejado(turno, dataISO) {
  try {
    const rows = await carregarPlanilha();
    const dataBusca = formatarDataCurta(dataISO);

    /* ==========================================
       🔎 Encontrar linha do título DW
    ========================================== */

    let linhaTituloIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (
        rows[i]?.[1] &&
        rows[i][1].trim() === "DW - Daily work [Planned]"
      ) {
        linhaTituloIndex = i;
        break;
      }
    }

    if (linhaTituloIndex === -1) {
      throw new Error("Linha DW - Daily work [Planned] não encontrada");
    }

    console.log("📌 Linha DW encontrada em:", linhaTituloIndex);

    /* ==========================================
       🔎 Encontrar coluna da data
       Datas fixas na linha 3 (index 2)
    ========================================== */

    const LINHA_DATA_INDEX = 2; // linha 3 real

    if (!rows[LINHA_DATA_INDEX]) {
      throw new Error("Linha de datas não encontrada");
    }

    const alvo = normalizar(dataBusca);
    const [dd, mm] = alvo.split("/");
    const alvoSemZero = `${parseInt(dd)}/${parseInt(mm)}`;

    let colunaDataIndex = -1;

    for (let j = 0; j < rows[LINHA_DATA_INDEX].length; j++) {
      const cel = normalizar(rows[LINHA_DATA_INDEX][j]);

      if (
        cel === alvo ||
        cel === alvoSemZero ||
        cel.startsWith(alvo) ||
        cel.startsWith(alvoSemZero)
      ) {
        colunaDataIndex = j;
        break;
      }
    }

    if (colunaDataIndex === -1) {
      throw new Error(`Data ${dataBusca} não encontrada na planilha`);
    }

    console.log("📍 Coluna encontrada:", colunaDataIndex);

    /* ==========================================
       🔁 Normalizar turno
    ========================================== */

    const turnoMap = {
      manha: "T1",
      tarde: "T2",
      noite: "T3",
    };

    const turnoBusca = turnoMap[turno] || turno.toUpperCase();

    /* ==========================================
       🔢 Linha do turno
    ========================================== */

    const linhaTurnoIndex =
      linhaTituloIndex +
      (turnoBusca === "T1"
        ? 1
        : turnoBusca === "T2"
        ? 2
        : turnoBusca === "T3"
        ? 3
        : 0);

    if (!rows[linhaTurnoIndex]) {
      throw new Error(`Turno inválido: ${turno}`);
    }

    let valorRaw = rows[linhaTurnoIndex]?.[colunaDataIndex];

    // proteção contra desalinhamento
    if (valorRaw === undefined && colunaDataIndex > 0) {
      valorRaw = rows[linhaTurnoIndex]?.[colunaDataIndex - 1];
    }

    const dwPlanejado = parseInt(valorRaw) || 0;

    return {
      success: true,
      data: {
        dataConsultada: dataBusca,
        turnoConsultado: turnoBusca,
        dwPlanejado,
      },
    };
  } catch (error) {
    console.error("❌ Erro DW:", error.message);
    throw error;
  }
}

module.exports = {
  buscarDwPlanejado,
};