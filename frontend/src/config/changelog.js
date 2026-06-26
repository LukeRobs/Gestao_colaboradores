const CHANGELOG = {
  version: "1.16.0",
  titulo: "Absenteísmo Corrigido, Controle de Presença e Diversas Correções Operacionais",
  categorias: [
    {
      nome: "Dashboard de Absenteísmo",
      itens: [
        "Corrigido: dias de atestado médico e atestado de acompanhamento não são mais contados como 'Falta' — agora aparecem corretamente como 'Atestado', em todos os gráficos, KPIs e na tabela de colaboradores",
        "Nova seção de Faltas com cross-filtering entre gráficos, KPIs de Medida Disciplinar e tabela analítica com paginação e ordenação",
        "Todos os turnos voltam a ser exibidos, com contagem de ausências e atestados alinhada ao dashboard operacional",
        "Colaboradores desligados após o período voltam a entrar corretamente no cálculo",
        "Gráfico de tendência passa a considerar todos os dias cobertos por um atestado, não só o dia de início",
      ],
    },
    {
      nome: "Dashboard Operacional",
      itens: [
        "Status do dia (presente, falta, atestado) corrigido para diversos cenários: colaborador desligado no próprio dia, desligado após a data de referência, atestado sem registro de ponto e prioridade de atestado sobre hora batida",
        "Headcount Operacional Escalado agora considera todos os colaboradores ativos elegíveis, não só quem tem ponto lançado",
        "Suporte a acumulado de múltiplos dias no dashboard",
        "Corrigida contagem em dobro entre atestados e faltas nos KPIs",
      ],
    },
    {
      nome: "Controle de Presença",
      itens: [
        "Status 'Suspensão' e 'Folga' não exigem mais justificativa manual",
        "Desligamento e afastamento agora preenchem automaticamente o status do dia (DP/DV/DF/AFA); desligados ficam visíveis na grade até o fim do mês",
        "Férias e afastamento em andamento aparecem corretamente na grade e na exportação",
        "Dias antes da admissão exibem 'Não Contratado' automaticamente; novo botão 'Preencher NC' faz isso em massa para admissões do mês atual",
        "Corrigida tela de ajuste de presença, que estava travando ao abrir",
        "Excluir um registro de frequência agora atualiza a tela automaticamente",
      ],
    },
    {
      nome: "Daily Works (Diaristas)",
      itens: [
        "Nova modalidade Diarias TECH adicionada ao módulo",
        "Suporte a novos turnos sem precisar alterar código",
        "Exportação CSV e paginação com seletor de itens por página",
        "Planejado e Real corrigidos para refletir a estação e o turno corretos",
      ],
    },
    {
      nome: "Escalas",
      itens: [
        "Perfil Alta Gestão agora pode editar escalas",
        "Histórico de escala passa a suportar múltiplas trocas no mesmo dia",
      ],
    },
    {
      nome: "Colaboradores",
      itens: [
        "Filtro por setor e exportação CSV respeitando os filtros ativos",
      ],
    },
    {
      nome: "Integrações",
      itens: [
        "Relatório operacional do Seatalk agora é enviado para o grupo configurado por estação, com aviso claro quando não há grupo configurado",
        "Exportação para Google Sheets passa a incluir colaboradores inativos e afastados do mês",
        "Corrigido erro de upload de evidências causado por espaços nas credenciais de armazenamento",
      ],
    },
    {
      nome: "Outras Melhorias",
      itens: [
        "Gráficos de Desligamentos em barras horizontais, com detalhamento paginado e buscável",
        "Treinamentos exibem setor e turno dos participantes na ATA",
        "Meta de produtividade da Gestão Operacional agora é dinâmica",
      ],
    },
  ],
};

export default CHANGELOG;
