---
name: server-lifecycle-sync
description: Understand and maintain the Minecraft server lifecycle launcher, hidden RPGMaker web editor hosting, shutdown cleanup, direct server-state synchronization to main, and the repository PR policy. Use when changing server startup/shutdown automation, web-editor hosting behavior, server sync behavior, or related Git workflow.
---

# Server Lifecycle and Sync

## Purpose

This repository has a Windows launcher that starts the RPGMaker web editor together with the Minecraft server, keeps the Minecraft console interactive, and automatically synchronizes server-generated state after shutdown.

The lifecycle is intentionally split into two Git workflows:

- Runtime server-state synchronization goes directly to `main` without a pull request.
- Human or agent-authored code/configuration changes use a normal branch and pull request.

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
3. Synchronize server-state changes to GitHub.
4. Exit the wrapper automatically on success. `start-with-web-and-sync.bat` may pause only when the PowerShell launcher returns a non-zero exit code so startup failures remain visible.

The expected user experience is one visible server console window during operation. After `stop` finishes and Git synchronization completes successfully, that window closes automatically. If launcher startup fails, the root batch file should keep the error visible instead of flashing closed.

## Direct Server-State Sync

Shutdown synchronization is implemented directly inside `start-with-web-and-sync.ps1`; it does not rely on the older external `git-sync.ps1`.

The sync must:

1. Require the local branch to be `main`.
2. Stage only:

```text
minecraft-server-1.21.8
```

3. Leave unrelated local edits unstaged.
4. Skip the commit when no server files changed.
5. Commit all staged server-state changes as one commit with exactly this message:

```text
서버 동기화
```

6. Rebase the new server synchronization commit onto the latest `origin/main` using `--autostash` so unrelated local edits remain safe.
7. Push directly to `origin main`.

Repository rules intentionally allow this runtime synchronization to bypass the pull-request requirement. These direct server-sync pushes still remain visible in the Git commit history; they simply do not create pull-request records.

Do not broaden the automatic staging scope beyond `minecraft-server-1.21.8` without explicit user approval. In particular, repository-root scripts, web-editor source, agent instructions, and other manually edited files must remain outside the automatic shutdown sync.

## Pull Request Policy

Treat runtime synchronization and authored repository changes differently.

### Runtime server synchronization

- No pull request.
- One direct `서버 동기화` commit per shutdown when server files changed.
- Direct push to `main` is expected.

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
- Keep server-state auto-sync limited to `minecraft-server-1.21.8`.
- Do not convert server shutdown sync into a PR-based workflow.
- Do not make ordinary authored changes direct-push to `main`.
- Keep PR metadata in Korean.
- Preserve automatic wrapper exit after successful synchronization.
- Preserve an error-only pause in the root batch launcher so non-zero startup failures remain readable.
- Keep the automatic shutdown commit message exactly `서버 동기화` unless the user explicitly requests another format.

## Validation Checklist

After changing the launcher or sync logic, verify the following:

1. `start-with-web-and-sync.bat` launches the PowerShell wrapper, closes automatically on success, and pauses only when the wrapper returns a non-zero exit code.
2. `npm run dev` starts successfully and does not create a visible extra console window.
3. Minecraft starts through the existing `minecraft-server-1.21.8/start.bat` using a correctly quoted CMD `call` command.
4. The Minecraft console accepts normal commands, including `stop`.
5. After `stop`, the web editor process tree is terminated.
6. Only `minecraft-server-1.21.8` changes are staged by the shutdown sync.
7. A changed server produces one `서버 동기화` commit.
8. The commit rebases against the latest `origin/main` and pushes directly to `main`.
9. Unrelated local edits remain unstaged and intact.
10. The launcher window closes automatically after successful synchronization completes.
