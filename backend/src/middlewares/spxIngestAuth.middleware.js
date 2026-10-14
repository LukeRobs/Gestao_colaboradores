const crypto = require("crypto");

/**
 * Autenticação dos userscripts do Tampermonkey (máquinas sem login de usuário): token compartilhado
 * no cabeçalho X-Ingest-Token, comparado em tempo constante. Sem SPX_INGEST_TOKEN no servidor a
 * ingestão fica desligada (nunca aceita sem token).
 */
module.exports = function spxIngestAuth(req, res, next) {
  const esperado = process.env.SPX_INGEST_TOKEN;
  if (!esperado) {
    return res.status(503).json({ ok: false, error: "Ingestão SPX não configurada no servidor" });
  }
  const enviado = Buffer.from(String(req.get("x-ingest-token") || ""));
  const correto = Buffer.from(esperado);
  if (enviado.length !== correto.length || !crypto.timingSafeEqual(enviado, correto)) {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
  next();
};
