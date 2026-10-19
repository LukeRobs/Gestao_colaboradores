const svc = require("../services/spxIngest/spxIngest.service");

/** Endpoints chamados pelos userscripts do Tampermonkey (ver spxIngestAuth). Respostas no mesmo formato do servidor antigo. */

async function resolverEstacao(req, res, origem) {
  const spx = origem === "query" ? req.query.station : req.body?.station_id;
  const idEstacao = await svc.estacaoDoSpx(spx);
  if (!idEstacao) {
    res.status(400).json({ ok: false, error: `station_id desconhecido: ${spx ?? "(vazio)"}` });
    return null;
  }
  return idEstacao;
}

const enviar = (handler, nome) => async (req, res) => {
  try {
    const idEstacao = await resolverEstacao(req, res, "body");
    if (!idEstacao) return;
    if (!req.body || typeof req.body !== "object" || (req.body.list !== undefined && !Array.isArray(req.body.list))) {
      return res.status(400).json({ ok: false, error: "Payload inválido (esperado { list: [] })" });
    }
    const r = await handler(idEstacao, req.body);
    return res.json({ ok: true, ...r });
  } catch (err) {
    console.error(`❌ [SPX-INGEST] ${nome}:`, err.message);
    return res.status(500).json({ ok: false, error: "Erro ao gravar" });
  }
};

const ler = (leitor, nome) => async (req, res) => {
  try {
    const idEstacao = await resolverEstacao(req, res, "query");
    if (!idEstacao) return;
    res.set("Cache-Control", "no-cache");
    return res.json(await leitor(idEstacao));
  } catch (err) {
    console.error(`❌ [SPX-INGEST] ${nome}:`, err.message);
    return res.status(500).json({ ok: false, error: "Erro ao ler" });
  }
};

exports.receberTransbordo = enviar((id, corpo) => svc.receberTransbordo(id, corpo.list, corpo.fetchedAt), "transbordo-cd");
exports.receberTripList = enviar((id, corpo) => svc.receberTripList(id, corpo), "trip-list");
exports.receberQueueList = enviar((id, corpo) => svc.receberQueueList(id, corpo), "queue-list");
exports.receberStageIn = enviar((id, corpo) => svc.receberStageIn(id, corpo), "stage-in");
exports.receberTripHistory =enviar((id, corpo) => svc.receberTripHistory(id, corpo), "trip-history");
exports.lerTripList = ler(svc.lerTripList, "ler trip-list");
exports.lerTripHistory = ler(svc.lerTripHistory, "ler trip-history");
