/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * items: lista de novidades exibidas no modal.
 */
const CHANGELOG = {
  version: "1.7.1",
  titulo: "Novidades desta atualização",
  items: [
    {
      tipo: "novo",
      titulo: "Filtro por Empresa nos Dashboards de Atestados e Faltas",
      descricao:
        "Agora é possível filtrar todos os dados dos dashboards de Atestados e Faltas por empresa específica. O filtro aparece no cabeçalho ao lado dos campos de data e afeta KPIs, gráficos e tabelas.",
    },
    {
      tipo: "novo",
      titulo: "Filtro por Sintoma no Dashboard de Atestados",
      descricao:
        "Novo filtro que agrupa CIDs por categoria de sintoma (ex: Sintomas Gripais, Dor lombar, Náuseas). Ao selecionar um sintoma, todos os CIDs do grupo são aplicados automaticamente. Selecionar um sintoma limpa o filtro de CID individual e vice-versa.",
    },
  ],
};

export default CHANGELOG;
