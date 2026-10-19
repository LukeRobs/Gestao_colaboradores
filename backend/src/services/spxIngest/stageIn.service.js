const { google } = require("googleapis");

/**
 * Stage IN (Inbound Staging Area). O SPX manda as ruas (ver receberStageIn); o detalhe por TO (pacotes, aging,
 * turno que endereçou) vem das planilhas "Report Real Time", uma por estação, e o perfil de pacote por TO vem de
 * uma planilha única (aba "db"). As duas são lidas com a service account (somente leitura) e ficam em cache curto.
 */

const REPORT_POR_ESTACAO_SPX = {
  10963: process.env.STAGE_IN_REPORT_SHEET_ID_10963 || "1aIbT7ewZpgZQo_OJT_ChX3SYjNIXy7SMFrI2sXCeP0E", // SoC_PE_Jaboatão dos Guararapes
  15000: process.env.STAGE_IN_REPORT_SHEET_ID_15000 || "1ixxOAyCQiFHUpVfNBG_cLXlWQaG7obp6KQG0HebuMJY", // SoC_PE_Recife_04
};
const PERFIL_SHEET_ID = process.env.STAGE_IN_PERFIL_SHEET_ID || "16do3FeFUI32Zp4asu5u_iMd1fp0Wt2XADBwBhgRr8Ik";
const REPORT_RANGE = "Report!A:I";
const PERFIL_RANGE = "db!A:R";
const CACHE_TTL_MS = 60 * 1000;
const CACHE_ERRO_TTL_MS = 30 * 1000;

const cache = new Map(); // chave -> { lidoEm, valor }
const emAndamento = new Map();

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

/** Lê um intervalo com cache; se o Google falhar, serve a última leitura boa (mesmo vencida). */
async function lerIntervalo(chave, spreadsheetId, range) {
  const c = cache.get(chave);
  if (c && Date.now() - c.lidoEm < (c.erro ? CACHE_ERRO_TTL_MS : CACHE_TTL_MS)) {
    if (c.erro && !c.valor) throw new Error(c.erro);
    return c.valor;
  }
  if (emAndamento.has(chave)) return emAndamento.get(chave);
  const p = getClient()
    .spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" })
    .then((r) => {
      const linhas = (r.data.values || []).slice(1); // pula o cabeçalho
      // Planilha ainda recalculando devolve vazio: não sobrescreve uma leitura boa com isso.
      if (!linhas.length && c?.valor?.length) return c.valor;
      cache.set(chave, { lidoEm: Date.now(), valor: linhas });
      return linhas;
    })
    .catch((err) => {
      if (c?.valor) return c.valor;
      cache.set(chave, { lidoEm: Date.now(), valor: null, erro: err.message });
      throw err;
    })
    .finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, p);
  return p;
}

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const inteiro = (v) => Math.round(num(v));
const txt = (v) => String(v ?? "").trim();

/** Colunas: A=TO, B=ZONA, C=STATION, D=QTD PACOTES, E=RUA, F=AGING_HOURS, G=Hora now, H=Hora endereçamento, I=Turno */
function montarRelatorio(linhas) {
  const porZona = {};
  const porRua = {};
  const porTurno = {};
  const tosPorRua = {};
  // Linhas "fantasma" (fórmula arrastada além dos dados) trazem RUA sem número de TO: não são TOs reais.
  const validas = linhas.filter((r) => txt(r[0]));
  validas.forEach((r) => {
    const zona = txt(r[1]);
    const rua = txt(r[4]);
    const pacotes = inteiro(r[3]);
    const turno = txt(r[8]);
    if (zona) {
      porZona[zona] = porZona[zona] || { tos: 0, pacotes: 0 };
      porZona[zona].tos++;
      porZona[zona].pacotes += pacotes;
    }
    if (rua) {
      porRua[rua] = porRua[rua] || { tos: 0, pacotes: 0, zona };
      porRua[rua].tos++;
      porRua[rua].pacotes += pacotes;
      (tosPorRua[rua] = tosPorRua[rua] || []).push({ to: txt(r[0]), pacotes, agingH: num(r[5]), horaEnd: txt(r[7]), turno });
    }
    if (turno) {
      porTurno[turno] = porTurno[turno] || { tos: 0, pacotes: 0 };
      porTurno[turno].tos++;
      porTurno[turno].pacotes += pacotes;
    }
  });
  return { porZona, porRua, porTurno, tosPorRua, totalLinhas: validas.length };
}

/** Colunas da aba "db": ver comentário em cada índice. */
function montarPerfil(linhas) {
  const porTo = {};
  linhas.forEach((r) => {
    const to = txt(r[0]);
    if (!to) return;
    porTo[to] = {
      zona: txt(r[3]), // D group_name
      semPerfil: inteiro(r[11]), // L
      pp: inteiro(r[12]),
      p: inteiro(r[13]),
      m: inteiro(r[14]),
      g: inteiro(r[15]),
      bulky: inteiro(r[16]),
      ultraBulky: inteiro(r[17]),
    };
  });
  return { porTo, totalLinhas: linhas.length };
}

async function relatorio(spxStationId) {
  const id = REPORT_POR_ESTACAO_SPX[Number(spxStationId)];
  if (!id) return { disponivel: false, erro: "Estação sem planilha de Report configurada" };
  try {
    const dados = montarRelatorio(await lerIntervalo(`report:${id}`, id, REPORT_RANGE));
    return { disponivel: true, ...dados };
  } catch (err) {
    console.error("⚠️ [STAGE-IN] planilha Report:", err.message);
    return { disponivel: false, erro: "Não foi possível ler a planilha de Report" };
  }
}

async function perfil() {
  try {
    const dados = montarPerfil(await lerIntervalo(`perfil:${PERFIL_SHEET_ID}`, PERFIL_SHEET_ID, PERFIL_RANGE));
    return { disponivel: true, ...dados };
  } catch (err) {
    console.error("⚠️ [STAGE-IN] planilha de perfil:", err.message);
    return { disponivel: false, erro: "Não foi possível ler a planilha de perfil de pacote" };
  }
}

module.exports = { relatorio, perfil, montarRelatorio };
