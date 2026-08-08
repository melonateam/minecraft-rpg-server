$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginDir = Join-Path $root "dialogue-display-plugin"
$serverPlugin = Join-Path $root "minecraft-server-1.21.8\plugins\RPGMaker.jar"
$expectedVersion = "1.1.1"

function Assert-LastExitCode([string]$Message) {
    if ($LASTEXITCODE -ne 0) {
        throw $Message
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host " RPGMaker Build + Deploy"
Write-Host "========================================"
Write-Host ""

$gradleCommand = $null
$wrapper = Join-Path $pluginDir "gradlew.bat"
if (Test-Path $wrapper) {
    $gradleCommand = $wrapper
}
else {
    $gradle = Get-Command gradle -ErrorAction SilentlyContinue
    if ($gradle) {
        $gradleCommand = $gradle.Source
    }
}

if (-not $gradleCommand) {
    Write-Host "ERROR: Gradle을 찾을 수 없습니다."
    Write-Host "Gradle 8.x를 설치해 PATH에 추가한 뒤 다시 실행하세요."
    Write-Host "현재 프로젝트에는 Gradle wrapper가 포함되어 있지 않습니다."
    exit 1
}

Write-Host "Building RPGMaker v$expectedVersion..."
Push-Location $pluginDir
try {
    & $gradleCommand clean deployToServer --no-daemon
    Assert-LastExitCode "RPGMaker Gradle build/deploy failed."
}
finally {
    Pop-Location
}

if (-not (Test-Path $serverPlugin)) {
    throw "배포 후 RPGMaker.jar을 찾지 못했습니다: $serverPlugin"
}

$jarTool = Get-Command jar -ErrorAction SilentlyContinue
if (-not $jarTool) {
    Write-Host "WARNING: JDK jar 명령을 찾지 못해 클래스 검증을 건너뜁니다."
}
else {
    $entries = & $jarTool.Source tf $serverPlugin
    Assert-LastExitCode "RPGMaker.jar 내용을 읽지 못했습니다."

    $requiredEntries = @(
        "kr/hyuni/dialogue/DialogueDisplayPlugin.class",
        "kr/hyuni/dialogue/DialogueWebApi.class",
        "kr/hyuni/dialogue/DialogueCompatibilityService.class",
        "kr/hyuni/dialogue/ExpressionRules.class",
        "rpgmaker-character-manifest.json",
        "plugin.yml"
    )

    $missing = @($requiredEntries | Where-Object { $_ -notin $entries })
    if ($missing.Count -gt 0) {
        Write-Host "ERROR: 새 JAR에 필수 파일이 없습니다:"
        $missing | ForEach-Object { Write-Host "  - $_" }
        exit 1
    }
}

$hash = (Get-FileHash $serverPlugin -Algorithm SHA256).Hash
$size = (Get-Item $serverPlugin).Length

Write-Host ""
Write-Host "Deployment verified."
Write-Host "  File: minecraft-server-1.21.8\plugins\RPGMaker.jar"
Write-Host "  Expected plugin version: $expectedVersion"
Write-Host "  Size: $size bytes"
Write-Host "  SHA256: $hash"
Write-Host ""
Write-Host "서버를 완전히 재시작한 뒤 아래 항목을 확인하세요."
Write-Host "  1. 시작 로그: RPGMaker v$expectedVersion"
Write-Host "  2. /rpgmaker web 명령이 웹 에디터 링크를 생성"
Write-Host "  3. 대화 최대 페이지: 30"
Write-Host "  4. 변수 난수: damage_roll=random(5..20)"
Write-Host ""
Write-Host "주의: /reload로는 기존 JAR 클래스가 완전히 교체되지 않을 수 있으므로 서버 재시작을 권장합니다."
