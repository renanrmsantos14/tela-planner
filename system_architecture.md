# Arquitetura: triagem leve do WhatsApp no Planner

## Fluxo do MVP

1. A extensão MV3 observa apenas o WhatsApp Web visível e mantém uma fila local.
2. O recorte mínimo, mascarado, é enviado ao Cloudflare Worker `/v1/triage`.
3. A colaboradora aprova ou descarta a classificação no popup da extensão.
4. A extensão encaminha o intake por `postMessage` para uma aba autenticada do Planner.
5. O Planner valida origem, nonce, `requestId` e payload; depois usa o adapter para criar ou atualizar Contato e Task.

## Limites intencionais

- Não há QR code próprio, WAHA, Docker, Redis, worker local ou CRM paralelo.
- Não há envio automático de mensagens nem captura de mídia.
- O adapter mock cobre o fluxo; o adapter live permanece bloqueado até o metadata DEV real de Contatos ser confirmado.
- A aprovação humana é obrigatória e a chave de idempotência é o `requestId` do intake.
