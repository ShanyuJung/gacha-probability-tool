---
name: gacha-tool-development
description: Project workflow for the React, TypeScript, and Vite gacha probability tool. Use when changing UI, scripts, configuration, dependencies, formatting, or build behavior in this repository.
---

# Gacha Tool Development

## Workflow

1. Read `AGENTS.md` before making changes.
2. Keep changes focused and follow the existing React component style in `src/App.tsx`.
3. Preserve Traditional Chinese UI copy unless the user asks to change it.
4. Use `apply_patch` for manual file edits.
5. After code or config changes, run:

```bash
npm.cmd run format:check
npm.cmd run build
```

Run `npm.cmd run format` first when formatting is intentionally changed.

## Git

- Use Conventional Commits from `AGENTS.md`.
- Do not mix unrelated UI, calculation, and tooling changes in one commit when they can be separated.
- Prefer branches named `codex/<short-description>` for new work.
