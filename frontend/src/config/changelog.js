const CHANGELOG = {
  version: "1.15.0",
  titulo: "Controle por Turno, Dashboards Aprimorados e Correções",
  categorias: [
    {
      nome: "Medidas Disciplinares",
      itens: [
        "Aprovação de sugestões agora restrita por turno: usuários de liderança só visualizam e podem aprovar/rejeitar colaboradores do seu próprio turno (T1 não vê T2 ou T3, e assim por diante)",
        "Progressão disciplinar em 3 degraus: 1ª ocorrência → Advertência, 2ª → Suspensão 1 dia, 3ª+ → Suspensão 3 dias",
        
      ],
    },
    {
      nome: "Dashboard de Absenteísmo",
      itens: [
        "Cálculo de taxa de absenteísmo aprimorado: o denominador agora usa o HC Apto real do período (colaboradores com registros válidos), tornando a taxa mais precisa",
        "Novo filtro multi-empresa com dropdown de checkboxes — selecione várias empresas simultaneamente para comparar",
        "Faixas de tempo de casa refinadas: 31–60 dias e 61–90 dias (antes a faixa era única de 31–89 dias)",
      ],
    },
    {
      nome: "Dashboard de Atestados",
      itens: [
        "Novo filtro multi-empresa com dropdown de checkboxes — mesma experiência do dashboard de absenteísmo",
      ],
    },
    {
      nome: "Folga Dominical",
      itens: [
        "Admin global agora precisa selecionar uma estação no menu superior antes de simular ou gerar folgas",
        "Botões de simulação e geração ficam desabilitados com aviso explicativo quando nenhuma estação está selecionada",
        "Erros de elegibilidade (sem domingo encontrado, campos obrigatórios) agora retornam resposta 422 com tipo DADOS_INSUFICIENTES — mensagem exibida de forma clara na tela",
      ],
    },
    {
      nome: "Colaboradores e Importação",
      itens: [
        "Importação em massa agora inclui contato de emergência no mapeamento dos campos",
        "Corrigido bug onde a data de admissão perdia um dia ao ser salva por causa de conversão de fuso horário",
      ],
    },
    {
      nome: "Controle de Presença",
      itens: [
        "Filtro de turno agora é dinâmico — carregado diretamente do banco, sem lista fixa no código",
      ],
    },
    {
      nome: "Daily Works (Diaristas)",
      itens: [
        "Nova modalidade Diarias TECH adicionada ao módulo de Daily Works",
        "Corrigido planejado do T3 no módulo de diaristas",
        "Nova empresa de Diaristas adicionada no DW",
      ],
    },
    {
      nome: "Outras Melhorias",
      itens: [
        "Matrícula de dia de DSR agora aparece na lista de ausentes do período",
        "Dias de folga incluídos no dashboard operacional",
      ],
    },
  ],
};

export default CHANGELOG;
