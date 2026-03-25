/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * items: lista de novidades exibidas no modal.
 */
const CHANGELOG = {
  version: "1.5.0",
  titulo: "Novidades desta atualização",
  items: [
    "Dashboard de Faltas: KPIs, tendência mensal, distribuições e análise por colaborador.",
    "Ajustes de UI/UX nos dashboards de Atestados e Desligamentos para padrão unificado.",
    "Dashboard de Atestados: histograma de atestados por tempo de casa do colaborador.",
    "Dashboard de Atestados: tabela de distribuição de CID com descrição e percentual.",
    "Dashboard de Atestados: gráfico de atestados por BPO agrupado por tempo de casa.",
    "Dashboard Admin: histograma de faltas por tempo de casa adicionado.",
    "Correção: atestado médico de múltiplos dias não sobrepõe mais os dias de DSR.",
    "Correção: exibição do atestado não avançava para o dia anterior por diferença de fuso horário.",
  ],
};

export default CHANGELOG;
