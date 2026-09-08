# Auditoria das notificações de tarefas — 2026-09-08

## Resultado

O caminho principal está funcional no DEV: o WebResource publicado abriu em modo Dataverse conectado, versão `v0.1.367`, e a caixa própria do Planner exibiu 3 notificações, sendo 1 não lida. A suíte local passou em `147/147`.

Não há prova suficiente para declarar Flow, plugin, Teams/e-mail, retry ou permissões operacionais como validados ponta a ponta. A auditoria encontrou dois bloqueadores/risco operacionais observáveis no DEV:

1. A consulta de equipes falha porque solicita `cr40f_icone`, campo inexistente em `cr40f_plannerequipe`.
2. Pelo menos um funcionário (`edneiadepaula63@gmail.com`) não possui usuário Dataverse ativo correspondente; notificações destinadas a esse registro não têm destinatário externo resolvido.

## Escopo e evidências

Escopo limitado a eventos de tarefas. Contatos, Cotações e Qualidade não foram classificados como obrigação desta revisão.

| Camada | Evidência | Resultado |
|---|---|---|
| Domínio/mock | `src/notifications.js:27-128`, `src/mockStore.js:268-357` | Regras de prazo, destinatários, dedupe e geração local implementadas. |
| Persistência local | `src/mockStore.js:737-742` | Leitura individual e em massa persistem `readAt`. |
| Dataverse | `src/dataverse.js:830-853`, `src/dataverse.js:1355-1362` | Leitura por destinatário e marcação como lida implementadas via Web API. |
| UI | `src/App.jsx:788-936`, `src/App.jsx:6384-6447` | Badge, filtros, abertura, leitura individual e leitura em massa implementados. |
| Evento live | `src/dataverse.js:898-1004` | WebResource grava ocorrências tipadas no Dataverse. |
| Flow imediato | `scripts/create-planner-immediate-flow.ps1:37-239` | Provisionamento versionado cobre criação de notificação e disparo externo. Execução real não comprovada nesta auditoria. |
| Flow diário | `scripts/create-planner-daily-flow.ps1:24-64` | Script existe, com recorrência útil às 08:00 e chave diária. Execução real não comprovada. |
| Plugin nativo | `power-platform/plugins/PlannerNotifications/PlannerTaskEventNotificationPlugin.cs:44-258` | Código envia `SendAppNotification`; registro, permissões e execução DEV não foram comprovados. |
| DEV | Sessão autenticada Power Apps, console e UI observáveis | Caixa própria funcional para registros existentes; há erros de metadata e vínculo de usuário. |

## Matriz de eventos

| Evento | Disparador | Destinatários | Persistência/dedupe | UI/link | Classificação |
|---|---|---|---|---|---|
| Nova tarefa atribuída | Criação com responsáveis; `notification:assignment` | Responsáveis novos, autor excluído | `cr40f_chavededupe` no Flow; chave determinística local por tarefa | Item abre tarefa | Funcionando no código; DEV externo não comprovado |
| Menção | Comentário/tarefa com `notification:mention` | IDs mencionados, autor excluído | Evento + destinatário no Flow; `eventId` local | Item abre tarefa/conversa conforme dado | Funcionando no código; DEV externo não comprovado |
| Prazo alterado | `dueDateChanged`; `notification:deadline` | Criador, responsáveis atuais/anteriores, autor excluído | Chave por evento/destinatário/tipo | Item abre tarefa | Funcionando no código; DEV externo não comprovado |
| Conclusão | Status muda para `done`; `notification:status` | Criador e responsáveis, autor excluído | Chave por evento/destinatário/tipo | Item pendente/informativo abre tarefa | Funcionando no código; DEV externo não comprovado |
| Entrada em Aguardando | Status `waiting` ou contexto alterado; `notification:waiting` | Criador, responsáveis e alvos do retorno, autor excluído | Chave por evento/destinatário/tipo | Item acionável abre tarefa | Funcionando no código; DEV externo não comprovado |
| Retorno registrado | Retorno live grava `notification:status`; mock grava `waiting_return` | Criador e responsáveis, autor excluído | Evento de retorno | Item abre tarefa | Parcial: semântica/tipo diferem entre live e mock |
| Inclusão/remoção de responsáveis | Alteração de relações; `notification:assignees` | Responsáveis atuais e anteriores, autor excluído | Chave por evento/destinatário/tipo | Item abre tarefa | Funcionando no código; DEV externo não comprovado |
| Cobrança manual | `notification:overdue_manual` | Responsáveis resolvidos, autor excluído | Prefixo tarefa/data + evento de cobrança | Item abre tarefa | Código idempotente; DEV externo não comprovado |
| Cobrança diária | Flow diário | Responsáveis; criador entra no primeiro dia útil após vencimento | Destinatário/tarefa/tipo/data | Item abre tarefa | Script e mock cobertos; execução DEV não comprovada |
| Status `todo`/`doing` | Evento histórico sem prefixo de notificação | Nenhum | Sem registro de notificação | Nenhum | Limite intencional do contrato atual |
| Leitura individual | Clique no item ou botão | Usuário atual | PATCH de `cr40f_lidoem` | Badge atualiza otimisticamente | Implementado; DEV não alterado para preservar auditoria read-only |
| Leitura em massa | `Marcar todas` | Usuário atual | PATCH em paralelo | Badge zera otimisticamente | Implementado; DEV não alterado para preservar auditoria read-only |

## Achados

### P1 — Destinatários podem ficar sem entrega por vínculo Microsoft ausente

O console DEV registrou repetidamente: `vínculo Microsoft não aplicado para edneiadepaula63@gmail.com: 0 usuário(s) ativo(s) correspondente(s).` O código resolve notificações externas por `cr40f_funcionarios.cr40f_usuariodataverse` e exige `systemuser` ativo (`PlannerTaskEventNotificationPlugin.cs:168-202`).

Impacto: qualquer notificação direcionada somente a esse funcionário pode ser criada internamente, mas não chegar via plugin/Teams/e-mail.

Correção recomendada: validar e corrigir o lookup do funcionário no DEV; depois repetir cenário com atribuição e confirmar registro de disparo/entrega.

### P1 — Falha de metadata de equipes afeta tarefas atribuídas a equipe

O console DEV registrou `GET /cr40f_plannerequipes ... cr40f_icone ... 400 Could not find a property named 'cr40f_icone'`. O erro é repetido durante o bootstrap e atualização.

Impacto: equipes não carregam de forma confiável. Como destinatários de tarefas de equipe são derivados dos membros, isso pode impedir ou desatualizar a resolução de destinatários em tarefas compartilhadas por equipe.

Correção recomendada: alinhar `TEAM_TABLE`/campos selecionados ao metadata real do DEV, ou provisionar o campo antes de usar a consulta. Validar novamente criação/alteração de tarefa em equipe.

### P2 — Retorno tem contrato de tipo diferente entre mock e live

O mock cria `type: "status"` com chave usando `type: "waiting_return"` (`src/mockStore.js:478-509`). No live, o evento usa `notification:status` (`src/dataverse.js:1077-1082`).

Impacto: títulos, filtros e dedupe podem divergir entre ambientes; o mesmo retorno pode aparecer como `Retorno registrado` no mock e `Status alterado` pelo Flow/plugin live.

Correção recomendada: definir um único tipo funcional para retorno e alinhar produtor, Flow, plugin, apresentação e testes. Não corrigido nesta auditoria.

### P2 — Dois canais externos coexistem sem prova de configuração exclusiva

O Flow imediato cria linhas em `cr40f_plannernotificacao` e registros em `cr40f_plannerdisparo` (`scripts/create-planner-immediate-flow.ps1:80-239`). O plugin independente envia `SendAppNotification` (`PlannerTaskEventNotificationPlugin.cs:256-270`).

Impacto: se Flow e plugin estiverem ativos para o mesmo evento, o usuário pode receber a notificação na caixa própria, no centro nativo e em canal externo. Se somente o plugin estiver ativo, a caixa própria do WebResource não necessariamente recebe linha em `cr40f_plannernotificacao`.

Correção recomendada: escolher arquitetura oficial por ambiente, documentar se os dois canais são complementares e validar duplicação/ausência com um único evento controlado em DEV.

### P2 — Validação externa incompleta

Não foi possível comprovar somente por leitura da sessão atual: execução dos Flows, existência do step assíncrono do plugin, chaves alternativas, permissões `Send In-App Notification`, retry por destinatário, estados de `cr40f_plannerdisparo` ou entrega Teams/e-mail.

Isso é lacuna de evidência, não falha confirmada.

## Cobertura local

Os testes existentes cobrem regras de domínio e contratos estruturais:

- classificação de D-1 útil, hoje, atraso e status terminal;
- destinatários para atribuição, menção, status, Aguardando e responsáveis;
- dedupe e contagem de não lidas;
- cobrança diária e inclusão do criador no primeiro dia útil;
- geração de notificações no mock;
- leitura individual e em massa no store;
- contratos do Flow imediato e plugin.

Resultado observado: `147 passed, 0 failed` em `npm.cmd test`.

Limites dos testes:

- não executam contra Dataverse autenticado;
- não verificam o WebResource publicado;
- não comprovam execução de Flow/plugin;
- não cobrem contrato live/mock de `waiting_return` como uma asserção explícita;
- não cobrem destinatário sem lookup Microsoft como cenário integrado.

## Backlog priorizado

1. Corrigir/confirmar vínculo Microsoft dos funcionários sem `systemuser` ativo.
2. Corrigir consulta de equipes e validar destinatários de equipe.
3. Definir canal oficial: Flow + caixa própria, plugin nativo, ou ambos com regra explícita.
4. Alinhar o tipo de retorno entre mock, live, Flow, plugin e UI.
5. Executar validação DEV controlada, ainda separada desta auditoria, para atribuição, menção, prazo, conclusão, Aguardando, responsáveis, cobrança manual, cobrança diária, dedupe, identidade ausente e retry.
6. Adicionar testes de contrato para `waiting_return`, identidade ausente e divergência entre canais.

## Conclusão

A caixa de notificações e o caminho de leitura estão funcionando no DEV para registros já existentes. As regras locais estão cobertas e a suíte está verde. A entrega não permite afirmar que a cadeia completa de entrega externa está funcionando: há dependências de metadata/vínculo quebradas e componentes DEV cuja execução não foi comprovada sem gerar eventos.
