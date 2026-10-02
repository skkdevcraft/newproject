# AGENTS.md

Guidance for agents working **on** `pi-loop`, a pi extension that drives a project's `.scratch/` tickets to completion one ticket per iteration, using a fresh pi session per step. This file is about building the plugin, not about using it (see [README.md](README.md) for usage).

## What we are building

`pi-loop` is a **pi extension** registered as `@skkdevcraft/pi-loop`. It exposes a `/loop` command that repeatedly performs:

1. **pick** — deterministically select the next workable ticket from `.scratch/`.
2. **implement** — a fresh pi session runs `/skill:implement @<ticket>`.
3. **verify** — a fresh pi session checks acceptance criteria and prints `VERDICT: PASS` / `VERDICT: FAIL: <reason>`.
4. **close** — deterministically mark the ticket `done`/`blocked` and guarantee a commit.

Steps 2 and 3 are the *only* places a model is called. Steps 1 and 4 are plain TypeScript.

## Design principles

These are load-bearing. Do not violate them without an explicit decision.

1. **Fresh session per step.** Never reuse a session across iterations. Context must not accumulate between steps.
2. **One ticket per iteration.** Work the frontier top-down. Do not batch.
3. **Deterministic core, one model seam.** All orchestration logic is pure TypeScript. The only call into the model is the `runStep(role, input)` interface. Do not call the pi SDK directly from orchestration code.
4. **The model writes code; the orchestrator owns state.** Only the orchestrator edits `Status`, ticks acceptance boxes, and decides transitions.
5. **Child output never enters the parent's model context.** Display via `pi.appendEntry` + `registerEntryRenderer`. Do **not** use `pi.sendMessage` for child output.
6. **Fail closed.** On verification failure, mark the ticket `blocked`, record a note, and stop. Never skip ahead.

## Architecture

```
extensions/loop.ts   ExtensionAPI entry. Parses /loop args, wires a runStep
                     implementation backed by the SDK, renders progress.
        │
        ▼
src/orchestrator.ts  The pick → implement → verify → close cycle.
        │
        ├── src/frontier.ts   Pure: which ticket is next?
        ├── src/tickets.ts    Pure-ish: parse + rewrite status and boxes.
        ├── src/git.ts        Clean-tree checks, commit guarantees.
        └── src/run-step.ts   The seam:
                              type StepRole = "implement" | "verify"
                              runStep(role, input): Promise<StepResult>
```

`runStep`'s SDK-backed implementation lives near `extensions/loop.ts`, not in `src/`. Tests and the orchestrator depend only on the interface.

### `runStep` contract (sketch)

```ts
type StepRole = "implement" | "verify";

interface StepInput {
  feature: string;
  ticketPath: string;
  baseCommit?: string;   // set for verify: diff base
  cwd: string;
  model?: string;
}

interface StepResult {
  ok: boolean;
  verdict?: "PASS" | "FAIL";   // parse from the verify session's final text
  finalText: string;
  sessionId: string;
}
```

Both roles are **normal pi sessions** (SDK defaults): project `AGENTS.md`, skills, and extensions are discovered from the project directory. Do not replace the system prompt or strip tools — using stock sessions is a deliberate decision.

## The loop contract

Status vocabulary, written into the ticket file:

```
ready-for-agent → in-progress → done
                        └─────→ blocked
```

- **Workable** = `Status: ready-for-agent` **and** every `Blocked by` ticket is `done`.
- Orchestrator sets `in-progress` immediately before the implement step.
- On `VERDICT: PASS`: tick acceptance boxes, set `done`, ensure the work is committed.
- On `VERDICT: FAIL`: set `blocked`, append a failure note, stop the run.
- Implement sessions normally commit their own work (per the `implement` skill). If the tree is still dirty at close, the orchestrator commits the remainder with a standard message. It never commits to `main`/`master`.

## Repo layout

```
package.json          pi package manifest: name, keywords ["pi-package"], pi manifest
extensions/loop.ts    ExtensionAPI entry
src/                  deterministic core
test/                 node:test suites + fixtures
.agents/skills/       project skills used by child sessions (implement, code-review, …)
docs/                 specs (to-spec)
.scratch/             tickets (to-tickets); worked one per iteration
.loop/runs/           per-run child transcripts (gitignored)
```

## Commands

```bash
npm install
npm run typecheck    # tsc --noEmit
npm test             # node:test via tsx
npm run pi           # start pi with this extension loaded
```

## Coding standards

- **TypeScript**, ESM, `strict: true`. No build step — the extension is loaded by pi's `jiti`.
- Prefer **pure functions** in `src/`. Keep filesystem access at the edges; do not hide I/O inside functions that look pure.
- Keep the seams minimal. The **ideal number of seams is one**: `runStep`. Prefer an existing seam over a new one.
- Error handling: fail closed. A verification failure or an ambiguous ticket state stops the run and preserves that state; never "helpfully" continue.
- Do not reference specific file paths or code snippets in spec-level docs; they go stale. Prototype snippets that encode a type shape are the exception.
- No hardcoded providers or model names anywhere in `src/`.
- Do not commit `.loop/runs/`, session transcripts, or secrets.

## Testing

- Test **external behavior**, not implementation details.
- Unit-test the deterministic core: frontier selection, ticket parsing/rewriting, status transitions, commit handling.
- Keep model calls behind `runStep`. Tests substitute a **fake** `runStep`; CI never calls a real model.
- Add a fixture repo under `test/fixtures/` with a couple of dependent tickets and a stub `runStep` that edits files and returns `VERDICT: PASS`; assert the loop walks the frontier, commits, and stops.
- Run `npm run typecheck` and `npm test` before considering work done.

## Guardrails — do not

- Add a model call outside `runStep`.
- Reuse a session across iterations.
- Use `pi.sendMessage` to display child output (use `pi.appendEntry`).
- Let the orchestrator write product code, or let the model edit `Status`/boxes.
- Commit to `main`/`master`.
- Continue past a failed verification.
- Bundle host-provided packages (`@earendil-works/pi-*`, `typebox`) in `dependencies`; declare them as `peerDependencies` with `"*"`.

## Documentation conventions

- `README.md` is for users and contributors: what it is, how to use it, how it works.
- `AGENTS.md` (this file) is for agents building the plugin: architecture, contracts, standards, guardrails.
- Specs live in `docs/`; tickets in `.scratch/`. Both follow the templates in `.agents/skills/`.

## Status

Pre-implementation. The code and tests described here do not exist yet; this document defines the target.
