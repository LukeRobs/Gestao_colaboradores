/**
 * CHANGELOG — atualize este arquivo a cada deploy.
 *
 * version: deve bater com APP_VERSION no .env do backend.
 * items: lista de novidades exibidas no modal.
 */
const CHANGELOG = {
  version: "1.5.0",
  titulo: "Novidades desta atualização",
  items: [
    {
      tipo: "novo",
      titulo: "Dashboard de Faltas — Seção 06: Faltas por Contexto",
      descricao: "Nova seção com 2 cards: distribuição de faltas por Dia da Semana e por Escala.",
    },
    {
      tipo: "melhoria",
      titulo: "Dashboard de Faltas — Gráficos de Pizza",
      descricao: "Legenda atualizada: agora exibe a quantidade absoluta seguida do percentual entre parênteses na mesma linha (ex: T3  32  (64%)).",
    },
  ],
};

export default CHANGELOG;
