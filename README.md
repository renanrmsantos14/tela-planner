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

Publicação no Dataverse DEV (WebResource + plugin nativo de notificações):

```powershell
npm run push
```

Além de publicar o WebResource e verificar/criar as tabelas próprias de equipes do Planner, o comando compila e cria/atualiza o plugin `PlannerTaskEventNotificationPlugin` na solução `AppBetinhos`.

O usuário autenticado precisa ter permissão para atualizar a solução. Para executar o plugin com uma conta técnica dedicada, defina `DV_PLUGIN_USER` e use o script diretamente:

```powershell
.\scripts\push-dev.ps1 -DeviceCode -TechnicalUserEmail $env:DV_PLUGIN_USER
```

Se o login MSAL exigir outro aplicativo público, defina também `DV_CLIENT_ID` com o GUID (não o nome) do registro Azure AD. Sem essa variável, o push usa o ClientId público padrão.
