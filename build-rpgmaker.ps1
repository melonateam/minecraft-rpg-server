$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginDir = Join-Path $root "dialogue-display-plugin"
$serverPlugin = Join-Path $root "minecraft-server-1.21.8\plugins\RPGMaker.jar"
$expectedVersion = "1.1.1"
$gradleVersion = "9.1.0"
$toolsDir = Join-Path $root ".tools"
$gradleHome = Join-Path $toolsDir "gradle-$gradleVersion"
$gradleBat = Join-Path $gradleHome "bin\gradle.bat"
$gradleZip = Join-Path $toolsDir "gradle-$gradleVersion-bin.zip"
$gradleUrl = "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip"

function Assert-LastExitCode([string]$Message) {
    if ($LASTEXITCODE -ne 0) {
        throw $Message
    }
}

function Get-NativeVersionLine([string]$CommandPath, [string[]]$Arguments) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & $CommandPath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    if ($exitCode -ne 0) {
        throw "Command failed while checking version: $CommandPath"
    }

    return [string]($output | Select-Object -First 1)
}

function Ensure-Gradle {
    $wrapper = Join-Path $pluginDir "gradlew.bat"
    if (Test-Path $wrapper) {
        Write-Host "Using Gradle wrapper."
        return $wrapper
    }

    $installed = Get-Command gradle -ErrorAction SilentlyContinue
    if ($installed) {
        Write-Host "Using Gradle from PATH: $($installed.Source)"
        return $installed.Source
    }

    if (Test-Path $gradleBat) {
        Write-Host "Using cached Gradle $gradleVersion."
        return $gradleBat
    }

    Write-Host "Gradle was not found. Bootstrapping Gradle $gradleVersion..."
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }
    catch {
        # PowerShell 7+ does not need this fallback.
    }

    if (-not (Test-Path $gradleZip)) {
        Write-Host "Downloading Gradle from services.gradle.org..."
        Invoke-WebRequest -Uri $gradleUrl -OutFile $gradleZip -UseBasicParsing
    }

    $extractRoot = Join-Path $toolsDir "gradle-extract-$gradleVersion"
    if (Test-Path $extractRoot) {
        Remove-Item $extractRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    Write-Host "Extracting Gradle..."
    Expand-Archive -Path $gradleZip -DestinationPath $extractRoot -Force

    $extractedHome = Join-Path $extractRoot "gradle-$gradleVersion"
    if (-not (Test-Path (Join-Path $extractedHome "bin\gradle.bat"))) {
        throw "Gradle archive was downloaded but the expected executable was not found."
    }

    if (Test-Path $gradleHome) {
        Remove-Item $gradleHome -Recurse -Force
    }
    Move-Item $extractedHome $gradleHome
    Remove-Item $extractRoot -Recurse -Force

    if (-not (Test-Path $gradleBat)) {
        throw "Gradle bootstrap failed."
    }

    Write-Host "Gradle $gradleVersion is ready."
    return $gradleBat
}

Write-Host ""
Write-Host "========================================"
Write-Host " RPGMaker Build + Deploy"
Write-Host "========================================"
Write-Host ""

$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) {
    Write-Host "ERROR: Java was not found in PATH."
    Write-Host "Install a JDK or add Java to PATH, then run this script again."
    exit 1
}

$javaVersion = Get-NativeVersionLine $java.Source @("-version")
Write-Host "Java: $javaVersion"
$gradleCommand = Ensure-Gradle

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
    throw "RPGMaker.jar was not found after deployment: $serverPlugin"
}

$jarTool = Get-Command jar -ErrorAction SilentlyContinue
if (-not $jarTool) {
    Write-Host "WARNING: JDK jar command was not found. JAR content verification is skipped."
}
else {
    $entries = & $jarTool.Source tf $serverPlugin
    Assert-LastExitCode "Unable to read RPGMaker.jar contents."

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
        Write-Host "ERROR: Required entries are missing from the new JAR:"
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
Write-Host "Fully stop and restart the Minecraft server, then verify:"
Write-Host "  1. Startup log shows RPGMaker v$expectedVersion"
Write-Host "  2. /rpgmaker web creates the web-editor link"
Write-Host "  3. Dialogue page limit is 30"
Write-Host "  4. Random variable effect works: damage_roll=random(5..20)"
Write-Host ""
Write-Host "Do not rely on /reload for this update; restart the server process."
