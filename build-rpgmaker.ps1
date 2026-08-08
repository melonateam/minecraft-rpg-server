$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginDir = Join-Path $root "dialogue-display-plugin"
$serverPlugin = Join-Path $root "minecraft-server-1.21.8\plugins\RPGMaker.jar"

Write-Host ""
Write-Host "========================================"
Write-Host " RPGMaker Build + Deploy"
Write-Host "========================================"
Write-Host ""

$gradle = Get-Command gradle -ErrorAction SilentlyContinue
if (-not $gradle) {
    Write-Host "ERROR: Gradle 명령을 찾을 수 없습니다."
    Write-Host "Gradle 8.x를 설치하거나 PATH에 추가한 뒤 다시 실행하세요."
    exit 1
}

Push-Location $pluginDir
try {
    gradle clean build --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "RPGMaker Gradle build failed." }
}
finally {
    Pop-Location
}

$jar = Get-ChildItem (Join-Path $pluginDir "build\libs\*.jar") |
    Where-Object { $_.Name -notmatch "-(sources|javadoc)\.jar$" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $jar) {
    Write-Host "ERROR: 빌드된 RPGMaker JAR을 찾지 못했습니다."
    exit 1
}

Copy-Item $jar.FullName $serverPlugin -Force

Write-Host ""
Write-Host "Deployed: $($jar.Name)"
Write-Host "      -> minecraft-server-1.21.8\plugins\RPGMaker.jar"
Write-Host ""
Write-Host "다음 서버 시작 로그에서 RPGMaker v1.1.0인지 확인하세요."
Write-Host "게임 내 확인: /rpgmaker web"
Write-Host "페이지 제한 확인: 최대 30페이지"
Write-Host "난수 예시: damage_roll=random(5..20)"
