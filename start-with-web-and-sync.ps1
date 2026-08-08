$ErrorActionPreference = 'Stop'

# Resolve the repository root from this script's own location.
$RepoPath   = $PSScriptRoot
$WebPath    = Join-Path $RepoPath 'rpgmaker-web-editor'
$ServerPath = Join-Path $RepoPath 'minecraft-server-1.21.8'
$StartBat   = Join-Path $ServerPath 'start.bat'

$webProcess = $null
$serverExitCode = $null

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

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
    Write-Host ' Direct Server Sync to GitHub'
    Write-Host '========================================'

    Push-Location $RepoPath
    try {
        $currentBranch = (& git branch --show-current).Trim()
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not determine the current Git branch.'
        }

        if ($currentBranch -ne 'main') {
            throw "Direct server sync requires the local branch to be 'main'. Current branch: $currentBranch"
        }

        # Only stage Minecraft server files. Manual edits elsewhere remain untouched
        # and should be handled through a normal branch + pull request.
        Invoke-Git -Arguments @('add', '--', 'minecraft-server-1.21.8')

        & git diff --cached --quiet -- 'minecraft-server-1.21.8'
        $hasServerChanges = ($LASTEXITCODE -ne 0)

        if (-not $hasServerChanges) {
            Write-Host 'No server changes to sync.'
        }
        else {
            $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
            Invoke-Git -Arguments @('commit', '-m', "server-sync: $timestamp")

            # Keep unrelated local edits safe while rebasing the server-sync commit
            # on top of the latest remote main.
            Invoke-Git -Arguments @('pull', '--rebase', '--autostash', 'origin', 'main')
            Invoke-Git -Arguments @('push', 'origin', 'main')

            Write-Host 'Server files pushed directly to main.'
        }
    }
    catch {
        Write-Warning "Direct server sync failed: $($_.Exception.Message)"
    }
    finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host '========================================'
    Write-Host ' Done'
    Write-Host '========================================'
}

if ($null -ne $serverExitCode -and $serverExitCode -ne 0) {
    exit $serverExitCode
}
