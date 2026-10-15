/**
 * Junta as duas fotos que os userscripts do SPX mandam: as viagens a caminho/descarregando (fonte principal) e a
 * fila do pátio (docas e tempos de espera). Viagem que só aparece na fila entra como complemento.
 * Usado pela tela da Fila de veículos e pela captura dos Veículos recebidos.
 */

const LH_TRANSITO = 50;
const LH_DESCARREGANDO = 60;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const txt = (v) => (v === undefined || v === null || v === "" ? null : String(v));

// Chave da fila: alguns itens chegaram mas ainda não têm LH vinculado, então usa o número da fila no lugar.
const chaveDaFila = (q) => q?.route_info?.lh_trip_number || q?.queue_number || null;

// Estação destino (a que está em trânsito/descarregando); sem ela, a última da rota.
const estacaoDestino = (estacoes) =>
  estacoes.find((s) => s.trip_station_status === LH_TRANSITO || s.trip_station_status === LH_DESCARREGANDO) || estacoes[estacoes.length - 1] || null;

function estacaoResumo(s) {
  if (!s) return null;
  return {
    nome: txt(s.station_name),
    ata: num(s.ata) || null,
    atd: num(s.atd) || null,
    status: s.trip_station_status ?? null,
    carregados: num(s.load_quantity),
    descarregados: num(s.unload_quantity),
    inicioCarga: num(s.loading_time) || null,
    fimCarga: num(s.loaded_time) || null,
    lacrado: num(s.seal_time) || null,
  };
}

function montarItem(trip, q) {
  const det = q?._trip_detail || {};
  const estacoes = (trip.trip_station?.length ? trip.trip_station : det.trip_station) || [];
  const dest = estacaoDestino(estacoes);
  const origemEst = estacoes.find((s) => s.sequence_number === 1) || estacoes[0] || null;
  const ultima = estacoes[estacoes.length - 1] || null;
  const peso = det.trip_weight_detail?.[0];
  const breakdown = det.to_breakdown || null;

  return {
    tripNumber: trip.trip_number,
    placa: txt(trip.vehicle_number),
    tipoVeiculo: txt(trip.vehicle_type_name) || txt(det.vehicle_type_name),
    motorista: txt(trip.driver_name),
    agencia: txt(trip.agency_name) || txt(det.agency_name),
    origem: txt(trip.pre_station_name) || txt(origemEst?.station_name),
    tripName: txt(trip.trip_name),
    // Pacotes pendentes de descarga: a viagem informa o que ainda está a bordo (order_loaded_quantity, cai conforme as TOs
    // são descarregadas). A fila só tem o número enquanto o veículo
    // está nela e some quando ele entra na doca, então vale como segunda opção.
    pacotes: num(trip.order_loaded_quantity) || num(q?.order_quantity) || num(trip.order_inbound_quantity),
    etaSec: num(dest?.eta) || null,
    chegouSec: num(dest?.ata) || null,
    statusLh: dest?.trip_station_status ?? null,
    somenteFila: !!trip._fromQueue,
    fila: q
      ? {
          numero: txt(q.queue_number),
          status: q.queue_status ?? null,
          esperaMin: num(q.waiting_time),
          emEsperaDesdeSec: num(q.on_hold_time) || null,
          entrouSec: num(q.add_to_queue_time) || null,
          pacotes: num(q.order_quantity),
          docaAtribuida: txt(q.assigned_dock_name),
          docaOcupada: txt(q.occupied_dock_name),
        }
      : null,
    detalhe: {
      origem: estacaoResumo(origemEst),
      destino: estacaoResumo(ultima),
      pesoG: num(peso?.actual_weight) || null,
      rotaPeso: peso ? `${peso.origin_station_name} → ${peso.destination_station_name}` : null,
      composicao: breakdown ? { total: num(breakdown.total), porTipo: breakdown.byType || {} } : null,
    },
  };
}

function juntar(viagens, fila) {
  const filaPorChave = new Map();
  fila.forEach((q) => {
    const k = chaveDaFila(q);
    if (k) filaPorChave.set(k, q);
  });

  const itens = viagens.filter((t) => t?.trip_number).map((t) => montarItem(t, filaPorChave.get(t.trip_number)));
  const jaTem = new Set(itens.map((i) => i.tripNumber));

  // Na fila mas fora da lista de viagens: entra como complemento (os dados da rota vêm do detalhe da fila).
  fila.forEach((q) => {
    const k = chaveDaFila(q);
    if (!k || jaTem.has(k)) return;
    const det = q._trip_detail;
    itens.push(
      montarItem(
        {
          trip_number: k,
          vehicle_number: q.route_info?.vehicle_number || q.vehicle_number,
          driver_name: q.route_info?.driver_name || q.driver_name,
          vehicle_type_name: det?.vehicle_type_name || q.route_info?.vehicle_type_name || q.vehicle_type_name,
          pre_station_name: det?.pre_station_name || q.route_info?.pre_station_name || q.pre_station_name,
          agency_name: q.route_info?.agency_name || q.agency_name,
          trip_name: q.route_info?.lh_trip_name,
          trip_station: det?.trip_station || null,
          _fromQueue: true,
        },
        q
      )
    );
    jaTem.add(k);
  });
  return itens;
}

module.exports = { LH_TRANSITO, LH_DESCARREGANDO, num, txt, estacaoResumo, juntar, montarItem };
