# Dashboard de Gestão Operacional - Documentação

## Visão Geral
Dashboard integrado com Google Sheets para acompanhamento de metas de produção por turno e hora.

## Estrutura de Arquivos

### Backend

1. **Serviço Google Sheets** (`backend/src/services/googleSheetsMetaProducao.service.js`)
   - Conecta com a planilha ID: `17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0`
   - Lê a aba "Meta"
   - Estrutura esperada: Data | Hora | Esteira | Meta | Turno
   - Filtra por data e turno
   - Soma todas as metas por hora (Esteira A, B, C, Rolete A, etc.)
   - Cache de 5 minutos

2. **Controller** (`backend/src/controllers/gestaoOperacional.controller.js`)
   - Endpoint: `GET /dashboard/gestao-operacional`
   - Parâmetros obrigatórios:
     - `turno`: T1, T2 ou T3
     - `data`: formato YYYY-MM-DD (opcional, padrão hoje)
   - Busca metas da planilha
   - Busca produção real do banco (tabela DwReal)
   - Calcula KPIs:
     - Meta do Dia (soma de todas as horas)
     - Meta Hora Projetada (soma até hora atual)
     - Realizado (produção até hora atual)
     - Performance (realizado / meta projetada * 100)
     - Produtividade ((realizado / meta projetada) * 770)
     - Média Hora Realizado

3. **Rotas** (`backend/src/routes/gestaoOperacional.routes.js`)
   - Registrada em `/dashboard/gestao-operacional`
   - Protegida por autenticação

### Frontend

1. **Página Principal** (`frontend/src/pages/dashboards/gestaoOperacional.jsx`)
   - Filtros:
     - Seletor de Turno (T1, T2, T3)
     - Seletor de Data
   - KPIs em destaque (fundo laranja):
     - Meta do Dia
     - Meta Hora Projetada
     - Meta de Produtividade
   - Card de Performance:
     - Média Hora Realizado
     - Produtividade
     - Comparação Meta X Realizado
     - Círculo de performance
   - Gráfico de Produção por Hora
   - Tabela de Capacidade

2. **Componentes**:
   - `ProducaoChart.jsx`: Gráfico com barras e linha de tendência
   - `CapacidadeTable.jsx`: Tabela de capacidade por hora

3. **Rota**: `/dashboard/gestao-operacional`
   - Acessível para ADMIN e LIDERANCA
   - Link no menu lateral (seção Dashboards)

## Como Funciona

### Fluxo de Dados

1. Usuário seleciona Turno (ex: T1) e Data (ex: 04/03/2026)
2. Frontend faz requisição: `GET /dashboard/gestao-operacional?turno=T1&data=2026-03-04`
3. Backend:
   - Busca na planilha todas as linhas com data "04/03/2026" e turno "T1"
   - Soma os valores por hora:
     - Hora 6: Esteira A (2,125) + Esteira B (0) + Esteira C (318) + Rolete A (125) = 445,125
     - Hora 7: Esteira A (4,250) + Esteira B (0) + Esteira C (636) + Rolete A (250) = 890,250
     - E assim por diante...
   - Meta do Dia = soma de todas as horas
   - Busca produção real do banco filtrada por turno
   - Calcula performance e KPIs
4. Frontend exibe os dados nos gráficos e tabelas

### Exemplo de Dados da Planilha

```
Data         | Hora | Esteira              | Meta  | Turno
04/03/2026   | 6    | Esteira A (Esquerda) | 2,125 | T1
04/03/2026   | 6    | Esteira B (Direita)  | 0     | T1
04/03/2026   | 6    | Esteira C (Fulfilment)| 318  | T1
04/03/2026   | 6    | Rolete A             | 125   | T1
```

### Cálculos

- **Meta Hora**: Soma de todas as esteiras para aquela hora
- **Meta Dia**: Soma de todas as horas do turno
- **Meta Hora Projetada**: Soma das metas até a hora atual
- **Performance**: (Realizado / Meta Hora Projetada) * 100
- **Produtividade**: (Realizado / Meta Hora Projetada) * 770

## Configuração

### Variáveis de Ambiente Necessárias

```env
GOOGLE_CLIENT_EMAIL=seu-email@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Permissões da Planilha

A conta de serviço precisa ter acesso de leitura à planilha.

## Testes

Para testar a integração:

1. Acesse `/dashboard/gestao-operacional`
2. Selecione um turno (T1, T2 ou T3)
3. Selecione uma data que tenha dados na planilha
4. Verifique se os KPIs são carregados
5. Verifique se o gráfico exibe as barras corretamente
6. Verifique a tabela de capacidade

## Troubleshooting

### Erro: "Turno é obrigatório"
- Certifique-se de que o filtro de turno está selecionado

### Erro: "Aba Meta vazia"
- Verifique se a planilha tem a aba "Meta"
- Verifique as permissões da conta de serviço

### Metas não aparecem
- Verifique o formato da data na planilha (DD/MM/YYYY)
- Verifique se o turno está escrito corretamente (T1, T2, T3)
- Verifique os logs do backend para ver o que foi encontrado

### Cache desatualizado
- O cache expira após 5 minutos
- Reinicie o servidor para limpar o cache imediatamente
