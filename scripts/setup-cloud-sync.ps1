param(
  [string]$PrivateRoot = "D:\LifeLog-Private-Archive"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$cloudRoot = Join-Path $repoRoot "cloud-sync"
$nodeBin = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$pnpmBin = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback"
$pnpm = Join-Path $pnpmBin "pnpm.cmd"
$env:PATH = "$nodeBin;$pnpmBin;$env:PATH"
$configPath = Join-Path $PrivateRoot "life-log-cloud-config.json"
$activationPath = Join-Path $PrivateRoot "life-log-iphone-activation.txt"
$secretPath = Join-Path $PrivateRoot "cloudflare-deploy-secrets.json"

function Invoke-Wrangler {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $output = & $pnpm dlx wrangler@latest @Arguments 2>&1
  $code = $LASTEXITCODE
  $text = ($output | Out-String)
  if ($code -ne 0) { throw $text.Trim() }
  return $text
}

function Write-Utf8Json {
  param([string]$Path, $Value)
  $json = $Value | ConvertTo-Json -Depth 12
  [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
  [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function New-SyncToken {
  $bytes = New-Object byte[] 48
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

[IO.Directory]::CreateDirectory($PrivateRoot) | Out-Null

Push-Location $cloudRoot
try {
  $identity = Invoke-Wrangler whoami
  if ($identity -match "not authenticated|not logged in|please run.*login") {
    throw "Cloudflare is not authorized. Double-click scripts\authorize-cloudflare.cmd, finish the browser approval, then run this setup again."
  }

  $token = $null
  if (Test-Path -LiteralPath $configPath) {
    try {
      $saved = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
      if ([string]$saved.token -and ([string]$saved.token).Length -ge 32) { $token = [string]$saved.token }
    } catch {}
  }
  if (-not $token) { $token = New-SyncToken }

  $databaseName = "life-log-sync-db"
  $databaseList = Invoke-Wrangler d1 list --json | ConvertFrom-Json
  $database = $databaseList | Where-Object { $_.name -eq $databaseName } | Select-Object -First 1
  if (-not $database) {
    Invoke-Wrangler d1 create $databaseName --location apac | Out-Null
    $databaseList = Invoke-Wrangler d1 list --json | ConvertFrom-Json
    $database = $databaseList | Where-Object { $_.name -eq $databaseName } | Select-Object -First 1
  }
  if (-not $database.uuid) { throw "D1 database could not be created or located." }

  $wrangler = [ordered]@{
    '$schema' = "node_modules/wrangler/config-schema.json"
    name = "life-log-sync"
    main = "src/worker.js"
    compatibility_date = "2026-08-12"
    workers_dev = $true
    vars = [ordered]@{ ALLOWED_ORIGIN = "https://b5s474n4f8-ship-it.github.io" }
    d1_databases = @([ordered]@{
      binding = "DB"
      database_name = $databaseName
      database_id = [string]$database.uuid
    })
    observability = [ordered]@{ enabled = $true }
  }
  Write-Utf8Json (Join-Path $cloudRoot "wrangler.jsonc") $wrangler

  Invoke-Wrangler d1 migrations apply DB --remote | Out-Null
  Write-Utf8Json $secretPath ([ordered]@{ SYNC_TOKEN = $token })
  try {
    $deployOutput = Invoke-Wrangler deploy --secrets-file $secretPath
  } finally {
    Remove-Item -LiteralPath $secretPath -Force -ErrorAction SilentlyContinue
  }

  $urlMatch = [regex]::Match($deployOutput, "https://[a-zA-Z0-9.-]+\.workers\.dev")
  if (-not $urlMatch.Success) { throw "Worker deployed, but its URL was not found in Wrangler output." }
  $workerUrl = $urlMatch.Value.TrimEnd("/")

  $newline = [Environment]::NewLine
  $publicConfig = 'window.LIFE_LOG_SYNC_CONFIG = window.LIFE_LOG_SYNC_CONFIG || {' + $newline + '  workerUrl: "' + $workerUrl + '"' + $newline + '};' + $newline
  [IO.File]::WriteAllText((Join-Path $repoRoot "sync-config.js"), $publicConfig, (New-Object Text.UTF8Encoding($false)))

  $privateConfig = [ordered]@{
    version = 1
    workerUrl = $workerUrl
    token = $token
    archiveRoot = (Join-Path $PrivateRoot "cloud")
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  Write-Utf8Json $configPath $privateConfig

  $activationUrl = "https://b5s474n4f8-ship-it.github.io/life-log-v2/#sync=$token"
  [IO.File]::WriteAllText($activationPath, $activationUrl + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))

  try {
    $aclUser = $env:USERNAME + ":(OI)(CI)F"
    & icacls.exe $PrivateRoot /inheritance:r /grant:r $aclUser | Out-Null
  } catch {
    Write-Warning "Private-folder ACL could not be tightened automatically. Files still remain outside the public repository."
  }

  $health = Invoke-RestMethod -Uri "$workerUrl/health" -Method Get
  if (-not $health.ok) { throw "Worker health check failed." }

  Write-Output "CLOUD_SYNC_READY"
  Write-Output "Worker: $workerUrl"
  Write-Output "Private config: $configPath"
  Write-Output "One-time iPhone activation link: $activationPath"
  Write-Output "Next: publish GitHub Pages, then open the private activation link once on the iPhone."
} finally {
  Pop-Location
}
