/**
 * Job: Detectar Faltas Automáticas (Backfill Manual)
 *
 * A detecção em tempo real já ocorre automaticamente no controller de
 * frequência (create/update) e no ajuste manual de ponto.
 *
 * Este módulo expõe apenas a função de backfill para reprocessar
 * períodos históricos manualmente via endpoint administrativo.
 */

const { detectarFaltasAutomatico } = require("../services/detectarFaltasAutomatico.service");

module.exports = { detectarFaltasAutomatico };
