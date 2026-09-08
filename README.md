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

## Importação do Microsoft Planner

O caminho recomendado é o card “Importar tarefas” dentro do WebResource. No localhost, a opção automática autentica a conta Microsoft, carrega os planos disponíveis pelo nome, busca todas as páginas de tarefas e buckets e consulta descrições/checklists em lotes internos de até 20 tarefas. O usuário não precisa montar lotes nem copiar URLs: apenas seleciona o plano, revisa e confirma antes de gravar. A mesma jornada grava somente no mock e “Restaurar mock” volta ao cenário inicial.

### Login Microsoft no localhost

1. Copie `.env.example` para `.env.local` e preencha `VITE_MSAL_CLIENT_ID` e `VITE_MSAL_TENANT_ID`.
2. No Microsoft Entra ID, registre `http://localhost:5192/redirect.html` em **Authentication > Single-page application > Redirect URIs**. Não use `127.0.0.1`.
3. Em **API permissions**, adicione permissões delegadas do Microsoft Graph: `User.Read`, `Tasks.Read` e `User.ReadBasic.All`. Conceda consentimento administrativo quando o tenant exigir.
4. Inicie com `npm run dev` e abra exatamente `http://localhost:5192/`.
5. Abra **Importar tarefas**, conecte a conta que tem acesso ao plano, selecione o plano pelo nome e clique em **Buscar e preparar tudo**.

O servidor não troca automaticamente para outra porta: a porta `5192` precisa estar livre porque ela é a mesma cadastrada no Microsoft Entra ID.

Se a conta não puder consultar o diretório, o app avisa e permite o mapeamento manual dos responsáveis. O script abaixo permanece como alternativa automatizada fora do WebResource.

Pré-requisitos no Windows PowerShell 5.1:

```powershell
Install-Module Microsoft.Graph.Authentication -Scope CurrentUser
Install-Module MSAL.PS -Scope CurrentUser
```

Simulação, sem gravar no Dataverse:

```powershell
.\scripts\import-planner.ps1 `
  -PlanId "ID_DO_PLANO" `
  -EmployeeMapPath ".\planner-employee-map.json" `
  -DryRun
```

Importação real para o Dataverse DEV:

```powershell
.\scripts\import-planner.ps1 `
  -PlanId "ID_DO_PLANO" `
  -EmployeeMapPath ".\planner-employee-map.json" `
  -DeviceCode
```

O arquivo de mapeamento aceita um objeto simples:

```json
{
  "ID_MICROSOFT_DO_USUARIO": "GUID_DO_FUNCIONARIO_DATAVERSE"
}
```

Antes da importação real, publique a alteração de schema que cria `cr40f_checklistjson`. O importador salva um snapshot e um relatório em `output/planner-import/`, permite reexecução sem duplicar pela chave `MSPLANNER:<id>` e mantém tarefas sem correspondência de responsável no relatório.
