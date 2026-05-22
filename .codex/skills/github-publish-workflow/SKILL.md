---
name: github-publish-workflow
description: GitHub publish workflow for this repository. Use when committing, pushing branches, opening pull requests, or preparing changes for review in ShanyuJung/gacha-probability-tool.
---

# GitHub Publish Workflow

## Repository

- Remote: `origin`
- GitHub repo: `ShanyuJung/gacha-probability-tool`
- Default branch: `master`

## Before Publishing

1. Run `git status -sb`.
2. Confirm the branch is appropriate. Create `codex/<short-description>` for feature or tooling work from `master`.
3. Run relevant checks:

```bash
npm.cmd run format:check
npm.cmd run build
```

## Commits

- Follow `AGENTS.md` Conventional Commits.
- Use examples like:
  - `fix(calculation): show guaranteed pity results`
  - `fix(ui): prevent probability label overflow`
  - `chore: add prettier formatting`

## Push

Push the current branch with tracking:

```bash
git push -u origin <branch>
```

If the user asks for a PR, open a draft PR unless they explicitly ask for ready-for-review.
