# Skill observations

### Observation 1: Redução de navegação por agrupamento semântico

**Status:** OPEN
**Date:** 2026-08-24
**Session context:** Revisão da sidebar do Tela Planner para reduzir menus.
**Skill:** intent
**Type:** open-source
**Phase/Area:** Arquitetura de informação

**Issue:** A sidebar expõe modos diferentes da mesma entidade como destinos de primeiro nível, aumentando a carga de escolha.

**Suggested improvement:** Agrupar visualizações da mesma entidade sob um destino único e manter no primeiro nível apenas objetivos operacionais distintos.

**Principle:** Menus de primeiro nível devem representar objetivos diferentes, não apenas formas diferentes de visualizar o mesmo trabalho.

### Observation 2: QA de interação revelou hook condicional

**Status:** OPEN
**Date:** 2026-08-24
**Session context:** Implementação de slot visual para arraste entre colunas do kanban.
**Skill:** playwright
**Type:** open-source
**Phase/Area:** Validação de UI e runtime React

**Issue:** Build e testes estáticos passaram, mas a primeira execução em navegador revelou erro de ordem de hooks causado por `useCallback` após retorno condicional de loading; o componente não chegava à view interativa.

**Suggested improvement:** Para alterações de interação React, incluir uma abertura real da rota e uma transição de estado de carregamento no gate de validação, mesmo quando build e testes unitários estiverem verdes.

**Principle:** Validação de compilação não prova transições de renderização; exercite o primeiro fluxo interativo em navegador.

### Observation 3: CSS responsivo não reduz árvore React

**Status:** OPEN
**Date:** 2026-08-24
**Session context:** Auditoria de uso mobile do Tela Planner.
**Skill:** smart-explore / playwright
**Type:** open-source
**Phase/Area:** Performance e responsividade

**Issue:** O quadro desktop e a lista mobile renderizam os mesmos cartões simultaneamente, e o breakpoint apenas oculta uma das árvores com CSS. A inspeção real mostrou contagens iguais nas duas árvores mesmo quando uma estava invisível.

**Suggested improvement:** Em interfaces responsivas com árvores de conteúdo grandes, escolher a variante por breakpoint/runtime e renderizar apenas a árvore ativa; usar CSS apenas para diferenças visuais locais.

**Principle:** Ocultar uma árvore responsiva com CSS não elimina o custo de renderização nem a complexidade de interação.

### Observation 4: Status operacional não deve carregar semântica de bloqueio implícita

**Status:** OPEN
**Date:** 2026-08-24
**Session context:** Remoção da lógica de bloqueio de tarefas do Planner.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Modelagem de status e escopo de domínio

**Issue:** A implementação tratava o status "Aguardando" como bloqueio, exigindo motivo, filtro, campo persistido e eventos de desbloqueio, embora o fluxo operacional só precisasse do status.

**Suggested improvement:** Separar status de tarefa de estados derivados; só adicionar bloqueio como conceito quando houver requisito explícito de dependência, motivo e operação de desbloqueio.

**Principle:** Não transformar um status simples em uma máquina de estado adicional sem uma necessidade de usuário comprovada.

### Observation 5: Feedback otimista precisa de duração mínima observável

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Depuração visual do drag/drop do Kanban com persistência otimista.
**Skill:** systematic-debugging / playwright
**Type:** open-source
**Phase/Area:** Feedback visual e animações assíncronas

**Issue:** Em operações locais resolvidas imediatamente, loading durou cerca de 26 ms e ficou imperceptível; o pós-check também animava cards que já estavam na posição final.

**Suggested improvement:** Instrumentar a timeline real do navegador, garantir duração mínima para feedback transitório e animar somente o elemento que ainda precisa mudar de posição.

**Principle:** Estado otimista rápido não pode eliminar o feedback visual que confirma a ação do usuário.

### Observation 6: Geometria de layout deve ignorar transformações de animação

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Correção visual do drag/drop do Kanban com cards animados por WAAPI.
**Skill:** animate / playwright
**Type:** open-source
**Phase/Area:** Cálculo de alvo em drag/drop

**Issue:** `getBoundingClientRect()` inclui `transform` aplicado por animação, então o card em movimento altera artificialmente o meio usado para escolher o slot “Solte aqui”.

**Suggested improvement:** Usar coordenadas estruturais (`offsetTop`/`offsetHeight`) para decisões de inserção e reservar `transform` apenas para apresentação.

**Principle:** Animação visual não deve alterar regra de posicionamento.

### Observation 7: Nova visão precisa manter o limite operacional explícito

**Status:** OPEN
**Date:** 2026-08-25
**Session context:** Criação da aba de Cotações no Tela Planner.
**Skill:** Explore Codebase / antigravity-protocol
**Type:** open-source
**Phase/Area:** Navegação e escopo de produto

**Issue:** O domínio já tinha dados de cotação e tarefas vinculadas, mas a nova aba poderia ser interpretada como ponto de criação se recebesse uma ação genérica ou reaproveitasse o fluxo de solicitação.

**Suggested improvement:** Ao criar uma visão de consulta sobre um registro existente, declarar o limite no cabeçalho e implementar somente busca, filtros, indicadores e vínculos de trabalho já existentes.

**Principle:** Uma visão operacional deve tornar seu escopo explícito e não sugerir mutações que não fazem parte do objetivo.

### Observation 8: Cobertura de eventos precisa ser verificada contra o automatizador real

**Status:** OPEN
**Date:** 2026-08-26
**Session context:** Auditoria das notificações internas do Tela Planner.
**Skill:** antigravity-protocol / database-sentinel
**Type:** open-source
**Phase/Area:** Integração frontend, Dataverse e Power Automate

**Issue:** O frontend produz eventos para atribuição, menção, prazo, status, responsáveis e aguardando, mas o script versionado que cria o Flow imediato filtra somente `notification:mention`; o resumo diário existe apenas como especificação e funções puras, sem automatizador versionado. Testes locais verdes não comprovam a cobertura no ambiente.

**Suggested improvement:** Auditar a matriz produtor -> Flow -> tabela de notificações -> leitura da UI em cada revisão de notificações, incluindo evidência de execução no ambiente e cobertura de idempotência.

**Principle:** Uma integração de eventos só está funcional quando a cobertura do produtor, do consumidor e da persistência é comprovada no mesmo ambiente.

### Observation 9: Estado expandido deve aparecer no próprio contexto da equipe

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Redesign visual da tela de equipes com geração de mockup e definição do fluxo de expansão.
**Skill:** imagegen / intent
**Type:** open-source
**Phase/Area:** Arquitetura de informação e prototipação visual

**Issue:** O pedido começou como uma crítica visual à tela estática; a direção só ficou verificável quando o mockup mostrou a equipe expandida no mesmo card, com usuários e contagem de tarefas por responsabilidade.

**Suggested improvement:** Em protótipos de interfaces com interação central, gerar ou apresentar explicitamente o estado acionado junto do estado inicial, mantendo identidade visual, conteúdo funcional e contexto espacial constantes.

**Principle:** Para validar uma interação de UI, mostre o estado após a ação no mesmo contexto; aparência isolada não prova compreensão do fluxo.
