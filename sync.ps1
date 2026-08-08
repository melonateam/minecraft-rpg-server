$ErrorActionPreference = "Stop"

Write-Host "=== Git 자동 동기화 ==="

# 현재 브랜치
$branch = git branch --show-current

if (-not $branch) {
    Write-Host "현재 Git 브랜치를 찾을 수 없습니다."
    exit 1
}

Write-Host "현재 브랜치: $branch"

# 원격 정보 갱신
git fetch origin

# main 최신화
git rebase origin/main

# 변경사항 추가
git add -A

# 변경사항이 있는 경우에만 커밋
$changes = git status --porcelain

if ($changes) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "auto: update $timestamp"
}

# 현재 브랜치 push
git push -u origin HEAD

Write-Host "=== Push 완료 ==="