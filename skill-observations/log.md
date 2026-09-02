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

### Observation 10: Provisionamento parcial precisa falhar antes da publicação

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Diagnóstico de erro de metadata do lookup de equipe no Planner em PROD.
**Skill:** antigravity-protocol / dataverse:dv-metadata
**Type:** open-source
**Phase/Area:** Schema Dataverse e publicação de webresource

**Issue:** O runtime validava em tempo de uso um lookup obrigatório, mas o script de publicação validava apenas tabelas e Entity Sets e permitia ambiente com schema parcial. O erro só apareceu quando uma operação tentou resolver a navegação do lookup.

**Suggested improvement:** Tratar cada campo lookup usado pelo runtime como contrato de publicação: validar atributo, entidade referenciada, nome de navegação e tabelas relacionais antes de publicar o webresource; abortar com diagnóstico explícito quando qualquer item divergir.

**Principle:** Deploy de integração só deve ser considerado válido quando o metadata mínimo exigido pelo caminho de execução foi verificado, não apenas quando tabelas principais existem.

### Observation 11: Feedback sonoro precisa separar gesto e confirmação

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Adição de efeito sonoro ao concluir tarefas no Tela Planner.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Feedback de operações assíncronas

**Issue:** A persistência da conclusão pode terminar depois do clique que iniciou a operação; criar o contexto de áudio somente no callback de sucesso pode ser bloqueado pela política de autoplay do navegador.

**Suggested improvement:** Preparar o recurso de áudio dentro do gesto do usuário, tocar somente após a confirmação da operação e tratar bloqueios do navegador como fallback silencioso que nunca altera o resultado da mutação.

**Principle:** Feedback multimídia de uma operação assíncrona deve respeitar tanto a confirmação do estado quanto as políticas de ativação do ambiente.

### Observation 12: Comparação sonora deve ser iterável antes da escolha

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Criação de prévia local para escolher o efeito de conclusão do Tela Planner.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Prototipação de feedback multimídia

**Issue:** Uma descrição subjetiva como “mais de conclusão” não define timbre, duração ou grau de comemoração com precisão suficiente para escolher um único efeito por inspeção de código.

**Suggested improvement:** Oferecer uma página local mínima com variações nomeadas e acionáveis, mantendo a implementação produtiva separada até o usuário selecionar uma opção.

**Principle:** Para decisões subjetivas de feedback, comparação direta reduz ciclos e evita codificar preferências presumidas.

### Observation 13: Brilho percebido exige variação de registro e textura

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Refinamento da prévia local de sons de conclusão do Tela Planner.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Design sonoro de feedback

**Issue:** Cinco variações com a mesma faixa de frequência e envelope soam como pequenas mudanças do mesmo efeito, mesmo quando recebem nomes diferentes.

**Suggested improvement:** Variar deliberadamente registro, onda, sobreposição e desenho temporal entre opções, mantendo cada uma curta e comparável.

**Principle:** Variação perceptível depende de propriedades sonoras distintas, não apenas de rótulos ou pequenas mudanças de frequência.

### Observation 14: Escolha explícita deve fechar o ciclo da prévia

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Aplicação da opção 3 escolhida pelo usuário no som de conclusão do Tela Planner.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Seleção e implementação de feedback multimídia

**Issue:** A prévia local só gera valor quando a opção escolhida é aplicada ao fluxo produtivo sem alterar as demais regras da operação.

**Suggested improvement:** Manter a opção selecionada reproduzível entre prévia e produção e validar que a mudança ficou restrita ao feedback, sem tocar na persistência da task.

**Principle:** Protótipo comparável precisa ter caminho direto e verificável até a implementação escolhida.

### Observation 15: Volume percebido precisa ser validado no ambiente real

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Ajuste de volume do som de conclusão do Tela Planner após teste do usuário.
**Skill:** antigravity-protocol / karpathy-coder
**Type:** open-source
**Phase/Area:** Feedback multimídia e validação

**Issue:** Limites de ganho escolhidos no código podem deixar o efeito inaudível dependendo do volume do dispositivo e do ambiente de reprodução.

**Suggested improvement:** Tratar volume como parte da validação interativa, aumentando o ganho com margem segura e mantendo a prévia alinhada ao efeito produtivo.

**Principle:** Feedback sonoro deve ser calibrado por escuta no ambiente-alvo, não apenas por valores numéricos no código.

### Observation 16: Normalização não deve interromper digitação textual

**Status:** OPEN
**Date:** 2026-09-02
**Session context:** Correção dos campos textuais do modal de Aguardando no Tela Planner.
**Skill:** systematic-debugging / antigravity-protocol
**Type:** open-source
**Phase/Area:** Formulários React controlados e normalização de domínio

**Issue:** O estado normalizado era reaplicado a cada tecla e removia espaços finais; isso impedia continuar palavras em inputs e textareas controlados.

**Suggested improvement:** Preservar o valor bruto durante a edição e aplicar trim somente em validação, resumo ou persistência; cobrir cada campo textual com regressão de espaço.

**Principle:** Normalização de domínio não deve destruir caracteres transitórios necessários para a próxima edição do usuário.

### Observation 17: Loader de save não deve aguardar refresh global

**Status:** OPEN
**Date:** 2026-09-02
**Session context:** Otimização do salvamento no drawer do Tela Planner.
**Skill:** web-performance-optimization / antigravity-protocol
**Type:** open-source
**Phase/Area:** Persistência otimista e feedback assíncrono

**Issue:** A confirmação de uma edição de tarefa aguardava uma leitura global de todas as entidades, fazendo o loader variar com o volume e a latência de dados não necessários para concluir a ação.

**Suggested improvement:** Separar a confirmação mínima da mutação do refresh completo; atualizar o estado local confirmado e invalidar somente detalhes que precisam ser reconsultados.

**Principle:** Feedback de uma mutação deve depender do trabalho necessário para confirmar aquela mutação, não de uma atualização global não relacionada.
