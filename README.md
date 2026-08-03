# Tela Planner

Protótipo de gestão operacional de tarefas da Betinhos, inspirado em Planner/Trello e alinhado ao visual do Módulo Qualidade.

## Execução local e Dataverse

Fora de um host Dataverse com `Xrm`, a tela usa dados sintéticos persistidos em `localStorage`. Dentro do webresource, usa o cliente Dataverse e as tabelas `cr40f_plannertarefa`, `cr40f_plannertarefaevento`, `cr40f_plannertarearelacao` e `cr40f_pedidodecotacao`.

```powershell
npm install
npm run dev
```

Build do webresource inline:

```powershell
npm run check
```
