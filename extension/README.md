# Extensão Betinhos · WhatsApp para Planner

Extensão Manifest V3 para Chrome/Edge. Não usa WAHA, Docker ou o CRM completo.

## Desenvolvimento local

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta `extension/`.
5. Abra o WhatsApp Web e mantenha uma aba autenticada do Planner aberta.

O endpoint da IA fica configurável no popup. Nunca coloque `DEEPSEEK_API_KEY` nesta pasta.

## Contrato da triagem

O service worker chama `POST /v1/triage` e espera `TriageResult` em JSON. O Planner recebe somente entradas aprovadas pela colaboradora via bridge `postMessage`.
