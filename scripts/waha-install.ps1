param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot ".env.waha.local"
$sessionsPath = Join-Path $projectRoot ".waha-sessions"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker não foi encontrado. Instale o Docker Desktop e ative o backend WSL2."
}

if (-not (Test-Path -LiteralPath $envPath)) {
  $apiKey = (([Guid]::NewGuid().ToString("N")) + ([Guid]::NewGuid().ToString("N")))
  $dashboardPassword = (([Guid]::NewGuid().ToString("N")) + ([Guid]::NewGuid().ToString("N")))
  $content = @("WAHA_API_KEY=$apiKey", "WAHA_DASHBOARD_USERNAME=betinhos", "WAHA_DASHBOARD_PASSWORD=$dashboardPassword") -join [Environment]::NewLine
  [IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))
  Write-Host "Criado .env.waha.local com chaves aleatórias. Não compartilhe esse arquivo."
}

New-Item -ItemType Directory -Force -Path $sessionsPath | Out-Null
docker compose version | Out-Host
docker compose --env-file $envPath -f (Join-Path $projectRoot "docker-compose.waha.yml") pull
docker compose --env-file $envPath -f (Join-Path $projectRoot "docker-compose.waha.yml") up -d
Write-Host "WAHA iniciado em http://127.0.0.1:3000. Dashboard: http://127.0.0.1:3000/dashboard"
