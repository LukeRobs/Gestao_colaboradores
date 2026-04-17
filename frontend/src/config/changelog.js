const CHANGELOG = {
  version: "1.13.0",
  titulo: "Envio de Evidências por E-mail e Novo Modelo de Carta",
  categorias: [
    {
      nome: "📧 Medidas Disciplinares",
      itens: [
        "Novo botão 'Enviar evidência por e-mail' para medidas assinadas",
        "Envio automático do PDF assinado como anexo para o RH responsável",
        "Validação de RH configurado antes do envio com mensagem orientativa",
      ],
    },
    {
      nome: "📄 Modelo de Carta Atualizado",
      itens: [
        "Novo layout oficial da carta de advertência ShopeeXpress",
        "Motivos automáticos mais descritivos para medidas geradas pelo sistema",
        "Identificação de primeira ocorrência ou reincidência no texto da carta",
      ],
    },
    {
      nome: "🔧 Melhorias Técnicas",
      itens: [
        "Suporte a array de e-mails para múltiplos destinatários de RH",
        "Script de atualização retroativa de motivos automáticos",
        "Otimização de queries com raw SQL para campos de array",
        "Inclusão de dados da estação (localização) nas medidas disciplinares",
      ],
    },
  ],
};

export default CHANGELOG;
