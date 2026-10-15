const { prisma } = require("../../config/database");
const { getTurnoOperacionalAtual, instanteSP } = require("../../utils/turnoMapaOperacional");
const { LH_DESCARREGANDO, juntar, estacaoResumo, num } = require("./filaRecebimento.service");

/**
 * Veículos recebidos: um registro definitivo por viagem que chegou na estação. A fila do SPX esquece o veículo
 * quando ele finaliza, então guardamos aqui, de duas fontes:
 *  - a fila/viagens ao vivo (a cada ~60s): espera, doca, pacotes. O veículo vira "finalizado" quando some da fila
 *    por mais de FINALIZA_APOS_MIN minutos;
 *  - o histórico de viagens do SPX (a cada ~5 min): valores finais (descarregados, horário da descarga) e já
 *    cobre os últimos 7 dias na primeira vez. Viagem com trip_status 90 e chegada registrada = concluída.
 * Os dois entram pela mesma chave (estação + número da viagem) e se completam sem duplicar.
 */

const FINALIZA_APOS_MIN = 10;
const TRIP_CONCLUIDA = 90; // 100 = cancelada (nunca chegou)
const LOTE = 200;

const SQL_TS = (campo) => `CASE WHEN ${campo} > 0 THEN to_timestamp(${campo}) AT TIME ZONE 'UTC' END`;

/* ---------- 1) fila e viagens ao vivo ---------- */
async function registrarDaFila(idEstacao) {
  const [viagens, fila] = await Promise.all([prisma.spxTripLista.findUnique({ where: { idEstacao } }), prisma.spxQueueLista.findUnique({ where: { idEstacao } })]);
  const listaViagens = Array.isArray(viagens?.payload?.list) ? viagens.payload.list : [];
  const listaFila = Array.isArray(fila?.payload?.list) ? fila.payload.list : [];

  // Só vira "recebido" quem já chegou: entrou na fila do pátio ou já está descarregando (em trânsito ainda não).
  const linhas = juntar(listaViagens, listaFila)
    .filter((i) => i.fila || i.statusLh === LH_DESCARREGANDO)
    .map((i) => ({
      trip_number: String(i.tripNumber).slice(0, 80),
      placa: i.placa,
      tipo_veiculo: i.tipoVeiculo,
      motorista: i.motorista,
      agencia: i.agencia,
      origem: i.origem,
      trip_name: i.tripName,
      queue_number: i.fila?.numero ?? null,
      eta: i.etaSec || 0,
      chegou: i.chegouSec || 0,
      entrou: i.fila?.entrouSec || 0,
      espera: i.fila?.esperaMin || 0,
      pacotes_fila: i.pacotes || 0,
      carregados: i.detalhe.origem?.carregados || 0,
      descarregados: i.detalhe.destino?.descarregados || 0,
      doca_atribuida: i.fila?.docaAtribuida ?? null,
      doca_ocupada: i.fila?.docaOcupada ?? null,
      peso_g: i.detalhe.pesoG,
      composicao: i.detalhe.composicao,
      detalhe: { origem: i.detalhe.origem, destino: i.detalhe.destino, rotaPeso: i.detalhe.rotaPeso },
    }));

  for (let k = 0; k < linhas.length; k += LOTE) {
    const lote = JSON.stringify(linhas.slice(k, k + LOTE));
    await prisma.$executeRawUnsafe(
      `INSERT INTO spx_veiculo_recebido AS t (id_estacao, trip_number, placa, tipo_veiculo, motorista, agencia, origem, trip_name, queue_number,
          eta_em, chegou_em, entrou_fila_em, espera_max_min, pacotes_fila, carregados, descarregados, doca_atribuida, doca_ocupada,
          peso_g, composicao, detalhe, ultimo_visto_em, atualizado_em)
       SELECT $1::int, r.trip_number, r.placa, r.tipo_veiculo, r.motorista, r.agencia, r.origem, r.trip_name, r.queue_number,
          ${SQL_TS("r.eta")}, ${SQL_TS("r.chegou")}, ${SQL_TS("r.entrou")},
          COALESCE(r.espera, 0), COALESCE(r.pacotes_fila, 0), COALESCE(r.carregados, 0), COALESCE(r.descarregados, 0),
          NULLIF(r.doca_atribuida, ''), NULLIF(r.doca_ocupada, ''), r.peso_g, r.composicao, r.detalhe, now(), now()
       FROM jsonb_to_recordset($2::jsonb) AS r(trip_number text, placa text, tipo_veiculo text, motorista text, agencia text, origem text, trip_name text,
          queue_number text, eta bigint, chegou bigint, entrou bigint, espera int, pacotes_fila int, carregados int, descarregados int,
          doca_atribuida text, doca_ocupada text, peso_g int, composicao jsonb, detalhe jsonb)
       ON CONFLICT (id_estacao, trip_number) DO UPDATE SET
          placa = COALESCE(EXCLUDED.placa, t.placa), tipo_veiculo = COALESCE(EXCLUDED.tipo_veiculo, t.tipo_veiculo),
          motorista = COALESCE(EXCLUDED.motorista, t.motorista), agencia = COALESCE(EXCLUDED.agencia, t.agencia),
          origem = COALESCE(EXCLUDED.origem, t.origem), trip_name = COALESCE(EXCLUDED.trip_name, t.trip_name),
          queue_number = COALESCE(EXCLUDED.queue_number, t.queue_number),
          eta_em = COALESCE(EXCLUDED.eta_em, t.eta_em), chegou_em = COALESCE(t.chegou_em, EXCLUDED.chegou_em),
          entrou_fila_em = COALESCE(t.entrou_fila_em, EXCLUDED.entrou_fila_em),
          espera_max_min = GREATEST(t.espera_max_min, EXCLUDED.espera_max_min), pacotes_fila = GREATEST(t.pacotes_fila, EXCLUDED.pacotes_fila),
          carregados = GREATEST(t.carregados, EXCLUDED.carregados), descarregados = GREATEST(t.descarregados, EXCLUDED.descarregados),
          doca_atribuida = COALESCE(EXCLUDED.doca_atribuida, t.doca_atribuida), doca_ocupada = COALESCE(EXCLUDED.doca_ocupada, t.doca_ocupada),
          peso_g = COALESCE(EXCLUDED.peso_g, t.peso_g), composicao = COALESCE(EXCLUDED.composicao, t.composicao),
          detalhe = CASE WHEN t.trip_status = ${TRIP_CONCLUIDA} THEN t.detalhe ELSE COALESCE(EXCLUDED.detalhe, t.detalhe) END,
          finalizado_em = CASE WHEN t.trip_status = ${TRIP_CONCLUIDA} THEN t.finalizado_em ELSE NULL END,
          ultimo_visto_em = now(), atualizado_em = now()`,
      idEstacao,
      lote
    );
  }

  // Quem sumiu da fila há mais de FINALIZA_APOS_MIN minutos terminou: finaliza no último instante em que foi visto.
  await prisma.$executeRawUnsafe(
    `UPDATE spx_veiculo_recebido SET finalizado_em = ultimo_visto_em, atualizado_em = now()
      WHERE id_estacao = $1 AND finalizado_em IS NULL AND ultimo_visto_em < now() - interval '${FINALIZA_APOS_MIN} minutes'`,
    idEstacao
  );
  return { registrados: linhas.length };
}

/* ---------- 2) histórico de viagens do SPX ---------- */
const nomesDoca = (docas) => (Array.isArray(docas) ? docas.map((d) => d?.dock_name).filter(Boolean).join(", ") : "");

async function registrarDoHistorico(idEstacao, spxStationId, lista) {
  const linhas = [];
  (lista || []).forEach((p) => {
    const est = p?.trip_station || [];
    const dest = est[est.length - 1];
    // Só viagens que terminam nesta estação, concluídas e com chegada registrada (as canceladas têm ata zerada).
    if (!p?.trip_number || p.trip_status !== TRIP_CONCLUIDA || !dest || String(dest.station) !== String(spxStationId) || !(num(dest.ata) > 0)) return;
    const orig = est[0];
    linhas.push({
      trip_number: String(p.trip_number).slice(0, 80),
      placa: p.vehicle_number || null,
      tipo_veiculo: p.vehicle_type_name || null,
      motorista: p.driver_name || null,
      agencia: p.agency_name || null,
      origem: p.pre_station_name || orig?.station_name || null,
      trip_name: p.trip_name || null,
      eta: num(dest.eta),
      chegou: num(dest.ata),
      entrou: num(dest.add_into_queue_time),
      fim: num(dest.unloaded_time),
      carregados: num(orig?.load_quantity),
      descarregados: num(dest.unload_quantity),
      esperados: num(dest.expect_unload_quantity),
      doca: nomesDoca(dest.inbound_dock_infos) || null,
      finalizado: num(dest.unloaded_time) || num(dest.atd) || num(p.mtime),
      detalhe: { origem: estacaoResumo(orig), destino: estacaoResumo(dest) },
    });
  });

  for (let k = 0; k < linhas.length; k += LOTE) {
    const lote = JSON.stringify(linhas.slice(k, k + LOTE));
    await prisma.$executeRawUnsafe(
      `INSERT INTO spx_veiculo_recebido AS t (id_estacao, trip_number, placa, tipo_veiculo, motorista, agencia, origem, trip_name,
          eta_em, chegou_em, entrou_fila_em, descarga_fim_em, carregados, descarregados, esperados, doca_ocupada, detalhe,
          trip_status, finalizado_em)
       SELECT $1::int, r.trip_number, r.placa, r.tipo_veiculo, r.motorista, r.agencia, r.origem, r.trip_name,
          ${SQL_TS("r.eta")}, ${SQL_TS("r.chegou")}, ${SQL_TS("r.entrou")}, ${SQL_TS("r.fim")},
          COALESCE(r.carregados, 0), COALESCE(r.descarregados, 0), COALESCE(r.esperados, 0), r.doca, r.detalhe,
          ${TRIP_CONCLUIDA}, COALESCE(${SQL_TS("r.finalizado")}, now())
       FROM jsonb_to_recordset($2::jsonb) AS r(trip_number text, placa text, tipo_veiculo text, motorista text, agencia text, origem text, trip_name text,
          eta bigint, chegou bigint, entrou bigint, fim bigint, carregados int, descarregados int, esperados int, doca text, finalizado bigint, detalhe jsonb)
       ON CONFLICT (id_estacao, trip_number) DO UPDATE SET
          placa = COALESCE(EXCLUDED.placa, t.placa), tipo_veiculo = COALESCE(EXCLUDED.tipo_veiculo, t.tipo_veiculo),
          motorista = COALESCE(EXCLUDED.motorista, t.motorista), agencia = COALESCE(EXCLUDED.agencia, t.agencia),
          origem = COALESCE(EXCLUDED.origem, t.origem), trip_name = COALESCE(EXCLUDED.trip_name, t.trip_name),
          eta_em = COALESCE(EXCLUDED.eta_em, t.eta_em), chegou_em = COALESCE(EXCLUDED.chegou_em, t.chegou_em),
          entrou_fila_em = COALESCE(t.entrou_fila_em, EXCLUDED.entrou_fila_em), descarga_fim_em = COALESCE(EXCLUDED.descarga_fim_em, t.descarga_fim_em),
          carregados = GREATEST(t.carregados, EXCLUDED.carregados), descarregados = GREATEST(t.descarregados, EXCLUDED.descarregados),
          esperados = GREATEST(t.esperados, EXCLUDED.esperados), doca_ocupada = COALESCE(t.doca_ocupada, EXCLUDED.doca_ocupada),
          detalhe = EXCLUDED.detalhe, trip_status = ${TRIP_CONCLUIDA}, finalizado_em = EXCLUDED.finalizado_em, atualizado_em = now()
       WHERE t.trip_status IS DISTINCT FROM ${TRIP_CONCLUIDA}`,
      idEstacao,
      lote
    );
  }
  return { concluidas: linhas.length };
}

/* ---------- leitura ---------- */
function janelaDoDia(diaStr) {
  const [y, m, d] = diaStr.split("-").map(Number);
  return { inicio: instanteSP(y, m, d, 6), fim: instanteSP(y, m, d + 1, 6) };
}

const iso = (d) => (d ? d.toISOString() : null);
const minEntre = (a, b) => (a && b ? Math.max(0, Math.round((b - a) / 60000)) : null);

async function listar(idEstacao, diaQuery) {
  const atual = getTurnoOperacionalAtual();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaQuery || "") ? diaQuery : atual.diaOperacionalStr;
  const { inicio, fim } = janelaDoDia(dia);

  const linhas = await prisma.spxVeiculoRecebido.findMany({
    where: {
      idEstacao,
      finalizadoEm: { not: null },
      OR: [{ chegouEm: { gte: inicio, lt: fim } }, { chegouEm: null, primeiroVistoEm: { gte: inicio, lt: fim } }],
    },
    orderBy: [{ chegouEm: "desc" }, { primeiroVistoEm: "desc" }],
  });

  const lista = linhas.map((l) => {
    const saida = l.descargaFimEm || l.finalizadoEm;
    return {
      tripNumber: l.tripNumber,
      placa: l.placa,
      tipoVeiculo: l.tipoVeiculo,
      motorista: l.motorista,
      agencia: l.agencia,
      origem: l.origem,
      tripName: l.tripName,
      filaNumero: l.queueNumber,
      etaEm: iso(l.etaEm),
      chegouEm: iso(l.chegouEm || l.primeiroVistoEm),
      entrouFilaEm: iso(l.entrouFilaEm),
      descargaFimEm: iso(l.descargaFimEm),
      finalizadoEm: iso(l.finalizadoEm),
      esperaMaxMin: l.esperaMaxMin,
      pacotesFila: l.pacotesFila,
      carregados: l.carregados,
      descarregados: l.descarregados,
      esperados: l.esperados,
      docaAtribuida: l.docaAtribuida,
      docaOcupada: l.docaOcupada,
      pesoG: l.pesoG,
      composicao: l.composicao,
      detalhe: l.detalhe,
      tripStatus: l.tripStatus,
      tempoNaEstacaoMin: minEntre(l.chegouEm, saida),
    };
  });

  return { dia, diaOperacionalAtual: atual.diaOperacionalStr, lista };
}

module.exports = { registrarDaFila, registrarDoHistorico, listar };
