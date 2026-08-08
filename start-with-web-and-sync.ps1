$ErrorActionPreference = 'Stop'

$RepoPath   = 'C:\Users\hyun\OneDrive\문서\ChatGPT\New project'
$WebPath    = Join-Path $RepoPath 'rpgmaker-web-editor'
$ServerPath = Join-Path $RepoPath 'minecraft-server-1.21.8'
$StartBat   = Join-Path $ServerPath 'start.bat'
$GitSync    = Join-Path $RepoPath 'git-sync.ps1'

$webProcess = $null

try {
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Starting RPGMaker Web Editor'
    Write-Host '========================================'

    $webProcess = Start-Process `
        -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'npm run dev' `
        -WorkingDirectory $WebPath `
        -PassThru

    Write-Host "Web editor started. PID: $($webProcess.Id)"
    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Starting Minecraft Server'
    Write-Host '========================================'

    Push-Location $ServerPath
    try {
        # Run the original start.bat in this console so Minecraft console input works normally.
        $cmdLine = 'call "' + $StartBat + '"'
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
    Write-Host ' Running Git Sync'
    Write-Host '========================================'

    if (Test-Path $GitSync) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $GitSync
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "git-sync.ps1 exited with code $LASTEXITCODE"
        }
    }
    else {
        Write-Warning "git-sync.ps1 not found: $GitSync"
    }

    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Done'
    Write-Host '========================================'
}

if ($null -ne $serverExitCode -and $serverExitCode -ne 0) {
    exit $serverExitCode
}
