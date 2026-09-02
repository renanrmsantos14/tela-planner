param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TechnicalUserEmail = "",
  [switch] $DeviceCode
)

if (-not $TechnicalUserEmail) {
  $TechnicalUserEmail = [Environment]::GetEnvironmentVariable("DV_PLUGIN_USER")
}

# O registro Dataverse usa MSAL.PS, que precisa do Windows PowerShell nesta máquina.
if ($PSVersionTable.PSEdition -eq "Core" -or $PSHOME -like "*codex-runtimes*") {
  $windowsPowerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath, "-EnvironmentUrl", $EnvironmentUrl)
  if ($TechnicalUserEmail) { $arguments += @("-TechnicalUserEmail", $TechnicalUserEmail) }
  if ($DeviceCode) { $arguments += "-DeviceCode" }
  & $windowsPowerShell @arguments
  exit $LASTEXITCODE
}

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Write-Step([string] $Message) { Write-Host "[push-dev] $Message" }
function Assert-ExitCode([string] $Label) { if ($LASTEXITCODE -ne 0) { throw "$Label falhou com exit code $LASTEXITCODE." } }

Write-Step "build e testes do WebResource"
npm test
Assert-ExitCode "npm test"
npm run build
Assert-ExitCode "npm run build"

Write-Step "publicacao do WebResource no Dataverse DEV"
$publishArgs = @("-EnvironmentUrl", $EnvironmentUrl)
if ($DeviceCode) { $publishArgs += "-DeviceCode" }
& (Join-Path $PSScriptRoot "publish-webresource.ps1") @publishArgs
Assert-ExitCode "publish-webresource"

Write-Step "build do plugin PlannerNotifications"
$pluginProject = Join-Path $root "power-platform\plugins\PlannerNotifications\PlannerNotifications.csproj"
dotnet build $pluginProject --configuration Release
Assert-ExitCode "dotnet build PlannerNotifications"
$dllPath = Join-Path $root "power-platform\plugins\PlannerNotifications\bin\Release\net462\Betinhos.Planner.Notifications.dll"
if (-not (Test-Path -LiteralPath $dllPath -PathType Leaf)) { throw "DLL do plugin nao foi gerada: $dllPath" }

Write-Step "registro/atualizacao do plugin na solucao AppBetinhos"
$pluginArgs = @(
  "-EnvironmentUrl", $EnvironmentUrl,
  "-DllPath", $dllPath,
  "-SolutionUniqueName", "AppBetinhos",
  "-Apply",
  "-AddExistingToSolution"
)
if ($TechnicalUserEmail) { $pluginArgs += @("-TechnicalUserEmail", $TechnicalUserEmail) }
if ($DeviceCode) { $pluginArgs += "-DeviceCode" }
& (Join-Path $PSScriptRoot "register-planner-notification-plugin.ps1") @pluginArgs
Assert-ExitCode "registro do plugin"

Write-Step "push concluido: WebResource e plugin atualizados"
