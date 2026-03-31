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
      tipo: "Novidade",
      itens: [
        "Cancelamento de treinamentos: botão disponível nos detalhes do treinamento com modal de motivo obrigatório. Apenas quem criou o treinamento ou ADMIN pode cancelar.",
        "Cancelamento de acidentes: botão disponível diretamente no card da listagem com modal de motivo obrigatório. Apenas quem registrou o acidente ou ADMIN pode cancelar.",
        "Card de 'Cancelados' na tela de treinamentos exibindo total e percentual.",
        "Filtros por líder e por período (data início / data fim) na listagem de treinamentos.",
      ],
    },
    {
      tipo: "Melhoria",
      itens: [
        "Badge 'Cancelado' em vermelho na listagem de treinamentos.",
        "Status 'Cancelado' exibido nos detalhes do treinamento.",
        "Acidentes cancelados exibem badge 'Cancelado' no card em vez do botão de ação.",
      ],
    },
  ],
};

export default CHANGELOG;
