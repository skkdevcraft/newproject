# 03 — The `/loop` command: arguments, preconditions, and `--dry-run`

**What to build:** The user-facing entry point. `/loop <feature-slug>` resolves the feature folder and validates preconditions (a git repository, a clean tree, a non-default branch, a resolvable feature folder) before doing anything. With no slug it uses the only feature folder, refuses when several exist, and exits cleanly when none exist. `--dry-run` prints the frontier and the planned ticket order without changing a single file. All flags are parsed and surfaced in the usage message.

**Blocked by:** 01 — Ticket model and frontier selection; 02 — Git safety and the commit guarantee.

**Status:** ready-for-agent

- [ ] `/loop <feature-slug>` resolves the feature folder that holds the tickets.
- [ ] `/loop` with no argument uses the only feature folder, refuses when several exist, and exits cleanly when none exist.
- [ ] Refuses to start on a dirty working tree or on `main`/`master`; `--force` overrides both refusals.
- [ ] `--max <n>`, `--model <provider>/<id>`, `--verify-model <provider>/<id>`, `--dry-run`, and `--force` are parsed.
- [ ] `--dry-run` prints the frontier and the planned ticket order and changes nothing.
- [ ] Missing, ambiguous, or invalid input produces a clear message instead of a crash.
