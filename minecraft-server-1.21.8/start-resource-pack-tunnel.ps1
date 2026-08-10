param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$serverRoot = $PSScriptRoot
$cloudflared = Join-Path $serverRoot 'cloudflared.exe'
$serverJava = Join-Path $serverRoot 'runtime\jdk-25.0.4+7-jre\bin\java.exe'
$log = Join-Path $serverRoot 'logs\resource-pack-tunnel.log'

$tunnels = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'cloudflared.exe' -and $_.ExecutablePath -eq $cloudflared
}

if ($Stop) {
    $tunnels | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    return
}

# Do not use world/session.lock to determine whether Paper is running. On OneDrive
# or while antivirus/indexing tools inspect the world, that file can be locked even
# after Paper has stopped, which produces a false "server is already running" error.
# The bundled Java executable is specific to this server launcher, so check the
# actual Paper process instead.
$serverProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'java.exe' -and
    $_.ExecutablePath -eq $serverJava -and
    $_.CommandLine -match '(?i)(^|\s|")paper\.jar("|\s|$)'
}
if ($serverProcesses) {
    throw 'Minecraft server is already running; refusing to replace its resource-pack tunnel.'
}

# No Paper process is using this server. Any matching cloudflared process is stale
# from a previous run and can be replaced safely.
$tunnels | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

New-Item -ItemType Directory -Path (Split-Path $log) -Force | Out-Null
Set-Content -LiteralPath $log -Value '' -Encoding UTF8
Start-Process -FilePath $cloudflared -ArgumentList @(
    '--no-autoupdate', 'tunnel', '--url', 'http://127.0.0.1:25566',
    '--logfile', 'logs/resource-pack-tunnel.log', '--loglevel', 'info'
) -WorkingDirectory $serverRoot -WindowStyle Hidden

$publicBase = $null
for ($i = 0; $i -lt 60 -and -not $publicBase; $i++) {
    Start-Sleep -Milliseconds 500
    $match = Select-String -LiteralPath $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue
    if ($match) { $publicBase = $match.Matches[-1].Value }
}
if (-not $publicBase) { throw 'RPGMaker resource-pack tunnel did not start.' }

$config = Get-Content -LiteralPath (Join-Path $serverRoot 'plugins\RPGMaker\config.yml') -Raw -Encoding UTF8
$packName = [regex]::Match($config, '(?m)^pack-file:\s*(.+)$').Groups[1].Value.Trim()
if (-not $packName) { throw 'RPGMaker pack-file is missing.' }

$propertiesPath = Join-Path $serverRoot 'server.properties'
$properties = Get-Content -LiteralPath $propertiesPath -Raw -Encoding UTF8
$packUrl = "$publicBase/$packName" -replace ':', '\:'
$properties = $properties -replace '(?m)^resource-pack=.*$', "resource-pack=$packUrl"
$promptText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('UlBHTWFrZXIg66as7IaM7Iqk7Yyp7J2EIOuLpOyatOuhnOuTnO2VqeuLiOuLpC4='))
$properties = $properties -replace '(?m)^resource-pack-prompt=.*$', "resource-pack-prompt={`"text`"\:`"$promptText`",`"color`"\:`"gold`"}"
Set-Content -LiteralPath $propertiesPath -Value $properties -Encoding UTF8
Write-Host "Resource pack: $publicBase/$packName"
