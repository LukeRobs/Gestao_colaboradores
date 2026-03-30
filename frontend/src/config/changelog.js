/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * categorias: agrupa as mudanças por tipo (Novidade, Melhoria, Correção).
 */
const CHANGELOG = {
  version: "1.7.3",
  titulo: "Novidades desta atualização",
  categorias: [
    {
      tipo: "Novidade",
      itens: [
        "Dashboard Operacional e Relatório Operacional: novo KPI 'Share de Diaristas' exibido ao lado de Aderência DW.",
        "Folga Dominical: novo filtro por líder na listagem de colaboradores.",
        "Folga Dominical: coluna 'Domingo' adicionada na tabela exibindo a data do domingo programado.",
      ],
    },
    {
      tipo: "Melhoria",
      itens: [
        "Treinamentos: agora é possível editar a lista de participantes de um treinamento com status em aberto.",
        "Produção hora x hora agora é salva em tempo real a cada 5 minutos junto com o salvamento por colaborador.",
        "Histórico de atestados com datas, dias de afastamento, CID e status.",
        "Folga Dominical: geração de DSR refatorada para processar em lotes, evitando timeout em meses com muitos colaboradores.",
      ],
    },
    {
      tipo: "Correção",
      itens: [
        "Gestão Operacional T3: faixa de horas corrigida para exibir 22-23, 23-00, 00-01... 05-06 na ordem correta.",
        "Folga Dominical: datas exibidas incorretamente devido a fuso horário — corrigido para usar horário meio-dia ao formatar.",
        "Folga Dominical: última folga DSR exibida com data errada — corrigido para normalizar para formato ISO antes de exibir.",
      ],
    },
  ],
};

export default CHANGELOG;
