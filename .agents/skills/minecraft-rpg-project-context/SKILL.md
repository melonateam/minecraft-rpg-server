---
name: minecraft-rpg-project-context
description: "Bootstrap context for the melonateam/minecraft-rpg-server repository. Read this at the start of a new chat, after memory/context loss, or before making project changes when the current repository state is unfamiliar. It explains the repository purpose, required reading order, skill routing, important paths, RPGMaker architecture, Git workflow, server lifecycle rules, and how to recover authoritative current state without trusting stale conversational memory."
---

# Minecraft RPG Project Context

## Purpose

This is the bootstrap skill for the repository:

```text
melonateam/minecraft-rpg-server
```

Use it when:

- starting a new ChatGPT/Codex/agent conversation about this repository;
- previous conversational memory was cleared, replaced, summarized, or may be stale;
- the agent does not know which Minecraft skill applies;
- the agent is about to modify the RPGMaker plugin, web editor, resource pack, server launcher, or server runtime data;
- a user says to "read the project", "read the skills", "continue the previous work", or otherwise expects repository-specific continuity.

This file is a bootstrap map, not a substitute for reading current source. The repository changes frequently. Treat the current `main` branch, `AGENTS.md`, relevant `SKILL.md` files, and current source/config files as authoritative whenever this document and the live repository differ.

---

## Required Reading Order

At the beginning of a fresh project session, recover context in this order.

### 1. Repository instructions

Read:

```text
AGENTS.md
```

Important repository-level rules currently include:

- If `.codegraph/` exists, use CodeGraph before grep/find or broad manual file reading when locating or understanding code.
- When Web ChatGPT Git writer is selected, it is the primary autonomous coding agent and should investigate, implement, validate, inspect the complete diff, create/update a PR, and squash-merge after required checks pass.
- Authored changes use `chatgpt/*` branches.
- Do not direct-push authored changes to `main`, force-push, delete branches, expose secrets, weaken tests, or modify protected repository/workflow/credential/writer files.

Do not assume this summary is complete. Read the actual current `AGENTS.md` every time the session is fresh.

### 2. This project bootstrap skill

Read:

```text
.agents/skills/minecraft-rpg-project-context/SKILL.md
```

This gives the project map and tells you which specialized skills to open next.

### 3. Minecraft skills index

Read:

```text
.agents/skills/README.md
```

This is the canonical router for the Minecraft skills installed in this repository.

### 4. Relevant specialized skills

Open the skill or skills matching the task. Do not load every large skill blindly when one or two are enough.

Canonical skill paths:

```text
.agents/skills/minecraft-plugin-dev/SKILL.md
.agents/skills/minecraft-testing/SKILL.md
.agents/skills/minecraft-server-admin/SKILL.md
.agents/skills/minecraft-resource-pack/SKILL.md
.agents/skills/minecraft-commands-scripting/SKILL.md
.agents/skills/minecraft-datapack/SKILL.md
.agents/skills/minecraft-world-generation/SKILL.md
.agents/skills/minecraft-modding/SKILL.md
.agents/skills/minecraft-multiloader/SKILL.md
.agents/skills/minecraft-ci-release/SKILL.md
.agents/skills/minecraft-worldedit-ops/SKILL.md
.agents/skills/minecraft-essentials-ops/SKILL.md
.agents/skills/minecraft-imagegen/SKILL.md
.agents/skills/server-lifecycle-sync/SKILL.md
```

Some skills contain additional `references/` and `scripts/` directories. Read those support files when the selected skill explicitly tells you to do so.

### 5. Current implementation files

After routing to the correct skill, inspect the current source/config directly. Never implement from remembered line numbers or an old conversation summary alone.

---

## Skill Routing For This Repository

Use this table before editing.

| Task | Skill to read first | Usually combine with |
|---|---|---|
| RPGMaker/Paper Java plugin changes | `minecraft-plugin-dev` | `minecraft-testing` |
| Unit/MockBukkit/integration testing | `minecraft-testing` | relevant implementation skill |
| Server startup, performance, backups, troubleshooting | `minecraft-server-admin` | `server-lifecycle-sync` when launcher/shutdown sync is involved |
| Server launcher, hidden web editor process, shutdown Git sync | `server-lifecycle-sync` | `minecraft-server-admin` |
| RPGMaker resource-pack fonts/models/textures/sounds | `minecraft-resource-pack` | `minecraft-imagegen` only for generated raster concepts/assets |
| Raw commands, scoreboards, selectors, NBT, execute chains | `minecraft-commands-scripting` | `minecraft-datapack` if a real datapack tree is needed |
| Datapack functions/advancements/recipes/loot tables | `minecraft-datapack` | `minecraft-commands-scripting` for command-heavy logic |
| Biomes/dimensions/features/structures | `minecraft-world-generation` | `minecraft-datapack` or `minecraft-modding` depending on implementation |
| Fabric or NeoForge mod code | `minecraft-modding` | `minecraft-testing` |
| Shared Fabric + NeoForge Architectury project | `minecraft-multiloader` | `minecraft-testing` |
| GitHub Actions, release automation, publishing | `minecraft-ci-release` | implementation skill for artifact type |
| WorldEdit live/staging operations | `minecraft-worldedit-ops` | `minecraft-server-admin` for maintenance/backup planning |
| EssentialsX/Vault homes/warps/economy/moderation | `minecraft-essentials-ops` | `minecraft-server-admin` for broader operations |
| Minecraft bitmap art, banner, icon, concept texture, UI mockup | `minecraft-imagegen` | `minecraft-resource-pack` for final pack wiring |

All generic Minecraft skills in this repository target Minecraft `1.21.x`. If work targets Minecraft 26.x or another major generation, verify current upstream APIs/formats first and treat it as a porting task rather than copying 1.21.x examples unchanged.

---

## Project Summary

This repository combines a live Minecraft Paper server with a custom RPG dialogue authoring system.

High-level layout:

```text
minecraft-rpg-server/
├─ AGENTS.md
├─ .agents/skills/
├─ minecraft-server-1.21.8/
├─ dialogue-display-plugin/
├─ dialogue-resource-pack/
├─ rpgmaker-web-editor/
├─ start-with-web-and-sync.bat
├─ start-with-web-and-sync.ps1
├─ build-rpgmaker.ps1
└─ other repository scripts/configuration
```

The major subsystems are described below.

### Minecraft server runtime

Path:

```text
minecraft-server-1.21.8/
```

This is the tracked Paper server runtime/state tree. It can contain server configuration, plugin runtime data, worlds, and other server-generated state.

Important distinction: server-generated runtime state is handled differently from human/agent-authored source changes. Read `server-lifecycle-sync` before modifying the automatic shutdown synchronization flow.

### RPGMaker Paper plugin

Path:

```text
dialogue-display-plugin/
```

This is the Java/Paper server-side implementation of RPGMaker dialogue behavior and the web API bridge.

Important source area:

```text
dialogue-display-plugin/src/main/java/kr/hyuni/dialogue/
```

Commonly important classes include, depending on current main:

```text
DialogueDisplayPlugin.java
DialogueWebApi.java
DialogueCompatibilityService.java
CharacterRegistry.java
ExpressionRules.java
WebPlayerSessions.java
WebJson.java
```

Resources live under:

```text
dialogue-display-plugin/src/main/resources/
```

Typical resources include `plugin.yml` and `config.yml`.

Before modifying this subsystem:

1. Read `minecraft-plugin-dev`.
2. Read `minecraft-testing` if logic or API behavior can be tested.
3. Inspect the current Gradle configuration and current Paper API target rather than assuming versions from memory.
4. Trace related callers and data formats before changing persistence, web API, dialogue playback, variables, choices, or compatibility behavior.

### RPGMaker web editor

Path:

```text
rpgmaker-web-editor/
```

This is the React/TypeScript/Vite browser editor used to create and synchronize dialogues with the Paper plugin.

Important source areas commonly include:

```text
rpgmaker-web-editor/src/components/dashboard/
rpgmaker-web-editor/src/components/editor/
rpgmaker-web-editor/src/components/preview/
rpgmaker-web-editor/src/services/
rpgmaker-web-editor/src/domain/
rpgmaker-web-editor/src/store/
```

Commonly important files, subject to current main, include:

```text
src/components/dashboard/Dashboard.tsx
src/components/editor/DialogueStudioV2.tsx
src/components/editor/DialogueSidebar.tsx
src/components/editor/StudioToolbar.tsx
src/components/editor/ScriptWorkspace.tsx
src/components/editor/PlayerConnectionModal.tsx
src/services/playerSessionApi.ts
src/services/minecraftCompatibility.ts
src/services/previewEngine.ts
src/domain/project.ts
src/store/projectStore.ts
```

Do not assume an unused or legacy component is irrelevant to TypeScript compilation. `tsc` can type-check files that are not currently routed at runtime. When shared component props change, search all compile-time call sites.

For web changes, inspect `package.json` and run the project-defined checks such as typecheck/build when available.

### RPGMaker web/server synchronization

The plugin exposes a local web API used by the web editor. The exact endpoints and sync semantics can change, so always inspect current `DialogueWebApi.java`, `DialogueCompatibilityService.java`, and `playerSessionApi.ts`/related web services before modifying sync behavior.

Current design concepts that are likely to remain relevant but must still be verified in source:

- player-scoped temporary web sessions;
- browser editor links issued from the Minecraft plugin;
- server dialogue listing/get/save/reload/delete operations;
- dialogue revision/conflict handling;
- compatibility conversion between the web domain model and plugin/server format;
- local web-only drafts versus server-linked dialogues;
- explicit synchronization actions rather than assuming every local edit is already on the server.

When debugging synchronization, trace both sides. A web-only fix is incomplete if the plugin contract disagrees, and a plugin-only fix is incomplete if the TypeScript client expects a different payload or revision rule.

### Dialogue resource pack

Path:

```text
dialogue-resource-pack/
```

Use `minecraft-resource-pack` for pack structure, fonts, textures, models, sound assets, and Minecraft pack metadata. If generating concept art or bitmap assets, use `minecraft-imagegen`, then return to `minecraft-resource-pack` for deterministic final integration.

### Server lifecycle wrapper

Entry points:

```text
start-with-web-and-sync.bat
start-with-web-and-sync.ps1
```

Read:

```text
.agents/skills/server-lifecycle-sync/SKILL.md
```

before changing this system.

Its intended model is:

1. launch the RPGMaker web editor hidden;
2. launch Minecraft through the existing server start script while preserving an interactive server console;
3. allow normal `stop` shutdown;
4. terminate the hidden web process after Paper exits;
5. synchronize only server runtime state according to the lifecycle skill;
6. close the wrapper automatically.

Do not replace normal `stop` shutdown with a forced kill unless the user explicitly requests a different operational model.

---

## Git And Change Policy

There are two intentionally different Git workflows.

### Human/agent-authored changes

Examples:

- Java plugin source;
- TypeScript/React web editor source;
- resource-pack source/assets;
- launcher scripts;
- `.agents` skills;
- repository configuration.

Default workflow:

```text
main
  ↓
chatgpt/<topic> branch
  ↓
implement + validate + inspect complete diff
  ↓
PR with Korean title/body
  ↓
required checks pass
  ↓
squash merge
```

Follow the current `AGENTS.md` exactly if it becomes stricter than this summary.

### Automatic server runtime synchronization

The server lifecycle skill defines a special exception for runtime state under:

```text
minecraft-server-1.21.8
```

That automated shutdown sync can commit/push server-generated state directly to `main` according to `server-lifecycle-sync`.

Do not generalize that exception to authored code. Source changes still use a branch and PR.

---

## Context Recovery Rules

When conversational memory conflicts with the repository, the repository wins.

Use the following recovery process:

1. Read current `AGENTS.md`.
2. Read this bootstrap skill.
3. Read `.agents/skills/README.md`.
4. Read the task-specific `SKILL.md` files.
5. Inspect current `main` implementation/configuration.
6. If `.codegraph/` exists and CodeGraph is available, use it first for code-location/call-path questions as directed by `AGENTS.md`.
7. Check recent merged PRs only when historical intent is materially useful; do not use PR history as a substitute for current files.
8. Reproduce or verify reported errors against current source before editing when possible.
9. After changes, inspect the complete diff and run all applicable checks available in the environment.

Do not claim that a directory contains only files visible in one PR. PR diffs show changes, not complete directory contents.

Do not infer that GitHub code search returning zero results proves a file or hidden directory does not exist. Prefer direct known-path reads or repository tree/file APIs when available.

---

## New Chat / Memory Reset Bootstrap Prompt

When a new conversation starts and the user references this project, interpret the expected bootstrap as:

```text
Read the current repository instructions and project skills before answering project-specific questions.
Start with AGENTS.md, then .agents/skills/minecraft-rpg-project-context/SKILL.md, then .agents/skills/README.md.
Read the specialized SKILL.md files relevant to the task, and inspect current main source/config before making claims or changes.
Treat repository state as authoritative over conversational memory.
```

If the agent has a GitHub connector, use the repository directly. Do not ask the user to paste files that the connected repository can provide.

---

## Quick Task Recipes

### RPGMaker Java/plugin bug

Read:

```text
AGENTS.md
.agents/skills/minecraft-rpg-project-context/SKILL.md
.agents/skills/minecraft-plugin-dev/SKILL.md
.agents/skills/minecraft-testing/SKILL.md
```

Then inspect current plugin source, related web contract if relevant, and Gradle configuration.

### RPGMaker web editor bug

Read:

```text
AGENTS.md
.agents/skills/minecraft-rpg-project-context/SKILL.md
.agents/skills/README.md
```

Then inspect current TypeScript components/services/domain/store and `package.json`. If the issue crosses the Minecraft API boundary, also read `minecraft-plugin-dev` and inspect the Java web API implementation.

### Server does not start / performance / backup problem

Read:

```text
AGENTS.md
.agents/skills/minecraft-rpg-project-context/SKILL.md
.agents/skills/minecraft-server-admin/SKILL.md
```

If the launcher or shutdown Git sync is involved, also read:

```text
.agents/skills/server-lifecycle-sync/SKILL.md
```

### Resource-pack display problem

Read:

```text
AGENTS.md
.agents/skills/minecraft-rpg-project-context/SKILL.md
.agents/skills/minecraft-resource-pack/SKILL.md
```

Then inspect the current pack metadata and the exact affected asset/model/font files.

### Commands/datapack task

For command snippets only:

```text
.agents/skills/minecraft-commands-scripting/SKILL.md
```

For real datapack files:

```text
.agents/skills/minecraft-datapack/SKILL.md
```

Use both when appropriate.

---

## Updating This Skill

Update this bootstrap skill when any of the following materially changes:

- repository top-level architecture;
- canonical skill paths or skill routing;
- RPGMaker plugin/web/resource-pack boundaries;
- Git/PR policy;
- server lifecycle or runtime synchronization model;
- required bootstrap reading order.

Do not turn this file into a changelog. Keep it focused on information a fresh agent needs to recover project context quickly.

When implementation details change often, describe where to verify them instead of hard-coding volatile values.

After editing canonical skills under `.agents/skills/`, follow `.agents/skills/README.md` for the repository's skill-layout synchronization/audit procedure when that procedure is available in the execution environment.
