# Canton CRO — 2-participant health check
# Requires: OpenJDK 17+, vendor/canton-open-source-3.5.8
# CRITICAL on Turkish Windows: force en_US locale or Daml-LF breaks on "TIME" -> "TİME"

$ErrorActionPreference = "Stop"
# scripts/ -> localnet/ -> repo root
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$CantonHome = Join-Path $Root "vendor\canton-open-source-3.5.8"
if (-not (Test-Path "$CantonHome\bin\canton.bat")) {
  throw "Canton not found at $CantonHome — extract canton-open-source-3.5.8 into vendor/"
}
$OutDir = Join-Path $Root "localnet\out"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$jdk = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $jdk) { throw "OpenJDK 17 not found under C:\Program Files\Microsoft\" }

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
# Fix Turkish locale uppercasing i -> İ which corrupts Daml-LF identifiers
$env:JAVA_TOOL_OPTIONS = "-Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8"

$config = "examples\01-simple-topology\simple-topology.conf"
$script = "examples\01-simple-topology\simple-ping.canton"
$logFile = Join-Path $OutDir "health-check-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

Write-Host "CantonHome: $CantonHome"
Write-Host "JAVA_HOME:  $env:JAVA_HOME"
Write-Host "Log:        $logFile"

Push-Location $CantonHome
try {
  # Truncate previous canton.log so we can isolate this run
  $cantonLog = Join-Path $CantonHome "log\canton.log"
  if (Test-Path $cantonLog) { Clear-Content $cantonLog -ErrorAction SilentlyContinue }

  & .\bin\canton.bat run $script -c $config --log-level-stdout=WARN 2>&1 |
    Tee-Object -FilePath $logFile
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

$proof = Join-Path $OutDir "ping-proof.txt"
$lines = @()
if (Test-Path (Join-Path $CantonHome "log\canton.log")) {
  $lines = Select-String -Path (Join-Path $CantonHome "log\canton.log") -Pattern `
    "Starting ping|responding to a ping|Observed archival of ping|Successfully submitted ping|Shutdown complete|ERROR|fatal|T.ME" |
    ForEach-Object { $_.Line }
}
$lines | Set-Content -Path $proof -Encoding utf8

Write-Host ""
Write-Host "=== PING PROOF ==="
$lines | ForEach-Object { Write-Host $_ }

$ok = ($code -eq 0) -and ($lines -match "Observed archival of ping").Count -gt 0
if ($ok) {
  Write-Host "`nRESULT: OK — participant2 pinged participant1"
  exit 0
} else {
  Write-Host "`nRESULT: FAIL — exit=$code (see $logFile and $proof)"
  exit 1
}
