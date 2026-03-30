/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * categorias: agrupa as mudanças por tipo (Novidade, Melhoria, Correção).
 */
const CHANGELOG = {
  version: "1.7.4",
  titulo: "Novidades desta atualização",
  categorias: [
    {
      tipo: "Correção",
      itens: [
        "Gestão Operacional T3: faixa de horas corrigida para exibir 22-23, 23-00, 00-01... 05-06 na ordem correta.",
      ],
    },
    {
      tipo: "Melhoria",
      itens: [
        "Produção hora x hora agora é salva em tempo real a cada 5 minutos junto com o salvamento por colaborador.",
        "Histórico de atestados com datas, dias de afastamento, CID e status.",
        "Histórico de faltas com data de cada ocorrência e indicativo de medida disciplinar aplicada.",
        "Botão de exportar CSV na Tela de faltantes (disponível para administradores).",
      ],
    },
  ],
};

export default CHANGELOG;
