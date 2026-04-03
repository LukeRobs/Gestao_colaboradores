const CHANGELOG = {
  version: "1.7.5",
  titulo: "Novidades do Sistema",
  categorias: [
    {
      nome: "Dashboard de Internalização",
      icone: "👥",
      itens: [
        "Card '+90 dias · Sem Falta · Sem Medida' exibe colaboradores com exatamente 1 atestado — quem tem 0 já aparece em Candidatos à Internalização.",
        "Card de Reprovados exibe badges com contagem real de faltas, atestados (>1) e medidas disciplinares.",
        "Botão Internalizar redireciona para a tela de movimentação do colaborador (disponível apenas para administradores).",
        "Gráfico de Headcount & Movimentações exibe apenas dados BPO (sem SPX).",
        "Todos os KPIs, donuts e rankings filtram exclusivamente colaboradores BPO.",
        "Cards de HC por Líder, HC por Setor e HC por Escala ocultados.",
        "Nova tabela de Candidatos à Internalização: BPO ativos com +90 dias de casa, sem atestado, falta ou medida disciplinar.",
        "Tabela de candidatos com filtros por turno e líder, e exportação em CSV.",
      ],
    },
    {
      nome: "Dashboard Administrativo",
      icone: "📊",
      itens: [
        "Gráfico de Headcount & Movimentações adicionado, exibindo todos os colaboradores incluindo SPX.",
      ],
    },
    {
      nome: "Medidas Disciplinares",
      icone: "🖨️",
      itens: [
        "Impressão de carta agora seleciona o modelo automaticamente com base na empresa do colaborador.",
        "Colaboradores da ADILIS e Adecco utilizam o modelo oficial de Advertência Disciplinar dessas empresas.",
      ],
    },
  ],
};

export default CHANGELOG;
