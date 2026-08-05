# Project conventions

## Feature documentation

Every new feature's spec, plan, and todo checklist go in:

```
docs/feature/<number>.<name-spec>/spec.md
docs/feature/<number>.<name-spec>/plan.md
docs/feature/<number>.<name-spec>/todo.md
```

- `<number>` increments per feature (check existing folders under
  `docs/feature/` for the next number).
- `<name-spec>` is a short kebab-case slug for the feature.
- Do not write feature specs to the project root (e.g. `SPEC.md`) or to
  `docs/<name>/` without the `feature/<number>.` prefix — this is the
  one location for all feature docs going forward.
