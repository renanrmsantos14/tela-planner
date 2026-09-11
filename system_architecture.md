# Arquitetura: triagem leve do WhatsApp no Planner

## Fluxo do MVP

1. A extensão MV3 observa apenas o WhatsApp Web visível e mantém uma fila local.
2. O recorte mínimo, mascarado, é enviado ao Cloudflare Worker `/v1/triage`.
3. Se o DOM só fornecer um `@lid`, a extensão faz uma única consulta ao WAHA local para obter o telefone; não existe polling de chats.
4. A colaboradora aprova ou descarta a classificação no popup da extensão.
5. A extensão encaminha o intake por `postMessage` para uma aba autenticada do Planner.
6. O Planner valida origem, nonce, `requestId` e payload; depois usa o adapter para criar ou atualizar Contato e Task.

## Limites intencionais

- O WAHA/Docker é opcional e limitado a um container GOWS local; não há CRM paralelo, Redis ou worker local da extensão.
- O container não baixa mídia, escuta somente em `127.0.0.1` e persiste apenas a sessão do WhatsApp.
- Não há envio automático de mensagens nem captura de mídia.
- O adapter mock cobre o fluxo; o adapter live permanece bloqueado até o metadata DEV real de Contatos ser confirmado.
- A aprovação humana é obrigatória e a chave de idempotência é o `requestId` do intake.
