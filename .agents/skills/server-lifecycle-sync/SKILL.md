---
name: server-lifecycle-sync
description: Understand and maintain the Minecraft server lifecycle launcher, hidden RPGMaker web editor hosting, shutdown cleanup, code-only synchronization, and local-only runtime server data. Use when changing server startup/shutdown automation, web-editor hosting behavior, server sync behavior, or related Git workflow.
---

# Server Lifecycle and Sync

## Purpose

This repository has a Windows launcher that starts the RPGMaker web editor together with the Minecraft server, keeps the Minecraft console interactive, and automatically synchronizes recognized code changes after shutdown.

The lifecycle is intentionally split into two storage workflows:

- Runtime server state stays only on the local machine and is never automatically staged.
- Plugin, Skript, web-editor, resource-pack, CI, and launcher code can be synchronized after shutdown.

## Entry Points

Use the repository-root launcher:

```text
start-with-web-and-sync.bat
```

It invokes:

```text
start-with-web-and-sync.ps1
```

The PowerShell script resolves the repository root from `$PSScriptRoot`, so it does not depend on a hard-coded Windows path and remains safe when parent folders contain Korean characters.

## Startup Flow

1. Validate that `rpgmaker-web-editor` exists.
2. Validate that `minecraft-server-1.21.8/start.bat` exists.
3. Start the RPGMaker web editor with `npm run dev` in `rpgmaker-web-editor`.
4. Run the web editor in a hidden window so no extra CMD window is shown.
5. Call the existing `minecraft-server-1.21.8/start.bat` in the active console using a normal CMD `call "<path>"` command. Do not use backslashes as quote escapes in the generated CMD command line.
6. The existing Minecraft `start.bat` starts the resource-pack tunnel first and then launches Paper with the repository's bundled Java runtime.
7. Keep standard Minecraft console input available. The operator shuts the server down normally by entering `stop` in the console.

Do not replace the interactive Minecraft console with RCON or a forced process kill unless the user explicitly requests a different shutdown model.

## Shutdown Flow

After Paper exits normally:

1. Return control to `start-with-web-and-sync.ps1` immediately. The Minecraft `start.bat` must not contain a final `pause`.
2. Terminate the hidden RPGMaker web editor process and its child process tree.
3. Run `sync.ps1`, which synchronizes only recognized code changes to GitHub.
4. Exit the wrapper automatically on success. `start-with-web-and-sync.bat` may pause only when the PowerShell launcher returns a non-zero exit code so startup failures remain visible.

The expected user experience is one visible server console window during operation. After `stop` finishes and Git synchronization completes successfully, that window closes automatically. If launcher startup fails, the root batch file should keep the error visible instead of flashing closed.

## Code-Only Sync

Shutdown synchronization is implemented by `sync.ps1` and called by `start-with-web-and-sync.ps1` after Paper exits.

The sync must:

1. Require the local branch to be `main`.
2. Detect modified, deleted, untracked, and already-staged files.
3. Stage only recognized code paths:

```text
dialogue-display-plugin source/build definitions
rpgmaker-web-editor source/public/build definitions
dialogue-resource-pack source assets and manifests
.github/workflows
repository-root PowerShell and batch launch/build scripts
minecraft-server-1.21.8/**/*.sk
minecraft-server-1.21.8/plugins/*.jar
minecraft-server-1.21.8/.plugin-update-stage/*.jar
minecraft-server-1.21.8 root launch scripts
```

4. Exclude world data, player data, logs, plugin databases, RPGMaker dialogue saves, Skript variables, and plugin runtime configuration.
5. Include matching code files even when the user modified or staged them manually.
6. Skip commit, pull, and push when no recognized code changed.
7. Commit recognized code changes only, even if runtime data was already staged, with exactly this message:

```text
코드 동기화
```

8. Rebase the new code commit onto the latest `origin/main` using `--autostash` so local runtime data remains safe.
9. Push directly to `origin main`.

The read-only local runtime data is deliberately allowed to keep the worktree dirty. Do not broaden the classifier to plugin data/config directories merely to make `git status` clean.

`sync.ps1 -SelfTest` is the executable regression check for the classifier. Add a positive and negative case whenever its path rules change.

## Pull Request Policy

Treat automatic path-classified code synchronization and ordinary agent-authored repository changes differently.

### Automatic code synchronization

- No pull request.
- One direct `코드 동기화` commit per shutdown when recognized code files changed.
- Direct push to `main` is expected.
- Runtime server data is excluded even when it was manually staged before shutdown.

### Human or agent-authored changes

Examples include launcher scripts, plugin/source changes, website changes, agent instructions, and repository configuration.

- Use a dedicated working branch.
- Group closely related fixes into the same pull request instead of creating many tiny PRs.
- Write pull-request titles and descriptions in Korean.
- Preserve useful authored-change history in PRs.
- Follow repository-level `AGENTS.md` instructions for branch naming, validation, merging, and protected-file restrictions.

## Important Files

```text
start-with-web-and-sync.bat
start-with-web-and-sync.ps1
minecraft-server-1.21.8/start.bat
minecraft-server-1.21.8/start-resource-pack-tunnel.ps1
rpgmaker-web-editor/package.json
AGENTS.md
```

`rpgmaker-web-editor/package.json` defines `npm run dev` as the Vite development server.

## Maintenance Rules

When modifying this lifecycle:

- Preserve normal `stop`-based Minecraft shutdown so worlds are saved correctly.
- Keep the web editor hidden unless the user asks to see its console.
- Ensure the web process is terminated after Minecraft exits.
- Keep runtime server data local-only.
- Do not convert shutdown code sync into a broad `git add -A` workflow.
- Do not make ordinary authored changes direct-push to `main`.
- Keep PR metadata in Korean.
- Preserve automatic wrapper exit after successful synchronization.
- Preserve an error-only pause in the root batch launcher so non-zero startup failures remain readable.
- Keep the automatic shutdown commit message exactly `코드 동기화` unless the user explicitly requests another format.

## Validation Checklist

After changing the launcher or sync logic, verify the following:

1. `start-with-web-and-sync.bat` launches the PowerShell wrapper, closes automatically on success, and pauses only when the wrapper returns a non-zero exit code.
2. `npm run dev` starts successfully and does not create a visible extra console window.
3. Minecraft starts through the existing `minecraft-server-1.21.8/start.bat` using a correctly quoted CMD `call` command.
4. The Minecraft console accepts normal commands, including `stop`.
5. After `stop`, the web editor process tree is terminated.
6. `sync.ps1 -SelfTest` passes.
7. World/player/dialogue/variable/config runtime data does not trigger a commit.
8. Plugin source, web source, resource-pack source, direct plugin JARs, `.sk` files, and launcher scripts do trigger one `코드 동기화` commit.
9. The commit rebases against the latest `origin/main` and pushes directly to `main`.
10. Runtime data and unrelated local edits remain intact.
11. The launcher window closes automatically after successful synchronization completes.
