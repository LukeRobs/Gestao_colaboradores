# Report: Migração para hospedagem gratuita do CoPeople

**Data:** 14/10/2026
**Status:** Planejado

## Resumo

Hoje o backend e o banco de dados do CoPeople rodam em planos pagos do Render, e o custo saiu do orçamento. Vamos migrar para planos gratuitos, **sem tirar o sistema do ar e sem perder funcionalidades**. Em troca, o sistema ficará um pouco mais limitado em desempenho e margem de crescimento.

## O que muda

| Componente | Hoje | Depois |
|---|---|---|
| Frontend (telas) | Vercel (gratuito) | **Sem mudança** |
| Backend (API e rotinas automáticas) | Render pago | **Render, plano gratuito** |
| Banco de dados | Render pago (328 MB) | **Neon, plano gratuito** |
| Custo mensal | Pago | **R$ 0** |

Os dados atuais (328 MB) cabem no limite gratuito do Neon (~512 MB). Nenhuma informação será perdida: o banco será copiado integralmente antes da virada.

## O que continua funcionando

- Todas as telas e funcionalidades atuais.
- Rotinas automáticas: varredura de faltas, desligamentos agendados, geração de DSR, sincronização com Google Sheets, exportações e histórico de produção.
- Login, permissões e relatórios.

## Onde ficaremos mais limitados

| Limitação | O que significa na prática |
|---|---|
| **Servidor hiberna sem uso** | O Render gratuito "dorme" após 15 min sem acesso. Um monitor gratuito vai acessá-lo a cada 5 min para mantê-lo acordado. Se esse monitor falhar, a primeira abertura do sistema pode levar de 30 a 60 segundos. |
| **Menos memória (512 MB)** | Relatórios muito pesados (PDF/Excel com muitos dados) podem ficar mais lentos ou falhar em picos de uso. |
| **Espaço do banco: ~512 MB** | Usamos 328 MB. Há folga, mas ela é limitada, então precisaremos acompanhar o crescimento e arquivar dados antigos se necessário. |
| **Sem armazenamento local de arquivos** | Arquivos enviados (ex.: atestados) precisam ficar em armazenamento externo (Cloudflare R2). |
| **Envio de e-mail** | O Render gratuito pode bloquear o envio por SMTP. O envio de e-mails de relatório será ajustado para usar uma via compatível. |
| **Deploys e reinícios** | Atualizações podem causar uma indisponibilidade breve. Rotinas agendadas que coincidirem com um reinício podem ser perdidas. |
| **Limite de horas** | O plano gratuito oferece 750 h/mês, suficiente para um único serviço ligado o mês todo. |

## Etapas

1. **Preparação:** backup do banco, revisão do envio de e-mail e dos uploads.
2. **Banco:** criar o banco no Neon e restaurar os dados.
3. **Virada:** em janela curta, fora do horário operacional, apontar o backend para o novo banco e passar o serviço para o plano gratuito.
4. **Monitoramento:** acompanhar por 48 h as rotinas e o desempenho.
5. **Encerramento:** após ~1 semana estável, remover o banco antigo do Render.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Banco ultrapassar o limite gratuito | Acompanhamento mensal e arquivamento de dados antigos |
| Lentidão em relatórios pesados | Observar nos primeiros dias; otimizar se necessário |
| Rotinas perdidas em reinício | Monitoramento e recuperação automática ao iniciar o servidor |
| Problema na virada | Banco e serviço antigos mantidos por ~1 semana para retorno rápido |

## Conclusão

Vamos operar a custo zero, com o sistema funcionando normalmente, aceitando limites de desempenho e de espaço.
