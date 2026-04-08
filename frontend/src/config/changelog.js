const CHANGELOG = {
  version: "1.9.2",
  titulo: "Novidades do Sistema",
  categorias: [
    {
      nome: "Escalas",
      icone: "🗓️",
      itens: [
        "Novo campo 'Dias de DSR' no cadastro de escalas — agora é possível configurar os dias de folga diretamente no modal de escala",
        "Geração de DSR estendida para todas as escalas com base nos dias configurados",
      ],
    },
    {
      nome: "Treinamentos",
      icone: "📚",
      itens: [
        "Download de documentos de treinamento agora disponível na tela de detalhes",
      ],
    },
    {
      nome: "Perfil do Colaborador",
      icone: "👤",
      itens: [
        "Redesign completo da tela de perfil com nova interface",
        "Correção no carregamento ao editar escala e horário",
      ],
    },
    {
      nome: "Correções",
      icone: "🔧",
      itens: [
        "Nome completo corrigido na tela de Folga Dominical",
        "Validação de domínio @shopee.com e estação obrigatória no cadastro de usuário",
      ],
    },
    {
      nome: "Controle de Presença",
      icone: "📋",
      itens: [
        "Botão 'Exportar Sheets' agora visível apenas para Admin e Alta Gestão",
        "Demais cargos passam a ter botão 'Exportar CSV' para baixar o controle localmente",
        "Novo botão 'Apagar registro' no modal de edição — disponível apenas para Admin quando há registro no banco",
        "Correção: exportação para Google Sheets agora respeita DSR — atestados médicos (AM) não sobrescrevem mais dias de folga da escala",
      ],
    },
  ],
};

export default CHANGELOG;
