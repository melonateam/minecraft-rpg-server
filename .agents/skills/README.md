# Minecraft Skills Index

This index lists all Minecraft skills in this repository.
Canonical source files live under `.agents/skills/`, and this README is mirrored
to compatibility trees.
All skill content targets Minecraft `1.21.x`. Minecraft 26.1.x changed Java,
Paper, Fabric, and several vanilla data/command surfaces; treat 26.x work as a
porting task that requires fresh upstream verification before applying these
examples unchanged.

Use this index as a quick router before opening individual `SKILL.md` files.
Some skills also include local `references/` and `scripts/` support assets; the
table below is a router, not an exhaustive layout listing.

For this specific repository, a fresh chat or an agent recovering from stale/missing
conversation memory should read `minecraft-rpg-project-context` before routing to a
specialized Minecraft skill.

## Skill Catalog

| Skill | Primary use cases | Choose this instead when |
|---|---|---|
| `minecraft-rpg-project-context` | Bootstrap this repository in a fresh chat: project layout, required reading order, RPGMaker architecture, skill paths, Git policy, and task routing | You already have current project context and only need a specialized Minecraft implementation/operations skill |
| `minecraft-rpg-git-workflow` | Authored repository changes: `chatgpt/*` branch, normal PR creation, immediate squash merge when clean, auto-merge only when pending repository gates block an otherwise ready PR | You are synchronizing server-generated runtime state on shutdown (`server-lifecycle-sync`) |
| `minecraft-modding` | Build NeoForge or Fabric mods (blocks, items, entities, GUIs, datagen) | You need a single shared codebase for both loaders (`minecraft-multiloader`) |
| `minecraft-multiloader` | Architectury projects that ship both NeoForge and Fabric from one repo | You only need one loader (`minecraft-modding`) |
| `minecraft-plugin-dev` | Write Paper/Bukkit/Spigot plugins in Java 21 | You need server operations or deployment guidance (`minecraft-server-admin`) |
| `minecraft-datapack` | Vanilla datapacks: functions, advancements, recipes, loot tables | You only need command chains/NBT/scoreboards (`minecraft-commands-scripting`) |
| `minecraft-commands-scripting` | Command-block/chat/RCON command systems, `/execute`, scoreboards, NBT paths | You need full datapack systems (`minecraft-datapack`) |
| `minecraft-world-generation` | Worldgen JSON/code: biomes, dimensions, structures, features | You need building operations with WorldEdit (`minecraft-worldedit-ops`) |
| `minecraft-resource-pack` | Textures, models, sounds, fonts, shaders, pack metadata | You need gameplay logic or server operations (pick a development/admin skill) |
| `minecraft-imagegen` | Generate pack icons, promo art, thumbnails, concept textures, and UI mockups | You need deterministic pack structure, model JSON, sounds, or shader files (`minecraft-resource-pack`) |
| `minecraft-testing` | JUnit, MockBukkit, NeoForge/Fabric GameTests, CI test wiring | You need release pipelines and publishing (`minecraft-ci-release`) |
| `minecraft-ci-release` | GitHub Actions, release automation, Modrinth/CurseForge publishing | You need local implementation details of mod/plugin features (pick a dev skill) |
| `minecraft-server-admin` | Server setup, tuning, operations, backups, proxies, troubleshooting | You need command-heavy map editing (`minecraft-worldedit-ops`) or EssentialsX policy (`minecraft-essentials-ops`) |
| `minecraft-worldedit-ops` | Safe WorldEdit operations: selections, clipboards, schematics, brushes, rollback workflows | You need plugin coding (`minecraft-plugin-dev`) |
| `minecraft-essentials-ops` | EssentialsX operations: homes/warps/kits, moderation, economy, permission patterns | You need generic platform operations not tied to EssentialsX (`minecraft-server-admin`) |

## Overlap Boundaries

- Use `minecraft-rpg-project-context` to restore repository-specific context and choose what to read next; it does not replace the specialized skill or current source inspection.
- Use `minecraft-rpg-git-workflow` whenever authored repository files are changed. It owns PR creation/merge behavior and must not be replaced by the server runtime sync exception.
- Use `minecraft-server-admin` for platform-level operations (hosting, proxy, backups, performance).
- Use `minecraft-worldedit-ops` for command-driven build/admin changes in-world.
- Use `minecraft-essentials-ops` for EssentialsX-specific commands, config, and permissions.
- Use `minecraft-plugin-dev` when the task is writing Java plugin code rather than operating existing plugins.
- Use `minecraft-imagegen` for raster art, thumbnails, pack icons, and concept textures; use `minecraft-resource-pack` when the task is final pack structure plus JSON/audio/shader implementation.
- `minecraft-imagegen` also requires a host that exposes image generation; treat it as Codex-first unless the current agent explicitly supports an equivalent image tool.

## Repository PR Automation

For authored changes, read `minecraft-rpg-git-workflow` and follow its merge decision exactly:

- create a normal PR by default (`draft=false`);
- if the PR is clean/immediately mergeable and required checks are satisfied, squash-merge it immediately;
- if pending required repository gates are the only blocker, enable PR-level auto-merge when available;
- do not ask the user to manually create the PR, mark it ready, or click merge when connected GitHub tools can do those operations.

## Sync Model

Edit only this canonical tree:

- `.agents/skills/`

Then mirror to compatibility trees:

- `.codex/skills/`
- `.claude/skills/`
- `plugins/minecraft-codex-skills/skills/`

Commands:

```bash
bash ./scripts/sync-skills-layout.sh sync
npm run audit:skills
```
