const CHANGELOG = {
  version: "1.11.0",
  titulo: "Segurança e Isolamento de Dados por Estação",
  categorias: [
    {
      nome: "Isolamento de Dados",
      itens: [
        "Adicionado campo id_estacao às tabelas DW (dw_planejado e dw_real) para isolamento de dados por estação",
        "Adicionado campo id_estacao às tabelas de Escala para segmentação por estação",
        "Adicionado campo id_estacao às tabelas de Turno, Cargo e Empresa",
        "Adicionado campo id_estacao à tabela de Desligamento",
        "Adicionado campo id_estacao à tabela de Setor",
        "Implementado relacionamento entre usuários e estações (user_estacao)",
        "Criado perfil Alta Gestão com acesso a todas as estações"
      ]
    },
    {
      nome: "Configurações",
      itens: [
        "Adicionado suporte a configuração de planilhas Google Sheets por estação",
        "Adicionado configuração de planilha de presença por estação (sheets_presenca)"
      ]
    },
    {
      nome: "Melhorias",
      itens: [
        "Corrigido tipo de data do campo data_referencia na tabela de sugestões",
        "Criados índices para otimizar consultas por estação",
        "Implementadas constraints de unicidade considerando estação"
      ]
    }
  ],
};

export default CHANGELOG;
