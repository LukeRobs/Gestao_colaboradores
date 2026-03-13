# Produtividade por Colaborador

## Descrição
Nova funcionalidade que permite visualizar a produtividade individual de cada colaborador separada por turno e por hora, similar ao formato mostrado na planilha de exemplo.

## Funcionalidades

### Backend
- **Controller**: `backend/src/controllers/produtividadeColaborador.controller.js`
- **Rota**: `backend/src/routes/produtividadeColaborador.routes.js`
- **Endpoint**: `GET /api/dashboard/produtividade-colaborador`

#### Parâmetros da API:
- `data` (opcional): Data no formato YYYY-MM-DD
- `turno` (obrigatório): T1, T2 ou T3

#### Funcionalidades do Backend:
- Busca colaboradores ativos do turno selecionado
- Consulta dados de produção individual por hora do banco `dw_real`
- Integração com planilha Google Sheets para dados complementares
- Lógica especial para T3 (turno noturno que cruza dias)
- Cálculo de estatísticas: total geral, média, maior produção, colaboradores ativos

### Frontend
- **Página**: `frontend/src/pages/dashboards/produtividadeColaborador.jsx`
- **Componente**: `frontend/src/components/produtividadeColaborador/ProdutividadeColaboradorTable.jsx`
- **Rota**: `/dashboard/produtividade-colaborador`

#### Funcionalidades do Frontend:
- Filtros por data e turno
- Tabela responsiva com dados por hora
- Sistema de busca por nome, OPS ID, setor ou cargo
- Paginação (50 itens por página)
- Ordenação por qualquer coluna
- Ranking visual com ícones para top 3
- Cores diferenciadas para níveis de produtividade
- Atualização automática a cada 2 minutos
- Estatísticas resumidas no cabeçalho

## Layout da Tabela

A tabela exibe:
- **Ranking**: Posição do colaborador (com ícones especiais para top 3)
- **Colaborador**: Nome completo
- **OPS ID**: Identificador único
- **Setor**: Setor de trabalho
- **Cargo**: Cargo do colaborador
- **Horas do Turno**: Colunas dinâmicas baseadas no turno selecionado
  - T1: 06:00 às 14:00
  - T2: 14:00 às 22:00  
  - T3: 22:00 às 06:00
- **Total**: Soma da produção do dia (coluna destacada)

## Cores e Indicadores

### Produtividade:
- **Verde**: ≥ 1000 unidades
- **Amarelo**: ≥ 500 unidades
- **Branco**: < 500 unidades
- **Cinza**: 0 unidades

### Ranking:
- 🏆 **1º lugar**: Troféu dourado
- 🥈 **2º lugar**: Medalha prata
- 🥉 **3º lugar**: Medalha bronze

## Permissões
- Acesso restrito a usuários com roles: **ADMIN** e **LIDERANCA**

## Menu de Navegação
- Localizado em: **Dashboards > Produtividade por Colaborador**

## Tecnologias Utilizadas
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL
- **Frontend**: React, Tailwind CSS, Lucide Icons
- **Integração**: Google Sheets API

## Como Usar

1. Acesse o menu **Dashboards > Produtividade por Colaborador**
2. Selecione a **data** desejada (padrão: hoje)
3. Escolha o **turno** (T1, T2 ou T3)
4. Clique em **Atualizar** ou aguarde a atualização automática
5. Use a **busca** para filtrar colaboradores específicos
6. Clique nos **cabeçalhos** das colunas para ordenar
7. Use a **paginação** para navegar entre páginas

## Observações Técnicas

- Os dados são buscados da tabela `dw_real` do banco de dados
- Integração com Google Sheets para dados complementares
- Cache inteligente para melhor performance
- Tratamento especial para o turno T3 que cruza a meia-noite
- Atualização automática para dados em tempo real
- Interface responsiva para diferentes tamanhos de tela