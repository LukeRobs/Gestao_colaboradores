const CHANGELOG = {
  version: "1.8.0",
  titulo: "Novidades do Sistema",
  categorias: [
    {
      nome: "Novidades",
      icone: "✨",
      itens: [
        "Planilha Google Sheets agora pode ser configurada por estação — cada estação tem sua própria fonte de dados de produtividade",
        "Tela amigável exibida quando a planilha de produtividade ainda não foi configurada para a estação",
        "Campo de ID da planilha disponível no cadastro e edição de estações",
      ],
    },
    {
      nome: "Melhorias",
      icone: "🚀",
      itens: [
        "ALTA_GESTAO agora tem visão fixada na sua estação — sem acesso a dados de outras estações",
        "Criação de colaborador vincula automaticamente à estação do usuário logado",
        "Ajuste manual de presença bloqueado para colaboradores de outra estação",
        "Dashboard Admin filtrado por estação para usuários não-globais",
        "Rotas de debug e limpeza de cache protegidas — exigem role ADMIN",
      ],
    },
    {
      nome: "Correções",
      icone: "🐛",
      itens: [
        "DSR e Folga (FO) agora têm prioridade sobre batida de ponto — dia de folga não é mais contado como presente",
        "T3 — entradas fora do horário do turno (20:50–06:20) não inflam mais a contagem de presentes",
        "Controle de presença isolado por estação — usuário sem estação configurada não vê dados de outras estações",
      ],
    },
  ],
};

export default CHANGELOG;
