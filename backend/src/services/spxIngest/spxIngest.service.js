const { prisma } = require("../../config/database");
const veiculosRecebidos = require("./veiculosRecebidos.service");

/** Dados que os userscripts do SPX enviam ao COPEOPLE: TOs de transbordo (CD) e viagens. */

const MODULO = { TRANSBORDO: "TRANSBORDO", TRIP_LIST: "TRIP_LIST", TRIP_HISTORY: "TRIP_HISTORY", QUEUE_LIST: "QUEUE_LIST" };
const MAX_ITENS = 5000;

/* ---------- estação do SPX -> estação do COPEOPLE ---------- */
let cacheEstacoes = { em: 0, mapa: new Map() };
async function estacaoDoSpx(spxStationId) {
  if (Date.now() - cacheEstacoes.em > 60 * 1000) {
    const estacoes = await prisma.estacao.findMany({ where: { spxStationId: { not: null } }, select: { idEstacao: true, spxStationId: true } });
    cacheEstacoes = { em: Date.now(), mapa: new Map(estacoes.map((e) => [e.spxStationId, e.idEstacao])) };
  }
  const n = Number(spxStationId);
  return Number.isInteger(n) ? cacheEstacoes.mapa.get(n) ?? null : null;
}

/* ---------- normalização ---------- */
const texto = (v, max) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
};
const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

function normalizarTo(t) {
  if (!t || !t.to_number) return null;
  const ts = Number(t.unloaded_time);
  const tripId = Number(t.trip_id);
  return {
    to_number: String(t.to_number).trim().slice(0, 60),
    pack_type_name: texto(t.pack_type_name, 80),
    parcels: inteiro(t.to_parcel_quantity ?? t.parcels),
    weight_g: inteiro(t.to_weight),
    loaded: texto(t.loaded_station_name, 150),
    unloaded: texto(t.unloaded_station_name, 150),
    dock: texto(t.dock_number, 80),
    operator: texto(t.operator, 150),
    trip_id: Number.isFinite(tripId) && tripId > 0 ? tripId : null,
    trip_number: texto(t.trip_number, 80),
    vehicle_number: texto(t.vehicle_number, 30),
    driver_name: texto(t.driver_name, 150),
    abnormal_labels: Array.isArray(t.abnormal_labels) ? t.abnormal_labels.map((x) => String(x).slice(0, 120)) : [],
    unloaded_ts: Number.isFinite(ts) && ts > 0 ? Math.round(ts) : null,
  };
}

async function registrarStatus(idEstacao, modulo, fetchedAt, total) {
  const f = Number(fetchedAt);
  const quando = Number.isFinite(f) && f > 0 ? BigInt(Math.round(f)) : BigInt(Date.now());
  await prisma.$executeRaw`
    INSERT INTO spx_ingest_status (id_estacao, modulo, ultimo_fetched_at, ultimo_recebimento, ultimo_total)
    VALUES (${idEstacao}, ${modulo}, ${quando}, now(), ${total})
    ON CONFLICT (id_estacao, modulo) DO UPDATE
      SET ultimo_fetched_at = EXCLUDED.ultimo_fetched_at, ultimo_recebimento = now(), ultimo_total = EXCLUDED.ultimo_total`;
}

/* ---------- Transbordo CD ---------- */
async function receberTransbordo(idEstacao, lista, fetchedAt) {
  const porTo = new Map();
  (lista || []).slice(0, MAX_ITENS).forEach((t) => {
    const n = normalizarTo(t);
    if (n) porTo.set(n.to_number, n); // a última ocorrência vale
  });
  const linhas = [...porTo.values()];
  let novas = 0;

  for (let i = 0; i < linhas.length; i += 500) {
    const lote = JSON.stringify(linhas.slice(i, i + 500));
    const r = await prisma.$queryRaw`
      INSERT INTO spx_transbordo_cd (id_estacao, to_number, pack_type_name, parcels, weight_g, loaded_station_name, unloaded_station_name,
                                     dock_number, operator, trip_id, trip_number, vehicle_number, driver_name, abnormal_labels, unloaded_at)
      SELECT ${idEstacao}::int, r.to_number, r.pack_type_name, COALESCE(r.parcels, 0), COALESCE(r.weight_g, 0), r.loaded, r.unloaded,
             r.dock, r.operator, r.trip_id, r.trip_number, r.vehicle_number, r.driver_name, COALESCE(r.abnormal_labels, ARRAY[]::text[]),
             CASE WHEN r.unloaded_ts IS NOT NULL THEN to_timestamp(r.unloaded_ts) AT TIME ZONE 'UTC' END
      FROM jsonb_to_recordset(${lote}::jsonb) AS r(to_number text, pack_type_name text, parcels int, weight_g int, loaded text, unloaded text,
           dock text, operator text, trip_id bigint, trip_number text, vehicle_number text, driver_name text, abnormal_labels text[], unloaded_ts bigint)
      ON CONFLICT (id_estacao, to_number) DO UPDATE SET
        pack_type_name = EXCLUDED.pack_type_name, parcels = EXCLUDED.parcels, weight_g = EXCLUDED.weight_g,
        loaded_station_name = EXCLUDED.loaded_station_name, unloaded_station_name = EXCLUDED.unloaded_station_name,
        dock_number = EXCLUDED.dock_number, operator = EXCLUDED.operator,
        trip_id = COALESCE(EXCLUDED.trip_id, spx_transbordo_cd.trip_id), trip_number = EXCLUDED.trip_number,
        vehicle_number = EXCLUDED.vehicle_number, driver_name = EXCLUDED.driver_name, abnormal_labels = EXCLUDED.abnormal_labels,
        unloaded_at = COALESCE(EXCLUDED.unloaded_at, spx_transbordo_cd.unloaded_at), updated_at = now()
      RETURNING (xmax = 0) AS inserida`;
    novas += r.filter((x) => x.inserida).length;
  }

  await registrarStatus(idEstacao, MODULO.TRANSBORDO, fetchedAt, linhas.length);
  return { recebidas: linhas.length, novas };
}

/* ---------- Viagens em trânsito (foto única, substituída) ---------- */
async function receberTripList(idEstacao, corpo) {
  const total = Array.isArray(corpo.list) ? corpo.list.length : 0;
  const f = Number(corpo.fetchedAt);
  const fetchedAt = Number.isFinite(f) && f > 0 ? BigInt(Math.round(f)) : BigInt(Date.now());
  const payload = { list: (corpo.list || []).slice(0, MAX_ITENS), total: corpo.total ?? total, fetchedAt: Number(fetchedAt), station_id: corpo.station_id };
  await prisma.spxTripLista.upsert({
    where: { idEstacao },
    create: { idEstacao, payload, fetchedAt },
    update: { payload, fetchedAt, recebidoEm: new Date() },
  });
  await registrarStatus(idEstacao, MODULO.TRIP_LIST, fetchedAt, total);
  return { total };
}

/* ---------- Fila de veículos / Queue List (foto única, substituída) ---------- */
const MAX_FILA = 1000;

async function receberQueueList(idEstacao, corpo) {
  const lista = (corpo.list || []).slice(0, MAX_FILA);
  const f = Number(corpo.fetchedAt);
  const fetchedAt = Number.isFinite(f) && f > 0 ? BigInt(Math.round(f)) : BigInt(Date.now());
  const payload = {
    list: lista,
    total: corpo.total ?? lista.length,
    pending_total: corpo.pending_total ?? 0,
    assigned_total: corpo.assigned_total ?? 0,
    on_hold_total: corpo.on_hold_total ?? 0,
    occupied_total: corpo.occupied_total ?? 0,
    fetchedAt: Number(fetchedAt),
    station_id: corpo.station_id,
  };
  await prisma.spxQueueLista.upsert({
    where: { idEstacao },
    create: { idEstacao, payload, fetchedAt },
    update: { payload, fetchedAt, recebidoEm: new Date() },
  });
  await registrarStatus(idEstacao, MODULO.QUEUE_LIST, fetchedAt, lista.length);
  // Guarda o histórico dos veículos recebidos; se falhar, a fila ao vivo continua funcionando.
  await veiculosRecebidos.registrarDaFila(idEstacao).catch((e) => console.error("❌ [SPX-INGEST] veículos recebidos (fila):", e.message));
  return { total: lista.length };
}

/* ---------- Histórico de viagens (acumula por trip_number) ---------- */
async function receberTripHistory(idEstacao, corpo) {
  const porTrip = new Map();
  (corpo.list || []).slice(0, MAX_ITENS).forEach((t) => {
    if (t && t.trip_number) porTrip.set(String(t.trip_number).slice(0, 80), t);
  });
  const viagens = [...porTrip.entries()];

  for (let i = 0; i < viagens.length; i += 200) {
    const lote = JSON.stringify(viagens.slice(i, i + 200).map(([trip_number, payload]) => ({ trip_number, payload })));
    await prisma.$executeRaw`
      INSERT INTO spx_trip_historico (id_estacao, trip_number, payload, atualizado_em)
      SELECT ${idEstacao}::int, r.trip_number, r.payload, now()
      FROM jsonb_to_recordset(${lote}::jsonb) AS r(trip_number text, payload jsonb)
      ON CONFLICT (id_estacao, trip_number) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = now()`;
  }
  // O histórico só interessa pelos últimos 7 dias: o que não aparece mais há 8 dias sai.
  await prisma.$executeRaw`DELETE FROM spx_trip_historico WHERE id_estacao = ${idEstacao} AND atualizado_em < now() - interval '8 days'`;

  await registrarStatus(idEstacao, MODULO.TRIP_HISTORY, corpo.fetchedAt, viagens.length);
  await veiculosRecebidos.registrarDoHistorico(idEstacao, corpo.station_id, corpo.list).catch((e) => console.error("❌ [SPX-INGEST] veículos recebidos (histórico):", e.message));
  return { total: await prisma.spxTripHistorico.count({ where: { idEstacao } }) };
}

/* ---------- leitura (os próprios scripts consultam as viagens) ---------- */
async function lerTripList(idEstacao) {
  const linha = await prisma.spxTripLista.findUnique({ where: { idEstacao } });
  if (!linha) return { list: [], fetchedAt: null };
  return { ...linha.payload, fetchedAt: linha.fetchedAt === null ? null : Number(linha.fetchedAt) };
}

async function lerTripHistory(idEstacao) {
  const [linhas, status] = await Promise.all([
    prisma.spxTripHistorico.findMany({ where: { idEstacao }, select: { payload: true } }),
    prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.TRIP_HISTORY } } }),
  ]);
  return { list: linhas.map((l) => l.payload), fetchedAt: status?.ultimoFetchedAt == null ? null : Number(status.ultimoFetchedAt) };
}

module.exports = { MODULO, estacaoDoSpx, receberTransbordo, receberTripList, receberQueueList, receberTripHistory, lerTripList, lerTripHistory };
