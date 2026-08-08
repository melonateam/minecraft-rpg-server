---
name: minecraft-rpg-git-workflow
description: "Git and pull-request workflow for authored changes in melonateam/minecraft-rpg-server. Use whenever ChatGPT/Codex/agents modify repository-authored code, configuration, skills, scripts, web editor files, plugin source, or resource-pack source."
---

# Minecraft RPG Git / PR Workflow

## Scope

Use this skill for human/agent-authored repository changes. Server-generated runtime synchronization under `minecraft-server-1.21.8` follows the separate `server-lifecycle-sync` policy.

## Required workflow

For authored changes:

1. Start from current `main`.
2. Create or reuse a `chatgpt/*` branch.
3. Implement the complete requested change and directly related fixes/tests.
4. Inspect the resulting diff and run all applicable checks available in the environment.
5. Commit the changes to the `chatgpt/*` branch.
6. Create or update a Pull Request targeting `main` with a clear Korean title/body.
7. Do **not** create Draft PRs by default. Create a normal open PR unless there is a concrete reason the change must remain explicitly non-reviewable.
8. Do not ask the user to manually create the PR, click `Ready for review`, or perform the merge when the GitHub connector can do it.
9. After the PR is open, determine whether GitHub considers it immediately mergeable.
10. If the PR is immediately mergeable and required checks are satisfied (or no required checks exist), **squash-merge it immediately**. Do not wait for or attempt to enable auto-merge first.
11. If the PR cannot yet merge only because required status checks, merge requirements, or similar repository gates are pending, enable GitHub auto-merge when available so it merges automatically once those gates pass.
12. If auto-merge cannot be enabled, inspect the blocking checks/reviews and resolve actionable failures. Merge with squash as soon as the repository permits it.
13. Confirm the final merged state and resulting `main` commit SHA before reporting completion.

## Auto-merge clarification

Repository setting **Allow auto-merge** only permits PR-level auto-merge. It does not automatically enable auto-merge on every PR.

GitHub may reject `enablePullRequestAutoMerge` when a PR is already in a clean/immediately mergeable state. That is expected: in that case, call the normal merge operation immediately instead.

Use this decision rule:

```text
PR open
  ├─ immediately mergeable + required checks satisfied → squash merge now
  └─ blocked only by pending required gates → enable auto-merge
       ├─ gates pass → GitHub merges automatically
       └─ gate/check fails → fix, push, re-check, then merge
```

## Defaults

- Branch: `chatgpt/<topic>`
- PR: normal open PR (`draft=false`)
- Merge method: `squash`
- Direct authored push to `main`: forbidden
- Force push: forbidden
- Branch deletion by the agent: forbidden unless repository policy explicitly changes
- Required human approval: do not invent one; obey only repository rules that actually require it
- User interaction: do not hand routine PR creation/Ready/merge clicks back to the user when the connected GitHub tools can perform them

## Safety and correctness

Never bypass failing required checks, weaken tests, alter branch protections just to make a PR merge, expose secrets, or modify protected workflow/credential/writer files unless the user explicitly requests an allowed change and repository policy permits it.

If a PR is mergeable but the implementation is known to be incomplete or unverified in a material way, finish the implementation/checks first rather than merging merely because GitHub technically allows it.
