/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * items: lista de novidades exibidas no modal.
 */
const CHANGELOG = {
  version: "1.7.2",
  titulo: "Novidades desta atualização",
  items: [
    {
      tipo: "melhoria",
      titulo: "Nova justificativa no controle de presença",
      descricao: "Adicionada a opção 'Falta injustificada' como justificativa.",
    },
    {
      tipo: "melhoria",
      titulo: "Sugestões de Medida Disciplinar",
      descricao: "Filtro de liderança por dropdown, filtro de status com contadores e cards de resumo no topo.",
    },
    {
      tipo: "melhoria",
      titulo: "Prevenção de MD duplicada",
      descricao: "Impede criação de MDs duplicadas para a mesma violação. Aviso ao criar MD manual com sugestão automática pendente.",
    },
  ],
};

export default CHANGELOG;
