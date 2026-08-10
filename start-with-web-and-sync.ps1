$ErrorActionPreference = 'Stop'

# Resolve the repository root from this script's own location.
$RepoPath          = $PSScriptRoot
$WebPath           = Join-Path $RepoPath 'rpgmaker-web-editor'
$ServerPath        = Join-Path $RepoPath 'minecraft-server-1.21.8'
$PluginProjectPath = Join-Path $RepoPath 'dialogue-display-plugin'
$PluginJar         = Join-Path $ServerPath 'plugins\RPGMaker.jar'
$StartBat          = Join-Path $ServerPath 'start.bat'
$SyncScript        = Join-Path $RepoPath 'sync.ps1'
$BundledJavaHome   = Join-Path $ServerPath 'runtime\jdk-25.0.4+7-jre'

$GradleVersion = '9.1.0'
$GradleSha256  = 'a17ddd85a26b6a7f5ddb71ff8b05fc5104c0202c6e64782429790c933686c806'
$ToolsPath     = Join-Path $RepoPath '.tools'
$GradleHome    = Join-Path $ToolsPath "gradle-$GradleVersion"
$GradleBat     = Join-Path $GradleHome 'bin\gradle.bat'
$GradleZip     = Join-Path $ToolsPath "gradle-$GradleVersion-bin.zip"
$GradleUrl     = "https://services.gradle.org/distributions/gradle-$GradleVersion-bin.zip"

$webProcess = $null
$serverExitCode = $null

function Ensure-Gradle {
    if (Test-Path -LiteralPath $GradleBat) {
        return
    }

    New-Item -ItemType Directory -Force -Path $ToolsPath | Out-Null

    if (-not (Test-Path -LiteralPath $GradleZip)) {
        Write-Host "Gradle $GradleVersion is not cached. Downloading it once..."
        $previousProgressPreference = $ProgressPreference
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -UseBasicParsing -Uri $GradleUrl -OutFile $GradleZip
        }
        finally {
            $ProgressPreference = $previousProgressPreference
        }
    }

    $actualHash = (Get-FileHash -LiteralPath $GradleZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $GradleSha256) {
        Remove-Item -LiteralPath $GradleZip -Force -ErrorAction SilentlyContinue
        throw "Gradle download checksum mismatch. Expected $GradleSha256 but got $actualHash."
    }

    Remove-Item -LiteralPath $GradleHome -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -LiteralPath $GradleZip -DestinationPath $ToolsPath -Force
    Remove-Item -LiteralPath $GradleZip -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path -LiteralPath $GradleBat)) {
        throw "Gradle $GradleVersion was downloaded but gradle.bat was not found: $GradleBat"
    }
}

try {
    if (-not (Test-Path -LiteralPath $WebPath)) {
        throw "Web editor directory not found: $WebPath"
    }

    if (-not (Test-Path -LiteralPath $PluginProjectPath)) {
        throw "RPGMaker plugin project not found: $PluginProjectPath"
    }

    if (-not (Test-Path -LiteralPath $StartBat)) {
        throw "Minecraft start.bat not found: $StartBat"
    }

    if (-not (Test-Path -LiteralPath (Join-Path $BundledJavaHome 'bin\java.exe'))) {
        throw "Bundled Java runtime not found: $BundledJavaHome"
    }

    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Building RPGMaker Plugin'
    Write-Host '========================================'

    Ensure-Gradle

    $previousJavaHome = $env:JAVA_HOME
    $previousPath = $env:Path
    try {
        # Gradle 9.1 can run on the server's bundled Java 25 runtime.
        # The build requests Java 21 and the Foojay toolchain resolver provisions it automatically when needed.
        $env:JAVA_HOME = $BundledJavaHome
        $env:Path = (Join-Path $BundledJavaHome 'bin') + ';' + $previousPath

        & $GradleBat -p $PluginProjectPath deployToServer --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) {
            throw "RPGMaker plugin deployment failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        if ($null -eq $previousJavaHome) {
            Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue
        }
        else {
            $env:JAVA_HOME = $previousJavaHome
        }
        $env:Path = $previousPath
    }

    if (-not (Test-Path -LiteralPath $PluginJar)) {
        throw "RPGMaker plugin JAR was not created: $PluginJar"
    }

    Write-Host 'RPGMaker plugin deployed.'
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Starting RPGMaker Web Editor'
    Write-Host '========================================'

    $webProcess = Start-Process `
        -FilePath 'cmd.exe' `
        -ArgumentList '/d', '/c', 'npm run dev' `
        -WorkingDirectory $WebPath `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "Web editor started. PID: $($webProcess.Id)"
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Starting Minecraft Server'
    Write-Host '========================================'

    Push-Location $ServerPath
    try {
        # Run the original start.bat in this console so Minecraft console input works normally.
        # Build CMD quoting explicitly; backslashes do not escape quotes in cmd.exe.
        $cmdLine = 'call ' + [char]34 + $StartBat + [char]34
        & cmd.exe /d /c $cmdLine
        $serverExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Stopping RPGMaker Web Editor'
    Write-Host '========================================'

    if ($webProcess -and -not $webProcess.HasExited) {
        & taskkill.exe /PID $webProcess.Id /T /F | Out-Null
    }

    Write-Host 'Web editor stopped.'

    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Code-Only Git Sync'
    Write-Host '========================================'

    if (-not (Test-Path -LiteralPath $SyncScript)) {
        Write-Warning "Code sync script not found: $SyncScript"
    }
    else {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $SyncScript
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Code sync failed with exit code $LASTEXITCODE"
        }
    }

    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Done'
    Write-Host '========================================'
}

if ($null -ne $serverExitCode -and $serverExitCode -ne 0) {
    exit $serverExitCode
}
