# 04 — The pick → implement → verify → close cycle

**What to build:** The loop itself, driven through the single `runStep(role, input)` seam. Each iteration picks the next workable ticket, sets it `in-progress`, records the base commit, runs an implement step, runs a verify step, then closes. On `VERDICT: PASS` it ticks the acceptance boxes, sets `done`, and guarantees a commit. On `VERDICT: FAIL` it sets `blocked`, appends the reason, and stops. It stops when no workable ticket remains, honors `--max`, and warns when it re-runs a ticket left `in-progress` by a previous run. The orchestrator owns every status transition; the model only writes product code.

**Blocked by:** 01 — Ticket model and frontier selection; 02 — Git safety and the commit guarantee; 03 — The `/loop` command: arguments, preconditions, and `--dry-run`.

**Status:** ready-for-agent

- [ ] Walks a fixture repository of dependent tickets one ticket per iteration, committing each passing ticket.
- [ ] Sets the picked ticket `in-progress` and records the diff base before the implement step.
- [ ] On pass: ticks the acceptance boxes, sets `done`, guarantees a commit, and continues to the next workable ticket.
- [ ] On fail: sets `blocked`, appends the reason, and stops without working dependents.
- [ ] Stops cleanly when the frontier is empty and honors `--max`.
- [ ] Re-runs a ticket left `in-progress` with a warning.
- [ ] All status transitions and box ticks are deterministic orchestrator logic; product code is written only by the model.
- [ ] Integration test drives the fixture repository with a substituted fake `runStep`; CI calls no real model.
