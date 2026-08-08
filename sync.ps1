$ErrorActionPreference = "Stop"

function Check-ExitCode {
    param([string]$Message)

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: $Message"
        exit 1
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host " Git Sync"
Write-Host "========================================"
Write-Host ""

# --------------------------------------------------
# Check Git repository
# --------------------------------------------------

git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: This directory is not a Git repository."
    exit 1
}

# --------------------------------------------------
# Check GitHub CLI
# --------------------------------------------------

$ghCommand = Get-Command gh -ErrorAction SilentlyContinue

if (-not $ghCommand) {
    Write-Host "ERROR: GitHub CLI (gh) is not installed."
    exit 1
}

gh auth status *> $null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: GitHub CLI is not authenticated."
    Write-Host "Run:"
    Write-Host "  gh auth login"
    exit 1
}

# --------------------------------------------------
# Check current branch
# --------------------------------------------------

$branch = git branch --show-current

if (-not $branch) {
    Write-Host "ERROR: Could not determine current branch."
    exit 1
}

Write-Host "Current branch: $branch"
Write-Host ""

# --------------------------------------------------
# If currently on main
# --------------------------------------------------

if ($branch -eq "main") {

    $changes = git status --porcelain

    # No local changes:
    # just update main from GitHub.
    if (-not $changes) {

        Write-Host "Updating local main..."

        git fetch origin
        Check-ExitCode "git fetch failed"

        git pull --ff-only origin main
        Check-ExitCode "git pull failed"

        Write-Host ""
        Write-Host "Local main is now up to date."
        exit 0
    }

    # Local changes exist:
    # create a new work branch.
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $branch = "codex/auto-$timestamp"

    Write-Host "Local changes detected on main."
    Write-Host "Creating branch: $branch"

    git switch -c $branch
    Check-ExitCode "Could not create work branch"

    Write-Host ""
}

# --------------------------------------------------
# Stage and commit local changes
# --------------------------------------------------

$changes = git status --porcelain

if ($changes) {

    Write-Host "Staging changes..."

    git add -A
    Check-ExitCode "git add failed"

    $commitTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    Write-Host "Creating commit..."

    git commit -m "auto: update $commitTime"
    Check-ExitCode "git commit failed"

}
else {
    Write-Host "No new local changes to commit."
}

Write-Host ""

# --------------------------------------------------
# Fetch latest main
# --------------------------------------------------

Write-Host "Fetching origin..."

git fetch origin
Check-ExitCode "git fetch failed"

# --------------------------------------------------
# Rebase work branch on latest main
# --------------------------------------------------

Write-Host "Rebasing onto origin/main..."

git rebase origin/main

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "ERROR: Rebase conflict detected."
    Write-Host ""
    Write-Host "Resolve the conflicting files, then run:"
    Write-Host ""
    Write-Host "  git add -A"
    Write-Host "  git rebase --continue"
    Write-Host ""
    Write-Host "Or cancel the rebase with:"
    Write-Host ""
    Write-Host "  git rebase --abort"
    Write-Host ""

    exit 1
}

Write-Host "Rebase complete."
Write-Host ""

# --------------------------------------------------
# Push work branch
# --------------------------------------------------

Write-Host "Pushing branch: $branch"

# First check whether remote branch exists.
git ls-remote --exit-code --heads origin $branch *> $null

$remoteExists = ($LASTEXITCODE -eq 0)

if ($remoteExists) {

    # Rebase can rewrite commit history.
    # Use force-with-lease only on work branches.
    git push --force-with-lease -u origin HEAD

}
else {

    git push -u origin HEAD
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Push failed."
    exit 1
}

Write-Host "Push complete."
Write-Host ""

# --------------------------------------------------
# Look for existing PR
# --------------------------------------------------

Write-Host "Checking for existing pull request..."

$prNumber = gh pr list `
    --head $branch `
    --base main `
    --state open `
    --json number `
    --jq '.[0].number'

Check-ExitCode "Could not query pull requests"

# --------------------------------------------------
# Create PR if needed
# --------------------------------------------------

if (-not $prNumber) {

    Write-Host "No open PR found."
    Write-Host "Creating pull request..."

    gh pr create `
        --base main `
        --head $branch `
        --fill

    Check-ExitCode "Could not create pull request"

    $prNumber = gh pr list `
        --head $branch `
        --base main `
        --state open `
        --json number `
        --jq '.[0].number'

    Check-ExitCode "Could not find newly created PR"

}
else {

    Write-Host "Existing PR found: #$prNumber"
}

if (-not $prNumber) {
    Write-Host "ERROR: Could not determine PR number."
    exit 1
}

Write-Host ""

# --------------------------------------------------
# Convert draft PR to ready
# --------------------------------------------------

$isDraft = gh pr view $prNumber `
    --json isDraft `
    --jq '.isDraft'

Check-ExitCode "Could not query PR state"

if ($isDraft -eq "true") {

    Write-Host "Marking PR as ready..."

    gh pr ready $prNumber
    Check-ExitCode "Could not mark PR as ready"
}

# --------------------------------------------------
# Enable auto merge
# --------------------------------------------------

Write-Host "Enabling auto merge for PR #$prNumber..."

gh pr merge $prNumber --auto --squash

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "ERROR: Could not enable auto merge."
    Write-Host ""
    Write-Host "Check GitHub settings:"
    Write-Host "  Settings > General > Pull Requests"
    Write-Host "  Allow auto-merge = enabled"
    Write-Host ""
    Write-Host "Also check the main branch ruleset."
    exit 1
}

Write-Host ""

# --------------------------------------------------
# Check PR state
# --------------------------------------------------

$prState = gh pr view $prNumber `
    --json state `
    --jq '.state'

Check-ExitCode "Could not query final PR state"

if ($prState -eq "MERGED") {

    Write-Host "PR #$prNumber merged."
    Write-Host ""
    Write-Host "Switching to main..."

    git switch main
    Check-ExitCode "Could not switch to main"

    git fetch origin
    Check-ExitCode "git fetch failed"

    git pull --ff-only origin main
    Check-ExitCode "Could not update local main"

    Write-Host ""
    Write-Host "========================================"
    Write-Host " Sync complete"
    Write-Host "========================================"

}
else {

    Write-Host "========================================"
    Write-Host " PR #$prNumber is waiting for auto merge"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "GitHub will merge it when all requirements pass."
}