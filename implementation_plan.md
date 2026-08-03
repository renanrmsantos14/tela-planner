# Tela Planner — plano inicial do módulo

## Objetivo

Criar um webresource de gestão operacional de tarefas para a Betinhos, com experiência inspirada em Planner/Trello e linguagem visual alinhada ao `Módulo Qualidade`. O Dataverse será a fonte oficial dos dados; a interface será uma camada rápida de operação e acompanhamento.

O primeiro caso de uso será Pedido de Cotação, usando o contrato já existente no repo `Tela Preview Cotações`.

## Referência visual adotada

Fonte: `C:\Users\mendo\Desktop\vscode\Módulo Qualidade`.

- Manrope e tipografia operacional compacta.
- Navy profundo para marca e estrutura; azul somente para ação, foco, seleção e estados funcionais.
- Canvas cinza claro, surfaces brancas e superfícies neutras em `#FCFCFB` para listas, campos, buscas e cabeçalhos.
- Bordas leves, raio de 10–12 px, sombras discretas e no máximo três níveis de superfície.
- App shell com navegação lateral recolhível, cabeçalho de página, cards de métrica, badges, tabelas/listas e drawer lateral.
- Motion curto, funcional, interruptível e compatível com `prefers-reduced-motion`.
- Tokens versionados e validação automática; não criar nova paleta, fonte, radius, shadow ou breakpoint sem decisão explícita.

## MVP funcional

1. Dashboard operacional com tarefas abertas, vencidas, para hoje e por responsável.
2. Quadro Kanban com colunas de status e drag-and-drop.
3. Lista operacional com busca, filtros e ordenação.
4. Drawer de tarefa com título, descrição, responsável, prioridade, prazo, etiquetas, vínculo e histórico.
5. Criação de tarefa a partir de uma cotação.
6. Detalhe da cotação acessível a partir da tarefa.
7. Visão de agenda/calendário para prazos.
8. Feedback de carregamento, sucesso, erro, vazio e operação offline/sem resposta.
9. Permissões e autoria respeitando Dataverse.

## Primeiro fluxo: cotação

Fluxo pretendido:

`Pedido de Cotação → Criar tarefa operacional → Atribuir responsável → Acompanhar prazo/status → Concluir → Registrar resultado`

Contrato conhecido no repo de referência:

- Tabela: `cr40f_pedidodecotacao`.
- Prazo: `cr40f_prazoresponder`.
- Nome/título: `cr40f_titulo`.
- Integração já documentada: `cr40f_plannertaskid`, `cr40f_linktarefaplanner` e `cr40f_linkmensagemteams`.

Esses nomes serão revalidados no metadata live antes de payload, lookup, filtro ou automação. Não criar aliases por aproximação.

## Modelo de domínio conceitual

O MVP precisa de:

- Quadro/área de trabalho.
- Coluna/status.
- Tarefa.
- Participante/responsável.
- Etiqueta.
- Comentário/histórico.
- Relação da tarefa com registro operacional, começando por cotação.

Os logical names e tipos das novas tabelas/colunas ficam pendentes de consulta ao Dataverse. A implementação deve separar domínio, cliente Dataverse e componentes visuais para permitir mock local e testes sem escrita externa.

## Arquitetura inicial

- React + Vite, seguindo o padrão do `Módulo Qualidade`.
- `src/domain.*`: regras de status, prioridade, filtros, ordenação e normalização.
- `src/dataverse.*`: única camada de leitura/escrita e metadata.
- `src/views.*`: shell, dashboard, board, lista e agenda.
- `src/forms.*`: drawer de criação/edição e detalhes.
- `src/styles.css` + tokens derivados: linguagem visual do módulo.
- Build inline para webresource e verificação de encoding.
- Logging global de erros e diagnóstico com contexto de tela/registro.

## Fases

### Fase 0 — contrato e metadata

- Confirmar tabelas, colunas, choices, lookups e permissões no ambiente alvo.
- Definir se tarefa será tabela própria ou extensão de uma tabela existente.
- Definir relação tarefa ↔ cotação e comportamento de sincronização.
- Fechar nomenclatura, status e critérios de conclusão.

### Fase 1 — fundação visual e mock

- Reproduzir tokens e shell aprovados do `Módulo Qualidade`.
- Criar mock persistente com tarefas e cotações representativas.
- Entregar dashboard, board, lista e drawer sem escrita Dataverse.
- Validar UX com o fluxo de cotação antes da integração.

### Fase 2 — Dataverse

- Implementar consultas, criação, atualização e vínculo com base no metadata confirmado.
- Revalidar após salvar e tratar concorrência/registro removido.
- Exibir erros técnicos de forma segura e mensagem operacional curta.

Modelo DEV criado e validado em 2026-08-03:

- `cr40f_plannertarefa`: tarefa operacional, status, prioridade, prazo, origem, bloqueio, responsável, equipe e vínculos tipados com cotação/qualidade.
- `cr40f_plannertarefaevento`: histórico append-only de criação, alteração, status, atribuição e bloqueios.
- `cr40f_plannertarearelacao`: relação pai/subtarefa com dois lookups para `cr40f_plannertarefa`; usada porque o autorrelacionamento direto falhou no provisionamento MCP.
- Comentários/anexos: `annotation.objectid` apontando para `cr40f_plannertarefa`.

O cliente live fica isolado em `src/dataverse.js`, resolve navegação de lookup por metadata em runtime e marca `cr40f_origemultimasincronizacao = Planner` na cotação para impedir loops de automação.

### Fase 3 — integração de cotação

- Abrir o Planner a partir de uma cotação.
- Criar tarefa com título e prazo derivados da cotação.
- Mostrar vínculo de volta para a cotação.
- Integrar Power Automate/Teams somente depois do contrato base estar estável.
- Evitar loops usando campos de integração fora dos gatilhos de sincronização quando aplicável.

### Fase 4 — webresource e publicação

- Gerar bundle inline.
- Validar build, testes, encoding e tamanho.
- Publicar somente após smoke test no Dataverse.

## Critérios de aceite do MVP

- Usuário localiza uma cotação e cria uma tarefa em poucos passos.
- A tarefa aparece no board, lista e agenda com o mesmo estado.
- Alterar status, responsável ou prazo persiste e reaparece após recarregar.
- O drawer mantém contexto sem perder filtros ou posição do usuário.
- O vínculo da cotação é navegável e não duplica o registro original.
- Loading, erro, vazio e ausência de conexão têm tratamento visível.
- Visual mantém tokens, densidade, superfícies, acessibilidade e motion do `Módulo Qualidade`.
- Testes e build passam antes de qualquer publicação.

## Decisões pendentes

1. Nome funcional do módulo e nome do webresource.
2. Tarefa própria no Dataverse ou aproveitamento de entidade existente.
3. Status oficiais do board.
4. Responsável individual, equipe ou ambos.
5. Necessidade de comentários/anexos no MVP.
6. Ambiente Dataverse alvo para a primeira validação.

## Próximo passo

Fazer a consulta de metadata do Dataverse para fechar o modelo de tarefa e, em paralelo, criar a primeira tela mock do board com o visual herdado do `Módulo Qualidade`.

## Plano de correção: performance + frontend quebrado

### Evidência local

- `npm test`: 7 testes passando.
- `npm run build`: Vite, inline webresource e verificação de encoding passando; bundle inline validado.
- Graphify em `src`: 59 nós e 137 arestas; `App.jsx` concentra renderização e derivacões de estado.
- `App.jsx`: filtros/ordenação repetidos em board, lista, agenda e dashboard; `Intl.DateTimeFormat` recriado durante render; callbacks e listas de opções recriados a cada render.
- `domain.js`: `taskStats` faz quatro varreduras; `formatDate`/`formatLongDate` recriam formatadores; filtro não normaliza acentos.
- `SearchableSelect.jsx`: listeners globais e reposicionamento por scroll/resize precisam ser limitados ao estado aberto e atualizados sem trabalho redundante.

### Escopo de implementação

- `[MODIFY] src/domain.js`: cachear formatadores, normalizar busca uma vez por tarefa e calcular estatísticas em uma passada, preservando contratos e resultados.
- `[MODIFY] src/App.jsx`: memoizar derivações por tela, estabilizar opções/callbacks de selects e corrigir ações visuais sem handler (`Novo prazo`, botão de filtros e adicionar subtarefa) para não parecerem quebradas; manter DOM e comportamento existente.
- `[MODIFY] src/SearchableSelect.jsx`: reduzir reposicionamentos redundantes e garantir cleanup/estado correto ao fechar, sem alterar teclado, busca, multi-select ou acessibilidade.
- `[MODIFY] tests/domain.test.mjs`, `[MODIFY] tests/mockStore.test.mjs`: cobrir busca sem acento, estatísticas e regressões dos handlers.
- `[MODIFY] src/styles.css` somente se a validação visual confirmar overflow, overlay ou estado disabled quebrado; sem redesign.

### Critérios de aceite

1. `npm run check` passa.
2. Nenhum listener global fica ativo com select fechado; cleanup permanece idempotente.
3. Board/lista/agenda mantêm os mesmos registros, filtros, ordem e ações.
4. Botões visíveis sem função passam a executar a ação correspondente ou ficam explicitamente desabilitados.
5. Bundle inline continua gerado e validado; nenhuma publicação externa será feita nesta etapa.

### Fora de escopo

- Integração Dataverse/metadata live.
- Mudança de modelo visual, rotas, payloads ou contrato de webresource.
- Benchmark de produção sem ambiente publicado.
