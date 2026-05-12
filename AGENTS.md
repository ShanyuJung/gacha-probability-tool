# Agent Guidelines

## Commit Messages

Follow Conventional Commits 1.0.0-beta.4 for every commit in this repository:
https://www.conventionalcommits.org/en/v1.0.0-beta.4/

Use this structure:

```text
<type>[optional scope]: <description>

[optional body]
[optional footer]
```

Rules:

- Use `feat:` when adding a new feature.
- Use `fix:` when committing a bug fix.
- Other useful types are allowed, such as `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, and `build:`.
- Add an optional scope when it clarifies the changed area, for example `feat(ui): add probability summary`.
- Keep the description short, imperative, and lowercase unless a proper noun requires capitalization.
- For breaking changes, add `!` before the colon and include a `BREAKING CHANGE:` body or footer.

Examples:

```text
feat: add gacha probability controls
fix(calculation): include current pulls in cumulative results
docs: add commit message guidelines
```
