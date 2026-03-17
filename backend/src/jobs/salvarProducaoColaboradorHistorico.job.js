/**
 * O salvamento de produção por colaborador é disparado pelo frontend
 * via POST /dashboard/produtividade-colaborador/trigger-salvamento
 * quando o timer de sync (5 minutos) zera na tela.
 *
 * Este arquivo existe apenas para manter a exportação compatível com server.js.
 */
function iniciarJobsProducaoColaborador() {
  console.log("ℹ️ [JOBS COLAB] Salvamento controlado pelo frontend via trigger — cron desativado.");
}

module.exports = { iniciarJobsProducaoColaborador };
