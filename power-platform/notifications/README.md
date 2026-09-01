# Notificações e cobrança automática

## Componentes Dataverse (DEV)

As tabelas abaixo pertencem à solução `AppBetinhos`:

- `cr40f_plannernotificacao` (`cr40f_plannernotificacaos`): tarefa, destinatário, tipo, título, mensagem, ocorrido em, lido em, evento de origem, data de referência e `cr40f_chavededupe`.
- `cr40f_plannerdisparo` (`cr40f_plannerdisparos`): destinatário, canal, categoria, `cr40f_chaveidempotente`, status, tentativa, enviado em, erro e identificador externo.

Antes de ativar os fluxos, crie chaves alternativas para `cr40f_chavededupe` e `cr40f_chaveidempotente`. Conceda ao usuário somente leitura/gravação das próprias notificações; a conta de conexão dos fluxos deve criar notificações e disparos.

## Flow `Planner | Notificação imediata`

Provisionamento versionado: `powershell -ExecutionPolicy Bypass -File scripts/create-planner-immediate-flow.ps1` (o script atualiza pelo nome, sem duplicar).

1. Gatilho Dataverse: linha adicionada em `cr40f_plannertarefaevento`, escopo Organização.
2. Condição: `cr40f_campo` começa com `notification:`.
3. Interpretar `cr40f_valornovo` como JSON. O produtor grava `actorEmployeeId`, `creatorEmployeeId`, `previousAssigneeIds`, `assigneeIds` e, para menção, `mentionedEmployeeIds`.
4. Destinatários:
   - `notification:assignment`: responsáveis novos;
   - `notification:mention`: mencionados;
   - `notification:deadline`, `notification:status` e `notification:assignees`: criador, responsáveis anteriores e atuais;
   - sempre remover o autor e duplicados.
5. Para cada destinatário, montar chave `<evento>|<destinatario>|<tipo>` e consultar `cr40f_plannernotificacao` por `cr40f_chavededupe`. Criar somente quando ausente.
6. Resolver `cr40f_funcionarios.cr40f_usuariodataverse` e `systemuser.internalemailaddress`.
7. Sem identidade: criar `cr40f_plannerdisparo` com status `100000003` (Sem identidade). Com identidade: usar a ação atual **Postar mensagem em chat ou canal** e registrar Enviado (`100000001`) ou Falha (`100000002`), tentativa, erro e ID externo.
8. Não enviar e-mail neste fluxo. Configurar retry por destinatário para que uma falha não encerre o processamento dos demais.

## Flow `Planner | Cobrança diária`

Provisionamento versionado: `powershell -ExecutionPolicy Bypass -File scripts/create-planner-daily-flow.ps1` (o script atualiza pelo nome, sem duplicar).

1. Recorrência semanal: segunda a sexta, 08:00, fuso `America/Sao_Paulo`.
2. Buscar tarefas não concluídas/canceladas e seus vínculos em `cr40f_plannertarearesponsavel`.
3. Classificar usando a data local:
   - `due_today`: prazo igual a hoje;
   - `overdue`: prazo menor que hoje;
   - cobrança começa no vencimento e repete em cada dia útil enquanto a tarefa estiver aberta;
   - no primeiro dia útil após o vencimento, incluir também o criador.
4. Criar uma notificação interna por tarefa/destinatário/tipo/data. Chave: `<destinatario>|<tarefa>|<tipo>|<yyyy-MM-dd>`.
5. Agrupar por destinatário e enviar exatamente um resumo no Teams, com seções vencem hoje e atrasadas. Não enviar e-mail nesta primeira versão.
6. Link de cada tarefa: `new_TelaPlanner.html?data=taskId=<guid>`.
7. Registrar um disparo por canal com chave `<destinatario>|<yyyy-MM-dd>|ResumoDiario|<canal>` e os mesmos estados do fluxo imediato.

## Connection references

Os flows devem usar referências de conexão da solução para Dataverse, Teams e Office 365 Outlook. Não gravar URL de ambiente, token ou credencial nas definições.

## Validação DEV obrigatória

- Reprocessar o mesmo evento e a mesma recorrência sem duplicar linhas.
- Confirmar Teams imediato e resumo Teams/e-mail com dois usuários reais.
- Confirmar `Sem identidade` com funcionário sem `cr40f_usuariodataverse`.
- Confirmar isolamento de notificações entre criador, responsável e terceiro.
- Confirmar retry e erro final em `cr40f_plannerdisparo`.
- Confirmar que uma cobrança manual da mesma tarefa não é aceita duas vezes no mesmo dia.
