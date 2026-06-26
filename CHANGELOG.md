# Changelog

## [Atual] — 2026-06-26

### Dashboard Operacional / Administrativo

- **HC Operacional Escalado** — passa a contar todos os colaboradores ATIVOS elegíveis no período, não apenas quem tem registro de frequência lançado.
- **Critério de "trabalhando normalmente"** — colaborador sem nenhum registro no período conta como trabalhando; colaborador com apenas registros não-escalados (DSR/FE/AFA) passa a ser excluído dessa contagem.
- **Status dos colaboradores** — o card de status agora usa a mesma lista já filtrada das demais seções, eliminando divergência entre KPIs.
- **Acumulado multi-dia** — o dashboard operacional passa a suportar acumulado de múltiplos dias, não só o dia corrente.
- **HC por empresa acumulado** — o headcount por empresa é somado ao longo do período filtrado, com labels da seção adaptados.
- **Desligados no fluxo de KPIs** — colaborador inativo aparece corretamente no dia do desligamento; colaboradores desligados após a data de referência voltam a entrar nos KPIs e no status do dia; recém-desligados voltam a contar nas ausências, alinhando com o operacional.
- **Atestados sem frequência** — status do card e KPIs sincronizados com atestados da tabela de atestado médico que não têm registro correspondente na frequência; atestados médicos passam a aparecer na lista de "Ausentes no Turno".
- **AM/AA com prioridade sobre hora de entrada** — no cálculo de status do dia, atestado médico e atestado de acompanhamento têm prioridade sobre a hora de entrada batida.
- **KPI de atestados sem dupla contagem** — corrigido cálculo que contava o mesmo evento como atestado e como falta simultaneamente.
- **BH/DSR e filtros por ativos** — corrigido cálculo de banco de horas/DSR e filtro de dias de ausência/falta para considerar apenas colaboradores ativos no período.
- **Lista de ausentes** — desligados são ignorados e dias de DSR são pulados corretamente na lista.

### Dashboard de Absenteísmo

- **Nova seção de Faltas** — cross-filtering entre gráficos, KPIs de Medida Disciplinar e tabela analítica com paginação e ordenação.
- **Turnos e contagens** — todos os turnos voltam a ser exibidos; contagem de ausências e atestados corrigida e alinhada com o dashboard operacional, excluindo atestados sem frequência correspondente do cálculo por turno (evita dupla contagem).
- **Desligados no período** — colaboradores desligados após o período voltam a entrar nas consultas de faltas, atestados e HC Apto.
- **Tendência mais precisa** — o gráfico de tendência passa a expandir o atestado por todos os dias cobertos (não só o dia de início); atestados com status finalizado entram na contagem mesmo sem outro vínculo.
- **Correção AM/AA classificados como Falta** — atestado médico (`AM`) e atestado de acompanhamento (`AA`) deixaram de ser contados como "Falta" em todo o dashboard (resumo, distribuições, tendência e tabela de colaboradores). `AM` já tinha registro próprio na tabela de atestados e agora só conta ali; `AA` — que não tem tabela própria — passou a ser contabilizado como "Atestado" em vez de desaparecer da contagem. Corrige casos em que um colaborador aparecia com faltas no painel sem nenhuma falta correspondente no perfil de presença.

### Controle de Presença

- **SU e FO sem justificativa** — status "Suspensão" e "Folga" deixam de exigir justificativa manual no ajuste de presença.
- **Recarregamento após exclusão** — ao excluir um registro de frequência, a presença é recarregada do servidor em vez de apenas remover o dia do estado local.
- **Desligamento e afastamento automáticos** — desligamento (forçado ou voluntário) e afastamento preenchem automaticamente o status do dia (DP/DV/DF/AFA); colaboradores desligados ficam visíveis na grade até o fim do mês.
- **Férias e afastamento em andamento** — passam a aparecer corretamente na grade e na exportação, com o filtro de data de fim de status corrigido.
- **Pré-admissão** — dias anteriores à data de admissão exibem "Não Contratado" automaticamente; novo botão "Preencher NC" faz o backfill em massa para quem foi admitido no mês atual.
- **Modal de ajuste de presença** — campos de horário voltaram a aparecer (ocultos só para Banco de Horas e Sinergia enviada); exibição de hora de entrada/saída corrigida ao selecionar "Presente"; corrigido conflito de merge que deixava a tela fora do ar por erro de sintaxe.

### Colaboradores

- **Filtro por setor e exportação CSV** — listagem ganhou filtro por setor; exportação respeita todos os filtros ativos (setor, turno, status, busca).
- **Histórico de escala** — passa a suportar múltiplas trocas de escala no mesmo dia.

### Escalas

- **Edição liberada para Alta Gestão** — perfil Alta Gestão agora pode editar escalas.
- **Ajustes de consistência** — diversas correções pontuais no cálculo e exibição de escalas.

### Daily Works / Diaristas

- **Diarias TECH** — nova empresa de diaristas adicionada ao módulo.
- **Turnos dinâmicos** — suporte a novos turnos no dashboard operacional e no formulário de Daily Work, sem lista fixa no código; mapeamento de turnos e diaristas presentes corrigido.
- **Exportação e paginação** — exportação CSV e paginação com seletor de itens por página na listagem.
- **DW Planejado x Real** — DW Planejado passa a usar o banco para todas as estações (Real continua filtrando por estação exata); Estação 1 usa a aba Calculadora do Sheets, igual ao Daily Works; conversão de turno (T1→1) corrigida na Calculadora.

### Treinamentos

- **Setor e turno dos participantes** — exibidos na tela de detalhes do treinamento e na ATA gerada.
- **Estação e turno na criação** — formulário de novo treinamento exibe turno e estação vinculados ao responsável.

### Dashboard de Desligamentos

- **Gráficos de barras horizontais** — distribuição por motivo e por empresa, com labels de valor direto na barra.
- **Detalhamento paginado** — tabela com 50 itens por página, busca por nome e ordenação por coluna.

### Exportação e Integrações

- **Google Sheets** — exportação passa a incluir colaboradores inativos do mês e afastados.
- **R2 (armazenamento)** — corrigido erro de assinatura (`SignatureDoesNotMatch`) causado por espaços nas credenciais.
- **Seatalk por estação** — relatório operacional enviado para o grupo Seatalk da própria estação, sem depender de variável de ambiente global; e-mails do relatório configuráveis direto no modal de Estações, substituindo lista fixa; popup orienta o usuário (ou o admin, com atalho direto) quando o grupo não está configurado; timeouts aumentados para compensar latência Render → API.

### Gestão Operacional

- **Meta de produtividade dinâmica** — prioriza a planilha sobre o banco para o turno do dia corrente.

### Autenticação

- **Domínio @shopeemobile-external.com** — cadastro de usuários passa a aceitar esse domínio além do `@shopee.com`.

### Interface

- **Botão hamburguer no mobile** — corrige acesso à navegação em telas pequenas.

### Processamento Geral

- **Seção removida** — dashboard, rota e item de menu descontinuados.

---

## [2026-05-08]

### Gestão Operacional

- **Nova fonte de dados de produção** — os valores de realizado agora vêm da planilha *Produtividade OnTime* (ProdutividadeSPX), substituindo a aba Atualização_colaborador. Os dados são filtrados pela data de atualização de cada operador, evitando que produção de dias anteriores contamine o resultado do dia atual.
- **Ranking Top 15 removido** — a seção de ranking por colaborador foi descontinuada junto com a fonte de dados anterior.
- **Última atualização** — o horário exibido no dashboard agora reflete quando a planilha foi atualizada pela última vez, não quando o servidor respondeu.
- **Botão "Forçar Atualização" removido** — a atualização automática a cada 35 segundos (antes 60s) torna o botão desnecessário.
- **Loading com skeleton** — a tela preta de carregamento foi substituída por um esqueleto animado. Ao atualizar automaticamente, o conteúdo existente permanece visível enquanto os novos dados chegam — o turno selecionado não é perdido.
- **Redundância de histórico horário** — além do salvamento ao fechar o turno (T1 às 15h, T2 às 23h, T3 às 05h), o sistema agora salva os dados da hora anterior todo HH:05. Às 20:05, por exemplo, os dados das 19h são persistidos, garantindo que nenhuma hora seja perdida por uma falha no fechamento do turno.

### Processamento Geral

- **Gráfico Visão Unificada reescrito** — a linha de Meta Ajustada agora para exatamente na hora atual, sem a curva exponencial que explodía o eixo Y nas horas futuras do T3. O eixo é calculado sobre dados reais e meta original, não sobre projeções. Valores aparecem diretamente no topo de cada barra (ex: `38k`) sem precisar olhar no eixo. Faixa de performance no rodapé mostra `%` arredondado por hora.

---

## [v — pull] — 2026-05

### Colaboradores

- **Correção de data de admissão** — a data não perde mais um dia ao ser salva por conversão de fuso horário.
- **Jornada derivada do turno** — ao cadastrar ou editar um colaborador, o horário de início de jornada é preenchido automaticamente com base no turno selecionado.
- **Férias cria ausência automaticamente** — ao registrar férias ou afastamento, a ausência correspondente (FE/AFA) é criada automaticamente; o histórico de ausências aparece no perfil do colaborador.
- **Filtro de turnos dinâmico** — o filtro de turno nas listagens de colaboradores e presença agora mostra apenas os turnos cadastrados para a estação do usuário.

### Hierarquia

- **Nível de coordenadores** — adicionado o nível de coordenador na hierarquia. Líderes sem operadores vinculados aparecem corretamente. Cargos disponíveis no filtro foram expandidos.
- **Aprovação de sugestões por turno** — lideranças só visualizam e aprovam/rejeitam colaboradores do seu próprio turno. A rejeição agora persiste o motivo corretamente.

### Medidas Disciplinares

- **Progressão em 3 degraus** — a progressão disciplinar segue: 1ª ocorrência → Advertência, 2ª → Suspensão 1 dia, 3ª ou mais → Suspensão 3 dias. Casos com 4+ dias são bloqueados para automação e sinalizados com aviso de análise jurídica, exigindo revisão manual do RH.

### Atestados & Acidentes

- **Tabela com paginação server-side** — as páginas de atestados e acidentes foram reformuladas com tabela, paginação no servidor, cards de KPI e filtros por data e nome com debounce. Evidências de acidentes aceitam apenas PDF.

### Presença

- **Reinclusão após férias/afastamento** — colaboradores que retornam de férias ou afastamento voltam a aparecer corretamente no controle de presença.

### Diaristas

- **Diarias TECH** — nova empresa de diaristas adicionada ao módulo de Daily Works. Correção no planejado do T3.
- **Dashboard** — dias de folga agora aparecem no dashboard operacional.

### Folgas

- **Geração de folga dominical** — removido o backfill retroativo do processo de geração de DSR, evitando queda de conexão em bases com histórico extenso.

### Importação

- **Contato de emergência** — o campo de contato de emergência passou a ser incluído no mapeamento do import em massa de colaboradores.

### Infraestrutura

- **Redis (Upstash)** — cache conectado via Upstash Redis, reduzindo latência em consultas repetidas à planilha e ao banco.
- **Rate limiting por tier** — limites de requisição aplicados por tipo de rota: 300/min global, 10/min autenticação, 120/min dashboards, 20/min relatórios, 60/min escritas.
- **Paginação obrigatória** — atestados, usuários, medidas disciplinares, sugestões, treinamentos e acidentes agora exigem `page` e `limit`, com teto de 100 itens por página e resposta padronizada com `hasNextPage`/`hasPreviousPage`.
- **Esteiras planejadas** — configuração das esteiras aparece no dashboard operacional para usuários com perfil de liderança, usando a estação efetiva do usuário.
