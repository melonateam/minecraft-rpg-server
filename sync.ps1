param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$RepoPath = $PSScriptRoot

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Test-CodeSyncPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $normalized = $Path.Replace('\', '/')
    return $normalized -match '^dialogue-display-plugin/(src/|build\.gradle\.kts$|settings\.gradle\.kts$)' -or
        $normalized -match '^rpgmaker-web-editor/(src/|public/|scripts/|package(-lock)?\.json$|index\.html$|tsconfig[^/]*\.json$|vite\.config\.ts$)' -or
        $normalized -match '^dialogue-resource-pack/(assets/|pack\.mcmeta$|rpgmaker-character-manifest\.json$)' -or
        $normalized -match '^\.github/workflows/' -or
        $normalized -match '^[^/]+\.(ps1|bat)$' -or
        $normalized -match '^minecraft-server-1\.21\.8/.+\.sk$' -or
        $normalized -match '^minecraft-server-1\.21\.8/plugins/[^/]+\.jar(\.disabled)?$' -or
        $normalized -match '^minecraft-server-1\.21\.8/\.plugin-update-stage/[^/]+\.jar$' -or
        $normalized -match '^minecraft-server-1\.21\.8/[^/]+\.(ps1|bat|cmd|sh)$'
}

function Get-ChangedPaths {
    $paths = @(
        & git -c core.quotepath=false ls-files --modified --deleted --others --exclude-standard
        & git -c core.quotepath=false diff --cached --name-only
    )
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect local Git changes.'
    }
    return @($paths | Where-Object { $_ } | Sort-Object -Unique)
}

function Assert-CodeSyncRules {
    $cases = @{
        'dialogue-display-plugin/src/main/java/Plugin.java' = $true
        'rpgmaker-web-editor/src/app/App.tsx' = $true
        'dialogue-resource-pack/assets/dialog/font/frame.json' = $true
        'minecraft-server-1.21.8/plugins/Skript/scripts/quest.sk' = $true
        'minecraft-server-1.21.8/plugins/RPGMaker.jar' = $true
        'minecraft-server-1.21.8/start.bat' = $true
        'minecraft-server-1.21.8/world/level.dat' = $false
        'minecraft-server-1.21.8/plugins/RPGMaker/config.yml' = $false
        'minecraft-server-1.21.8/plugins/Skript/variables.csv' = $false
        'minecraft-server-1.21.8/logs/latest.log' = $false
        'minecraft-server-1.21.8/plugins/Citizens/lib/dependency.jar' = $false
    }

    foreach ($entry in $cases.GetEnumerator()) {
        if ((Test-CodeSyncPath $entry.Key) -ne $entry.Value) {
            throw "Code sync rule failed for $($entry.Key)"
        }
    }
    Write-Host 'Code sync path rules passed.'
}

if ($SelfTest) {
    Assert-CodeSyncRules
    exit 0
}

Push-Location $RepoPath
try {
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        throw "Automatic code sync requires the local branch to be 'main'. Current branch: $branch"
    }

    $codePaths = @(Get-ChangedPaths | Where-Object { Test-CodeSyncPath $_ })
    if (-not $codePaths) {
        Write-Host 'No plugin, script, web, or resource-pack code changes to sync.'
        exit 0
    }

    Invoke-Git -Arguments (@('add', '-A', '--') + $codePaths)
    $stagedCodePaths = @(
        & git -c core.quotepath=false diff --cached --name-only |
            Where-Object { $_ -and (Test-CodeSyncPath $_) } |
            Sort-Object -Unique
    )
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect staged code changes.'
    }
    if (-not $stagedCodePaths) {
        Write-Host 'No code changes to commit.'
        exit 0
    }

    Write-Host 'Code changes detected:'
    $stagedCodePaths | ForEach-Object { Write-Host "  $_" }

    # --only prevents already-staged world/player/plugin data from entering this commit.
    Invoke-Git -Arguments (@('commit', '--only', '-m', '코드 동기화', '--') + $stagedCodePaths)
    Invoke-Git -Arguments @('pull', '--rebase', '--autostash', 'origin', 'main')
    Invoke-Git -Arguments @('push', 'origin', 'main')
    Write-Host 'Code files synchronized with origin/main. Runtime server data remains local.'
}
finally {
    Pop-Location
}
