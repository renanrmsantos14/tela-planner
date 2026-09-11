param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot ".env.waha.local"
$composePath = Join-Path $projectRoot "docker-compose.waha.yml"

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Arquivo .env.waha.local não existe. Execute scripts/waha-install.ps1 uma vez."
}

docker compose --env-file $envPath -f $composePath up -d
docker compose --env-file $envPath -f $composePath ps
