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
  Invoke-RestMethod -Method Patch -Uri "$apiBaseUrl/webresourceset($webResourceId)" -Headers $headers -ContentType "application/json; charset=utf-8" -Body (@{ displayname = "Tela Planner"; content = $content } | ConvertTo-Json) | Out-Null
}

if (-not $NoPublish) {
  Write-Step "publicando $resourceName"
  $publishXml = "<importexportxml><webresources><webresource>$webResourceId</webresource></webresources></importexportxml>"
  Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/PublishXml" -Headers $headers -ContentType "application/json; charset=utf-8" -Body (@{ ParameterXml = $publishXml } | ConvertTo-Json) | Out-Null

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
    Invoke-RestMethod -Method Patch -Uri "$apiBaseUrl/sitemaps($sitemapId)" -Headers $headers -ContentType "application/json; charset=utf-8" -Body (@{ sitemapxml = $updatedSitemapXml } | ConvertTo-Json) | Out-Null
    Write-Step "Planner adicionado ao grupo Operacional"
  }
  else {
    Write-Step "Planner já está no grupo Operacional; nenhuma duplicação feita"
  }

  Write-Step "publicando sitemap do app"
  $sitemapPublishXml = "<importexportxml><sitemaps><sitemap>$sitemapId</sitemap></sitemaps></importexportxml>"
  Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/PublishXml" -Headers $headers -ContentType "application/json; charset=utf-8" -Body (@{ ParameterXml = $sitemapPublishXml } | ConvertTo-Json) | Out-Null
}

Write-Step "concluído: $resourceName ($webResourceId)"
