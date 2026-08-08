$ErrorActionPreference = 'Stop'

# Resolve the repository root from this script's own location.
$RepoPath   = $PSScriptRoot
$WebPath    = Join-Path $RepoPath 'rpgmaker-web-editor'
$ServerPath = Join-Path $RepoPath 'minecraft-server-1.21.8'
$StartBat   = Join-Path $ServerPath 'start.bat'
$SyncScript = Join-Path $RepoPath 'sync.ps1'

$webProcess = $null
$serverExitCode = $null

try {
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
