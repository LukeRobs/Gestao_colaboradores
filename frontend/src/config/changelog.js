/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * items: lista de novidades exibidas no modal.
 */
const CHANGELOG = {
  version: "1.3.0",
  titulo: "Novidades desta atualização",
  items: [
    "Dashboard de Faltas.",
    "Correção: atestado médico de múltiplos dias não sobrepõe mais os dias de DSR.",
    "Correção: exibição do atestado não avançava para o dia anterior por diferença de fuso horário.",
    "Dashboard de Atestados: novo gráfico de atestados por BPO agrupado por tempo de casa do colaborador.",
  ],
};

export default CHANGELOG;
