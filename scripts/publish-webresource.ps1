param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [switch] $DeviceCode,
  [switch] $NoPublish
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) { Write-Host "[publish-webresource] $Message" }
function Escape-OData([string] $Value) { return $Value.Replace("'", "''") }
function Publish-XmlWithRetry([hashtable] $Headers, [string] $ApiBaseUrl, [string] $ParameterXml, [string] $Label) {
  for ($attempt = 1; $attempt -le 7; $attempt++) {
    try {
      Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/PublishXml" -Headers $Headers -ContentType "application/json; charset=utf-8" -Body (@{ ParameterXml = $ParameterXml } | ConvertTo-Json) -ErrorAction Stop | Out-Null
      return
    }
    catch {
      $message = $_.Exception.Message
      if ($message -notmatch "0x80071151|another \[Import\] running" -or $attempt -eq 7) { throw }
      Write-Step "$Label bloqueado por importação concorrente; nova tentativa em 10s ($attempt/6)"
      Start-Sleep -Seconds 10
    }
  }
}
function Update-RecordWithRetry([hashtable] $Headers, [string] $Uri, [string] $Body, [string] $Label) {
  for ($attempt = 1; $attempt -le 7; $attempt++) {
    try {
      Invoke-RestMethod -Method Patch -Uri $Uri -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $Body -ErrorAction Stop | Out-Null
      return
    }
    catch {
      $message = $_.Exception.Message
      if ($message -notmatch "0x80071151|0x80048543|another \[Import\] running|currently being imported" -or $attempt -eq 7) { throw }
      Write-Step "$Label bloqueado por importação concorrente; nova tentativa em 10s ($attempt/6)"
      Start-Sleep -Seconds 10
    }
  }
}

function Get-ResponseStatusCode($ErrorRecord) {
  try { return [int] $ErrorRecord.Exception.Response.StatusCode } catch { return 0 }
}

function New-DataverseLabel([string] $Text) {
  return @{
    "@odata.type" = "Microsoft.Dynamics.CRM.Label"
    LocalizedLabels = @(@{
      "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"
      Label = $Text
      LanguageCode = 1046
    })
  }
}

function Get-EntityMetadata([hashtable] $Headers, [string] $ApiBaseUrl, [string] $LogicalName) {
  $escapedName = Escape-OData $LogicalName
  try {
    return Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/EntityDefinitions(LogicalName='$escapedName')?`$select=MetadataId,LogicalName,EntitySetName,PrimaryNameAttribute" -Headers $Headers -ErrorAction Stop
  }
  catch {
    if ((Get-ResponseStatusCode $_) -eq 404) { return $null }
    throw
  }
}

function Invoke-MetadataPost([hashtable] $Headers, [string] $Uri, [string] $Body, [string] $Label) {
  for ($attempt = 1; $attempt -le 7; $attempt++) {
    try {
      return Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $Body -ErrorAction Stop
    }
    catch {
      $message = $_.Exception.Message
      if ($message -notmatch "0x80040216|0x80060891|0x80071151|another customization operation|another \[Import\] running|currently being imported" -or $attempt -eq 7) { throw }
      Write-Step "$Label aguardando propagação de metadata; nova tentativa em 5s ($attempt/6)"
      Start-Sleep -Seconds 5
    }
  }
}

function Wait-EntityMetadata([hashtable] $Headers, [string] $ApiBaseUrl, [string] $LogicalName) {
  for ($attempt = 1; $attempt -le 10; $attempt++) {
    $metadata = Get-EntityMetadata -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName $LogicalName
    if ($metadata) { return $metadata }
    Start-Sleep -Seconds 3
  }
  throw "Metadata da tabela $LogicalName não ficou disponível após a criação."
}

function Ensure-PlannerTable([hashtable] $Headers, [string] $ApiBaseUrl, [string] $LogicalName, [string] $SchemaName, [string] $PrimaryName, [string] $DisplayName, [string] $CollectionName, [string] $EntitySetName) {
  $metadata = Get-EntityMetadata -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName $LogicalName
  if (-not $metadata) {
    Write-Step "criando tabela $LogicalName na solution $solutionUniqueName"
    $body = @{
      "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
      SchemaName = $SchemaName
      DisplayName = New-DataverseLabel $DisplayName
      DisplayCollectionName = New-DataverseLabel $CollectionName
      Description = New-DataverseLabel "Tabela própria do Planner interno."
      OwnershipType = "OrganizationOwned"
      HasActivities = $false
      HasNotes = $false
      IsActivity = $false
      PrimaryNameAttribute = $PrimaryName.ToLowerInvariant()
      Attributes = @(@{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName = $PrimaryName
        DisplayName = New-DataverseLabel "Nome"
        RequiredLevel = @{ Value = "ApplicationRequired" }
        MaxLength = 100
        IsPrimaryName = $true
      })
    } | ConvertTo-Json -Depth 12
    try {
      Invoke-MetadataPost -Headers $Headers -Uri "$ApiBaseUrl/EntityDefinitions" -Body $body -Label $LogicalName | Out-Null
    }
    catch {
      $metadata = Get-EntityMetadata -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName $LogicalName
      if (-not $metadata) { throw }
    }
    $metadata = Wait-EntityMetadata -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName $LogicalName
  }

  if ($metadata.PrimaryNameAttribute -ne $PrimaryName.ToLowerInvariant()) {
    throw "Tabela $LogicalName já existe, mas usa atributo principal '$($metadata.PrimaryNameAttribute)' em vez de '$($PrimaryName.ToLowerInvariant())'. Deploy abortado."
  }
  if ($metadata.EntitySetName -ne $EntitySetName) {
    throw "Tabela $LogicalName já existe, mas EntitySetName é '$($metadata.EntitySetName)' em vez de '$EntitySetName'. Deploy abortado."
  }
  return $metadata
}

function Get-PlannerRelationship([hashtable] $Headers, [string] $ApiBaseUrl, [string] $ReferencingEntity, [string] $ReferencingAttribute, [string] $ReferencedEntity) {
  $escapedEntity = Escape-OData $ReferencingEntity
  $relationships = Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/EntityDefinitions(LogicalName='$escapedEntity')/ManyToOneRelationships?`$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName" -Headers $Headers -ErrorAction Stop
  return @($relationships.value) | Where-Object {
    $_.ReferencingAttribute -ieq $ReferencingAttribute -and $_.ReferencedEntity -ieq $ReferencedEntity
  } | Select-Object -First 1
}

function Ensure-PlannerRelationship([hashtable] $Headers, [string] $ApiBaseUrl, [string] $SchemaName, [string] $ReferencingEntity, [string] $ReferencingAttribute, [string] $ReferencedEntity, [string] $DisplayName) {
  $existing = Get-PlannerRelationship -Headers $Headers -ApiBaseUrl $ApiBaseUrl -ReferencingEntity $ReferencingEntity -ReferencingAttribute $ReferencingAttribute -ReferencedEntity $ReferencedEntity
  if ($existing) { return }

  Write-Step "criando relacionamento $SchemaName"
  $body = @{
    "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
    SchemaName = $SchemaName
    ReferencedEntity = $ReferencedEntity
    ReferencingEntity = $ReferencingEntity
    Lookup = @{
      "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
      SchemaName = $ReferencingAttribute
      DisplayName = New-DataverseLabel $DisplayName
      RequiredLevel = @{ Value = "None" }
    }
    CascadeConfiguration = @{
      Delete = "RemoveLink"
      Assign = "NoCascade"
      Share = "NoCascade"
      Unshare = "NoCascade"
      Merge = "NoCascade"
      Reparent = "NoCascade"
    }
  } | ConvertTo-Json -Depth 12
  try {
    Invoke-MetadataPost -Headers $Headers -Uri "$ApiBaseUrl/RelationshipDefinitions" -Body $body -Label $SchemaName | Out-Null
  }
  catch {
    $existing = Get-PlannerRelationship -Headers $Headers -ApiBaseUrl $ApiBaseUrl -ReferencingEntity $ReferencingEntity -ReferencingAttribute $ReferencingAttribute -ReferencedEntity $ReferencedEntity
    if (-not $existing) { throw }
  }
}

function Ensure-PlannerSchema([hashtable] $Headers, [string] $ApiBaseUrl) {
  Ensure-PlannerTable -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName "cr40f_plannerequipe" -SchemaName "cr40f_PlannerEquipe" -PrimaryName "cr40f_Nome" -DisplayName "Equipe do Planner" -CollectionName "Equipes do Planner" -EntitySetName "cr40f_plannerequipes" | Out-Null
  Ensure-PlannerTable -Headers $Headers -ApiBaseUrl $ApiBaseUrl -LogicalName "cr40f_plannerequipemembro" -SchemaName "cr40f_PlannerEquipeMembro" -PrimaryName "cr40f_Name" -DisplayName "Membro da Equipe do Planner" -CollectionName "Membros das Equipes do Planner" -EntitySetName "cr40f_plannerequipemembros" | Out-Null
  Ensure-PlannerRelationship -Headers $Headers -ApiBaseUrl $ApiBaseUrl -SchemaName "cr40f_PlannerEquipeMembro_Equipe" -ReferencingEntity "cr40f_plannerequipemembro" -ReferencingAttribute "cr40f_Equipe" -ReferencedEntity "cr40f_plannerequipe" -DisplayName "Equipe"
  Ensure-PlannerRelationship -Headers $Headers -ApiBaseUrl $ApiBaseUrl -SchemaName "cr40f_PlannerEquipeMembro_Funcionario" -ReferencingEntity "cr40f_plannerequipemembro" -ReferencingAttribute "cr40f_Funcionario" -ReferencedEntity "cr40f_funcionarios" -DisplayName "Funcionário"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
$environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"
$solutionUniqueName = "AppBetinhos"
$resourceName = "new_TelaPlanner.html"
$resourcePath = Join-Path $root "dist\webresource.html"
$sitemapId = "787c8fda-53d0-f011-8543-6045bd3a51ea"
$operationalGroupId = "group_16b0a016"
$plannerSubAreaId = "subarea_tela_planner"

if (-not (Test-Path -LiteralPath $resourcePath)) { throw "Webresource não encontrado: $resourcePath. Execute npm run build primeiro." }
if (-not (Get-Module -ListAvailable MSAL.PS)) { throw "Módulo MSAL.PS não encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser" }
Import-Module MSAL.PS -ErrorAction Stop

Write-Step "validando solution $solutionUniqueName"
$scope = "$environmentBaseUrl/user_impersonation"
$clientApplication = New-MsalClientApplication -ClientId $ClientId -TenantId $TenantId -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication
try { $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $scope -Silent }
catch {
  if ($DeviceCode) { $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $scope -DeviceCode }
  else { $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $scope -Interactive }
}
if ([string]::IsNullOrWhiteSpace($tokenResult.AccessToken)) { throw "Falha ao obter token MSAL para $scope" }

$headers = @{
  Authorization = "Bearer $($tokenResult.AccessToken)"
  Accept = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
  "MSCRM.SolutionUniqueName" = $solutionUniqueName
}
$solutionFilter = Escape-OData $solutionUniqueName
$solution = Invoke-RestMethod -Method Get -Uri "$apiBaseUrl/solutions?`$select=solutionid,uniquename&`$filter=uniquename eq '$solutionFilter'" -Headers $headers
if (-not $solution.value -or $solution.value.Count -eq 0) { throw "Solution $solutionUniqueName não encontrada. Deploy abortado." }
if ($solution.value.Count -gt 1) { throw "Mais de uma solution $solutionUniqueName encontrada. Deploy abortado." }

Write-Step "validando schema do Planner"
Ensure-PlannerSchema -Headers $headers -ApiBaseUrl $apiBaseUrl

$escapedName = Escape-OData $resourceName
$lookupUri = "$apiBaseUrl/webresourceset?`$select=webresourceid,name,displayname,webresourcetype&`$filter=name eq '$escapedName'"
$lookup = Invoke-RestMethod -Method Get -Uri $lookupUri -Headers $headers
if ($lookup.value -and $lookup.value.Count -gt 1) { throw "Mais de um WebResource encontrado para $resourceName. Deploy abortado." }

$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($resourcePath))
$body = @{ name = $resourceName; displayname = "Tela Planner"; webresourcetype = 1; content = $content } | ConvertTo-Json -Depth 4
$webResourceId = $null

if (-not $lookup.value -or $lookup.value.Count -eq 0) {
  Write-Step "criando $resourceName na solution $solutionUniqueName"
  Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/webresourceset" -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body | Out-Null
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUri -Headers $headers
  $webResourceId = $lookup.value[0].webresourceid
}
else {
  $webResourceId = $lookup.value[0].webresourceid
  if ($lookup.value[0].webresourcetype -ne 1) { throw "$resourceName já existe, mas não é HTML. Deploy abortado." }
  Write-Step "atualizando $resourceName"
  Update-RecordWithRetry -Headers $headers -Uri "$apiBaseUrl/webresourceset($webResourceId)" -Body (@{ displayname = "Tela Planner"; content = $content } | ConvertTo-Json) -Label $resourceName
}

if (-not $NoPublish) {
  Write-Step "publicando $resourceName"
  $publishXml = "<importexportxml><webresources><webresource>$webResourceId</webresource></webresources></importexportxml>"
  Publish-XmlWithRetry -Headers $headers -ApiBaseUrl $apiBaseUrl -ParameterXml $publishXml -Label $resourceName

  Write-Step "validando navegação do app Model Driven Betinhos"
  $sitemap = Invoke-RestMethod -Method Get -Uri "$apiBaseUrl/sitemaps($sitemapId)?`$select=sitemapxml" -Headers $headers
  $sitemapXml = [string] $sitemap.sitemapxml
  if ([string]::IsNullOrWhiteSpace($sitemapXml)) { throw "Sitemap $sitemapId não retornou XML. Deploy abortado." }

  if ($sitemapXml -notmatch [regex]::Escape("Id=`"$plannerSubAreaId`"")) {
    $groupPattern = '(<Group\b[^>]*\bId="' + $operationalGroupId + '"[^>]*>[\s\S]*?)(</Group>)'
    $groupMatch = [regex]::Match($sitemapXml, $groupPattern)
    if (-not $groupMatch.Success) { throw "Grupo Operacional não encontrado no sitemap. Deploy abortado." }

    $plannerSubArea = '<SubArea Id="subarea_tela_planner" ResourceId="SitemapDesigner.NewSubArea" VectorIcon="/WebResources/cr40f_sitemap_clipboard_list.svg" Icon="/_imgs/imagestrips/transparent_spacer.gif" Url="$webresource:new_TelaPlanner.html" Client="All,Outlook,OutlookLaptopClient,OutlookWorkstationClient,Web" AvailableOffline="true" PassParams="false" Sku="All,OnPremise,Live,SPLA"><Titles><Title LCID="1046" Title="Planner" /></Titles></SubArea>'
    $replacement = $groupMatch.Groups[1].Value + $plannerSubArea + $groupMatch.Groups[2].Value
    $updatedSitemapXml = $sitemapXml.Remove($groupMatch.Index, $groupMatch.Length).Insert($groupMatch.Index, $replacement)
    Update-RecordWithRetry -Headers $headers -Uri "$apiBaseUrl/sitemaps($sitemapId)" -Body (@{ sitemapxml = $updatedSitemapXml } | ConvertTo-Json) -Label "Sitemap"
    Write-Step "Planner adicionado ao grupo Operacional"
  }
  else {
    Write-Step "Planner já está no grupo Operacional; nenhuma duplicação feita"
  }

  Write-Step "publicando sitemap do app"
  $sitemapPublishXml = "<importexportxml><sitemaps><sitemap>$sitemapId</sitemap></sitemaps></importexportxml>"
  Publish-XmlWithRetry -Headers $headers -ApiBaseUrl $apiBaseUrl -ParameterXml $sitemapPublishXml -Label "Sitemap"
}

Write-Step "concluído: $resourceName ($webResourceId)"
