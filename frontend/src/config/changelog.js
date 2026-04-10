const CHANGELOG = {
  version: "1.11.0",
  titulo: "Segurança e Isolamento de Dados por Estação",
  categorias: [
    {
      nome: "Segurança",
      itens: [
        "Token JWT agora inclui idEstacao no payload — identificação de estação disponível diretamente no token",
        "Listagem de usuários filtrada por estação — perfis não-Admin visualizam apenas usuários da própria estação",
        "Frequências: GET por ID, update e delete agora verificam se o colaborador pertence à estação do usuário antes de operar",
        "Atestados: rotas de update, finalizar e cancelar agora exigem autenticação e verificam isolamento por estação",
        "Rotas de atestados que estavam sem proteção receberam authenticate e injectDbContext",
        "injectDbContext adicionado em todas as rotas de frequência para garantir contexto de estação consistente",
      ],
    },
    {
      nome: "Novo",
      itens: [
        "Turnos, Cargos, Escalas e Empresas agora possuem idEstacao — cada registro pertence a uma estação específica",
        "Admin visualiza todos os registros com identificação discreta da estação de origem em cada card",
        "Alta Gestão e demais perfis visualizam apenas os registros da própria estação",
        "Ao criar Turno, Cargo, Escala ou Empresa, o registro recebe automaticamente a assinatura da estação do usuário",
        "Admin sem estação selecionada pode escolher a estação destino diretamente no modal de criação",
      ],
    },
    {
      nome: "Permissões",
      itens: [
        "Cargos: apenas Admin pode editar/excluir cargos globais; usuários da estação podem editar/excluir apenas cargos assinados pela própria estação",
        "Turnos: mesma regra de assinatura de estação aplicada para edição e exclusão",
        "Escalas: mesma regra de assinatura de estação aplicada para edição e exclusão",
        "Empresas: mesma regra de assinatura de estação aplicada para edição e exclusão",
        "Estações: criação, edição e exclusão restritas exclusivamente ao perfil Admin",
        "Regionais: edição e exclusão restritas exclusivamente ao perfil Admin",
        "Proteção aplicada em dupla camada — backend retorna 403 e frontend oculta os botões de ação",
      ],
    },
    {
      nome: "Correções",
      itens: [
        "Modais (Cargo, Turno, Escala, Empresa, Setor, Regional, Estação) corrigidos no Light Mode — títulos e botões agora respeitam o tema",
        "Botão Cancelar nos modais corrigido para usar as variáveis CSS do tema em vez de classes Tailwind hardcoded",
      ],
    },
  ],
};

export default CHANGELOG;
