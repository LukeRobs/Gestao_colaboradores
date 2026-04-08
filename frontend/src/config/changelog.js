const CHANGELOG = {
  version: "1.9.0",
  titulo: "Novidades do Sistema",
  categorias: [
    {
      nome: "Novidades",
      itens: [
        "Tela de Escalas com CRUD completo (criar, editar, excluir escalas por turno)",
        "Tabela de Turnos atualizada com visualização de escalas vinculadas",
        "Tabela de Regionais com melhorias de exibição",
      ],
    },
    {
      nome: "Correções",
      itens: [
        "Fix ponto T3: saída em janela DSR agora protege contra sobrescrita de DSR e criação de nova frequência indevida",
        "Controle de presença: ao selecionar status 'Falta não justificada', o motivo é preenchido automaticamente",
        "Carta de Medida Disciplinar: data da ocorrência exibida corretamente (corrigido problema de fuso UTC)",
        "Sugestão de Medida Disciplinar: data de referência da falta exibida corretamente (campo migrado de TIMESTAMP para DATE)",
        "Upload da carta assinada: interface redesenhada com drop zone estilizada",
      ],
    },
  ],
};

export default CHANGELOG;
