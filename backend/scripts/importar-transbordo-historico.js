/**
 * Importa o histórico de transbordo (CD) da planilha "Base" do servidor antigo (stage-out) para o
 * COPEOPLE (tabela spx_transbordo_cd). Idempotente: rode quantas vezes quiser — TOs que já existem
 * (ex.: as que o ingest dos scripts já gravou, mais completas) nunca são sobrescritas.
 *
 * Uso:  node scripts/importar-transbordo-historico.js            (importa)
 *       node scripts/importar-transbordo-historico.js --dry-run  (só conta, não grava)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const { prisma } = require("../src/config/database");

const SPREADSHEET_ID = process.env.TRANSBORDO_HISTORICO_SHEET_ID || "1qLU_vNPbSROjhCIG-aI724c1NQWINght8L3B4fRVdlM";
const ABA = "Base";
const BLOCO = 15000; // linhas lidas por chamada
const LOTE = 1000; // linhas gravadas por INSERT
const DRY_RUN = process.argv.includes("--dry-run");

// A planilha grava o horário de Brasília (UTC-3, sem horário de verão) como "YYYY-MM-DD H:MM:SS".
function dtScanParaEpoch(str) {
  const m = String(str || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi, s) / 1000) + 3 * 3600;
}

const texto = (v, max) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

function linhaParaRegistro(r) {
  const toNumber = String(r[1] || "").trim();
  if (!toNumber) return null;
  const peso = parseFloat(String(r[4] || "0").replace(",", ".")) || 0;
  return {
    to_number: toNumber.slice(0, 60),
    pack_type_name: texto(r[2], 80),
    parcels: parseInt(r[3], 10) || 0,
    weight_g: Math.round(peso * 1000),
    loaded: texto(r[5], 150),
    unloaded: texto(r[6], 150),
    dock: texto(r[7], 80),
    operator: texto(r[8], 150),
    trip_number: texto(r[9], 80),
    vehicle_number: texto(r[10], 30),
    driver_name: texto(r[11], 150),
    abnormal_labels: r[12] ? String(r[12]).split("; ").map((x) => x.slice(0, 120)) : [],
    unloaded_ts: dtScanParaEpoch(r[0]),
  };
}

async function inserir(idEstacao, registros) {
  let novas = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = JSON.stringify(registros.slice(i, i + LOTE));
    const r = await prisma.$queryRaw`
      INSERT INTO spx_transbordo_cd (id_estacao, to_number, pack_type_name, parcels, weight_g, loaded_station_name, unloaded_station_name,
                                     dock_number, operator, trip_number, vehicle_number, driver_name, abnormal_labels, unloaded_at)
      SELECT ${idEstacao}::int, r.to_number, r.pack_type_name, COALESCE(r.parcels, 0), COALESCE(r.weight_g, 0), r.loaded, r.unloaded,
             r.dock, r.operator, r.trip_number, r.vehicle_number, r.driver_name, COALESCE(r.abnormal_labels, ARRAY[]::text[]),
             CASE WHEN r.unloaded_ts IS NOT NULL THEN to_timestamp(r.unloaded_ts) AT TIME ZONE 'UTC' END
      FROM jsonb_to_recordset(${lote}::jsonb) AS r(to_number text, pack_type_name text, parcels int, weight_g int, loaded text, unloaded text,
           dock text, operator text, trip_number text, vehicle_number text, driver_name text, abnormal_labels text[], unloaded_ts bigint)
      ON CONFLICT (id_estacao, to_number) DO NOTHING
      RETURNING 1 AS ok`;
    novas += r.length;
  }
  return novas;
}

(async () => {
  const estacoes = await prisma.estacao.findMany({ where: { spxStationId: { not: null } }, select: { idEstacao: true, nomeEstacao: true, spxStationId: true } });
  const porSpx = new Map(estacoes.map((e) => [String(e.spxStationId), e]));

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const lidas = new Map(); // idEstacao -> Map(to_number -> registro)  (a última linha de uma TO vale)
  let totalLinhas = 0;
  let semEstacao = 0;
  let semHorario = 0;

  for (let inicio = 2; ; inicio += BLOCO) {
    const range = `${ABA}!A${inicio}:N${inicio + BLOCO - 1}`;
    let linhas;
    try {
      linhas = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range })).data.values || [];
    } catch (e) {
      if (inicio > 2 && /exceeds grid limits|400/.test(e.message)) break; // passou do fim da aba
      throw e;
    }
    linhas.forEach((r) => {
      totalLinhas += 1;
      const est = porSpx.get(String(r[13] || ""));
      if (!est) return void (semEstacao += 1);
      const reg = linhaParaRegistro(r);
      if (!reg) return;
      if (!reg.unloaded_ts) semHorario += 1;
      if (!lidas.has(est.idEstacao)) lidas.set(est.idEstacao, new Map());
      lidas.get(est.idEstacao).set(reg.to_number, reg);
    });
    if (linhas.length < BLOCO) break;
  }

  console.log(`Planilha: ${totalLinhas} linhas lidas (${semEstacao} de estação desconhecida, ${semHorario} sem horário de scan)`);
  for (const [idEstacao, mapa] of lidas) {
    const est = estacoes.find((e) => e.idEstacao === idEstacao);
    const registros = [...mapa.values()];
    if (DRY_RUN) {
      console.log(`  [dry-run] estação ${idEstacao} (${est.nomeEstacao}, SPX ${est.spxStationId}): ${registros.length} TOs únicas seriam importadas`);
      continue;
    }
    const novas = await inserir(idEstacao, registros);
    console.log(`  estação ${idEstacao} (${est.nomeEstacao}, SPX ${est.spxStationId}): ${registros.length} TOs únicas na planilha, ${novas} novas importadas, ${registros.length - novas} já existiam`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
