const { google } = require("googleapis");

/* =====================================================
   Leitura ao vivo da aba "Dock Management" (mesma planilha de
   Workstation) — status físico das docas (sistema de pátio).
   Colunas confirmadas contra dado real:
   dock_id, dock_no, dock_name, dock_type, dock_status,
   occupied_vehicle_number, occupation_time, waiting_truck_num,
   dock_active_status, area_id, area_name, occupied_queue_number,
   change_by_camera_status, paused_time, release_check_cctv_status,
   occupy_need_check_cctv_status, idle_time, dock_group_id,
   dock_group_name, dock_group_type, scan_delivery_task,
   corridor_cage, occupied_driver_id, occupied_driver_name

   O número da doca vem do fim de dock_name (ex: "Doca Inbound LH 85"
   -> 85) — o texto "Inbound"/"Outbound" aí é só a nomenclatura física
   do WMS/pátio, não a operação que o COPEOPLE usa (essa vem da
   alocação de equipe, lida do banco, não da planilha).
===================================================== */

const WORKSTATION_SPREADSHEET_ID = "1T3zq6DtiF--pZjeYFzSo9i-EDEBXIN0yx8VcxsMcXZY";
const SHEET_DOCK_MANAGEMENT = "Dock Management";
const CACHE_TTL = 20 * 1000;

let cache = null;
let cacheTs = null;

function isCacheValid() {
  return cache && cacheTs && Date.now() - cacheTs < CACHE_TTL;
}

function limparCache() {
  cache = null;
  cacheTs = null;
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

function formatDuracao(segundos) {
  const s = Number(segundos) || 0;
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  return `${String(horas).padStart(2, "0")}h${String(minutos).padStart(2, "0")}`;
}

/**
 * Lê a aba e devolve um Map número-da-doca -> status físico.
 * dock_status: "1" = ocupada (caminhão físico presente agora), "2" = livre.
 */
async function getStatusDocas() {
  if (isCacheValid()) return cache;

  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: WORKSTATION_SPREADSHEET_ID,
    range: `${SHEET_DOCK_MANAGEMENT}!A:X`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = res.data.values || [];
  const mapa = new Map();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const nome = row[2];
    if (!nome) continue;
    const match = String(nome).match(/(\d+)\s*$/);
    if (!match) continue;
    const numero = Number(match[1]);

    mapa.set(numero, {
      numero,
      nomeSheet: nome,
      fisicamenteOcupada: row[4] === "1",
      placa: row[5] || null,
      duracaoSegundos: Number(row[6]) || 0,
      duracao: formatDuracao(row[6]),
      // idle_time: segundos desde que o último veículo saiu; waiting_truck_num: caminhões na fila da doca
      ociosaSegundos: Number(row[16]) || 0,
      caminhoesAguardando: Number(row[7]) || 0,
      motorista: row[23] || null,
    });
  }

  cache = mapa;
  cacheTs = Date.now();
  return mapa;
}

module.exports = { getStatusDocas, limparCache };
