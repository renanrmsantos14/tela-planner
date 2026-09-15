# Design QA — Inbox de notificações

## Referências

- Fonte visual: `C:\Users\mendo\AppData\Local\Temp\codex-clipboard-21dc2332-eb7f-49b8-9588-b15980f30dc3.png`
- Implementação validada: `tmp/notification-inbox-implementation.png`
- Viewport: 1440 × 1100 CSS px
- Estado: quadro local com a Inbox aberta na aba “Todas”

## Comparação

- Cabeçalho, abas, navegação e demais elementos do Planner foram preservados.
- A lista usa uma hierarquia compacta por linha: mensagem orientada à ação, título relacionado, contexto/equipe, tempo e um único chevron.
- Rótulos técnicos foram removidos da linha visual; a data/tempo recebeu maior peso e contraste.
- Altura, espaçamento e quantidade de controles foram reduzidos conforme o pedido, sem perder a área clicável da notificação.

## Interação validada

- Abrir a task manualmente pelo quadro marca como lidas todas as notificações não lidas vinculadas àquela task.
- Abrir uma notificação de task usa o mesmo fluxo e atualiza o contador da Inbox.
- Console do navegador: 0 erros, 0 warnings.

## Achados

- P0: nenhum.
- P1: nenhum.
- P2: nenhum.
- P3: os títulos, equipes e tempos do mock local diferem do screenshot de referência por serem dados de demonstração.

## Resultado

final result: passed
