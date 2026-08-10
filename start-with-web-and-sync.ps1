param(
    [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'

# Resolve the repository root from this script's own location.
$RepoPath          = $PSScriptRoot
$WebPath           = Join-Path $RepoPath 'rpgmaker-web-editor'
$ServerPath        = Join-Path $RepoPath 'minecraft-server-1.21.8'
$PluginProjectPath = Join-Path $RepoPath 'dialogue-display-plugin'
$PluginJar         = Join-Path $ServerPath 'plugins\RPGMaker.jar'
$StartBat          = Join-Path $ServerPath 'start.bat'
$SyncScript        = Join-Path $RepoPath 'sync.ps1'

$GradleVersion = '9.1.0'
$GradleSha256  = 'a17ddd85a26b6a7f5ddb71ff8b05fc5104c0202c6e64782429790c933686c806'
$ToolsPath     = Join-Path $RepoPath '.tools'
$GradleHome    = Join-Path $ToolsPath "gradle-$GradleVersion"
$GradleBat     = Join-Path $GradleHome 'bin\gradle.bat'
$GradleZip     = Join-Path $ToolsPath "gradle-$GradleVersion-bin.zip"
$GradleUrl     = "https://services.gradle.org/distributions/gradle-$GradleVersion-bin.zip"

$JdkMajor      = '21'
$JdkHome       = Join-Path $ToolsPath 'temurin-jdk-21'
$JdkZip        = Join-Path $ToolsPath 'temurin-jdk-21.zip'
$JdkExtract    = Join-Path $ToolsPath '.temurin-jdk-21-extract'
$JdkApiUrl     = "https://api.adoptium.net/v3/binary/latest/$JdkMajor/ga/windows/x64/jdk/hotspot/normal/eclipse"
$BuildLog      = Join-Path $ToolsPath 'rpgmaker-gradle-build.log'

$webProcess = $null
$serverExitCode = $null

function Ensure-Tls12 {
    if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12) {
        return
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

function Get-RedirectLocation([string]$Uri) {
    $location = $null
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -MaximumRedirection 0 -ErrorAction Stop
        $location = $response.Headers['Location']
    }
    catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $location = $response.Headers['Location']
        }
        if (-not $location) {
            throw
        }
    }

    if ($location -is [System.Array]) {
        $location = $location[0]
    }
    if (-not $location) {
        throw "Download service did not return a redirect URL: $Uri"
    }
    return [string]$location
}

function Ensure-Gradle {
    if (Test-Path -LiteralPath $GradleBat) {
        return
    }

    New-Item -ItemType Directory -Force -Path $ToolsPath | Out-Null
    Ensure-Tls12

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

function Ensure-Jdk21 {
    $javac = Join-Path $JdkHome 'bin\javac.exe'
    $java = Join-Path $JdkHome 'bin\java.exe'
    if ((Test-Path -LiteralPath $javac) -and (Test-Path -LiteralPath $java)) {
        return
    }

    New-Item -ItemType Directory -Force -Path $ToolsPath | Out-Null
    Ensure-Tls12

    Write-Host 'Temurin JDK 21 is not cached. Downloading it once...'
    $downloadUrl = Get-RedirectLocation $JdkApiUrl
    $checksumUrl = $downloadUrl + '.sha256.txt'

    Remove-Item -LiteralPath $JdkZip -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $JdkExtract -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $JdkHome -Recurse -Force -ErrorAction SilentlyContinue

    $previousProgressPreference = $ProgressPreference
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $JdkZip
        $checksumText = (Invoke-WebRequest -UseBasicParsing -Uri $checksumUrl).Content
    }
    finally {
        $ProgressPreference = $previousProgressPreference
    }

    $expectedHash = (($checksumText.Trim() -split '\s+')[0]).ToLowerInvariant()
    $actualHash = (Get-FileHash -LiteralPath $JdkZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $expectedHash -or $actualHash -ne $expectedHash) {
        Remove-Item -LiteralPath $JdkZip -Force -ErrorAction SilentlyContinue
        throw "Temurin JDK 21 checksum mismatch. Expected $expectedHash but got $actualHash."
    }

    New-Item -ItemType Directory -Force -Path $JdkExtract | Out-Null
    Expand-Archive -LiteralPath $JdkZip -DestinationPath $JdkExtract -Force
    Remove-Item -LiteralPath $JdkZip -Force -ErrorAction SilentlyContinue

    $javacFile = Get-ChildItem -LiteralPath $JdkExtract -Filter 'javac.exe' -File -Recurse |
        Where-Object { $_.Directory.Name -eq 'bin' } |
        Select-Object -First 1
    if ($null -eq $javacFile) {
        Remove-Item -LiteralPath $JdkExtract -Recurse -Force -ErrorAction SilentlyContinue
        throw 'Temurin JDK 21 archive did not contain bin\javac.exe.'
    }

    $candidateHome = Split-Path -Parent (Split-Path -Parent $javacFile.FullName)
    Move-Item -LiteralPath $candidateHome -Destination $JdkHome
    Remove-Item -LiteralPath $JdkExtract -Recurse -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path -LiteralPath $javac) -or -not (Test-Path -LiteralPath $java)) {
        throw "Temurin JDK 21 was extracted but is incomplete: $JdkHome"
    }
}

function Deploy-RpgMakerPlugin {
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Building RPGMaker Plugin'
    Write-Host '========================================'

    Ensure-Gradle
    Ensure-Jdk21

    $previousJavaHome = $env:JAVA_HOME
    $previousPath = $env:Path
    try {
        # Use one complete JDK for both Gradle itself and Java compilation.
        # This avoids depending on the server's runtime-only JRE or Gradle toolchain auto-provisioning.
        $env:JAVA_HOME = $JdkHome
        $env:Path = (Join-Path $JdkHome 'bin') + ';' + $previousPath

        Remove-Item -LiteralPath $BuildLog -Force -ErrorAction SilentlyContinue
        & $GradleBat -p $PluginProjectPath deployToServer --no-daemon --console=plain --stacktrace 2>&1 |
            Tee-Object -FilePath $BuildLog
        $gradleExitCode = $LASTEXITCODE
        if ($gradleExitCode -ne 0) {
            throw "RPGMaker plugin deployment failed with exit code $gradleExitCode. Full Gradle log: $BuildLog"
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
}

try {
    if (-not (Test-Path -LiteralPath $PluginProjectPath)) {
        throw "RPGMaker plugin project not found: $PluginProjectPath"
    }

    Deploy-RpgMakerPlugin

    if ($BuildOnly) {
        Write-Host 'Build-only validation completed.'
        return
    }

    if (-not (Test-Path -LiteralPath $WebPath)) {
        throw "Web editor directory not found: $WebPath"
    }

    if (-not (Test-Path -LiteralPath $StartBat)) {
        throw "Minecraft start.bat not found: $StartBat"
    }

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
    if (-not $BuildOnly) {
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
}

if ($null -ne $serverExitCode -and $serverExitCode -ne 0) {
    exit $serverExitCode
}
