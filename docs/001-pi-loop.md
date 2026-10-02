---
status: ready-for-agent
---

# pi-loop — Spec

## Problem Statement

Developers running pi against **locally hosted models** hit a context wall. Such models run on modest hardware with small *effective* context windows; a long agent session accumulates history until answer quality degrades or the window overflows. Token cost is not the concern — context size is.

At the same time, working a backlog of `.scratch/` tickets with pi is a manual loop. A human opens pi, picks the next unblocked ticket, invokes `/implement`, reviews the result, marks the ticket done, and makes sure a commit exists — then repeats with a fresh context, because carrying the previous ticket's history forward is exactly what degrades the model. The manual repetition is tedious, easy to skip (people let one session sprawl across many tickets), and gives no bounded, resumable run.

There is currently no way to say "work this ticket backlog to completion, one ticket at a time, without ever letting context accumulate, and stop if something goes wrong."

## Solution

`pi-loop` is a pi extension exposing a `/loop [feature-slug]` command. It works the tickets under `.scratch/<feature-slug>/issues/` to completion, **one ticket per iteration**, using **a fresh pi session for every step that needs a model**.

Each iteration is the same four-step cycle:

1. **Pick** — deterministic: choose the next *workable* ticket (status `ready-for-agent`, every `Blocked by` ticket `done`). If none exists, exit.
2. **Implement** — a brand-new pi session runs `/skill:implement @<ticket>`.
3. **Verify** — a different brand-new pi session checks the ticket's acceptance criteria against the diff and prints a machine-parseable verdict.
4. **Close** — deterministic: on `PASS`, tick the acceptance boxes, set the ticket `done`, and guarantee a commit; on `FAIL`, set the ticket `blocked`, record a note, and stop the loop.

Only steps 2 and 3 call a model. Everything else is plain TypeScript, so the loop is deterministic, inspectable, and testable. Because no session is reused, context never accumulates between tickets. Child session output is streamed into the TUI for full visibility but is deliberately kept **out of the parent model's context**.

The result: a user on a weak local model can hand off a whole ticket backlog and get bounded, resumable, fail-closed progress.

## User Stories

1. As a developer using a local model, I want to run a whole ticket backlog to completion in one command, so that I do not have to babysit each ticket manually.
2. As a developer using a local model, I want each model-backed step to run in a fresh session, so that context never grows across tickets and quality does not degrade.
3. As a developer using a local model, I want the orchestrator to be deterministic code rather than another model, so that ticket selection and bookkeeping are predictable and cheap.
4. As a developer, I want to invoke the loop with `/loop <feature-slug>`, so that I can choose which ticket set to work.
5. As a developer, I want `/loop` with no argument to work when exactly one feature folder exists, so that the common single-feature case is frictionless.
6. As a developer, I want `/loop` with no argument to refuse when multiple feature folders exist, so that I do not accidentally work the wrong backlog.
7. As a developer, I want `/loop` with no argument to exit cleanly when no tickets exist, so that running it on an empty backlog is harmless.
8. As a developer, I want the loop to pick only the *frontier* ticket — `ready-for-agent` with all blockers `done` — so that tickets are worked in dependency order.
9. As a developer, I want the loop to work one ticket per iteration, so that each ticket gets its own fresh context.
10. As a developer, I want the loop to stop when no workable ticket remains, so that a run terminates on its own.
11. As a developer, I want the implement step to call the existing `implement` skill, so that the loop respects the project's established workflow rather than inventing a new one.
12. As a developer, I want the implement step to run in a normal pi session with the project's `AGENTS.md`, skills, and extensions available, so that the model follows the project's own rules.
13. As a developer, I want the verify step to run in its own fresh session, so that verification is not biased by the implement session's reasoning.
14. As a developer, I want the verify step to check the ticket's acceptance criteria against the actual diff and working tree, so that "done" reflects reality.
15. As a developer, I want verification to end in a single machine-parseable `VERDICT: PASS` or `VERDICT: FAIL: <reason>` line, so that the orchestrator can gate on it deterministically.
16. As a developer, I want the diff base recorded before implementation, so that verification measures exactly the change the ticket produced.
17. As a developer, I want a passing ticket's acceptance boxes ticked automatically, so that the ticket file reflects completion.
18. As a developer, I want a passing ticket's status set to `done`, so that it stops being workable and unblocks dependents.
19. As a developer, I want a commit guaranteed for every passing ticket, so that the work is never left uncommitted.
20. As a developer, I want the implement skill's own commit to count, so that the loop does not create redundant commits when the work is already committed.
21. As a developer, I want the orchestrator to commit any remaining changes at close if the implement session did not, so that the commit guarantee always holds.
22. As a developer, I want a failing ticket's status set to `blocked`, so that the loop does not immediately retry it and hide the problem.
23. As a developer, I want a failure note recorded on a blocked ticket, so that a human can see why it stopped.
24. As a developer, I want the loop to stop on the first verification failure, so that later tickets that depend on the failed one are not worked on a broken base.
25. As a developer, I want the loop never to skip a failed ticket, so that dependency order is preserved.
26. As a developer, I want the orchestrator to own every status transition, so that the model never edits bookkeeping state.
27. As a developer, I want the model to write only product code, so that responsibilities stay clear.
28. As a developer, I want a ticket left `in-progress` by a crash or `Ctrl-C` to be re-run on the next invocation, so that a half-finished run is recoverable.
29. As a developer, I want a warning when re-running an `in-progress` ticket, so that I know state was left behind.
30. As a developer, I want `/loop` to refuse to start on a dirty working tree, so that the commit boundary is unambiguous.
31. As a developer, I want `/loop` to refuse to run on `main`/`master`, so that automated commits do not land on a default branch.
32. As a developer, I want `--force` to override the dirty-tree and default-branch refusals, so that I keep control in exceptional cases.
33. As a developer, I want the loop to commit only to the current branch and never create branches, so that branch strategy stays mine.
34. As a developer, I want `/loop` to run blocking with graceful `Ctrl-C`, so that I can stop a long local-model run without corrupting state.
35. As a developer, I want `--max <n>` to bound the number of iterations, so that a runaway is prevented.
36. As a developer, I want `--dry-run` to print the frontier and planned order without changing anything, so that I can preview a run.
37. As a developer, I want to see every child session's assistant messages, tool calls, and tool results in the transcript, so that I have full visibility into what the autonomous run is doing.
38. As a developer, I want child output displayed without entering the parent model's context, so that visibility does not defeat the context-minimization goal.
39. As a developer, I want a footer status line showing the current phase and context pressure, so that I can see progress and headroom at a glance.
40. As a developer, I want each run's child transcripts persisted to disk, so that I can inspect a finished or failed run afterwards.
41. As a developer, I want persisted child transcripts never read back into any model, so that they cannot re-inflate context.
42. As a developer, I want the implement and verify sessions to use the model I am already using, so that `/loop` works with my local setup without configuration.
43. As a developer, I want `--model` and `--verify-model` overrides, so that I can use a stronger model for verification if I choose.
44. As a developer, I want the thinking level inherited from the parent session, so that the loop does not silently change model behavior.
45. As a developer, I want the plugin to hardcode no provider or model name, so that it works with LM Studio, llama.cpp, Ollama, and any other local backend.
46. As a developer, I want the plugin to have no configuration file, so that flags and existing pi settings are the only knobs.
47. As a developer, I want context pressure within a single step handled by pi's normal compaction, so that the plugin does not invent its own compaction policy.
48. As a developer, I want a ticket with malformed or missing status to be reported and skipped safely, so that a bad file does not crash the run or cause a wrong pick.
49. As a developer, I want a ticket whose blocker is not `done` to be excluded from the frontier, so that blocked work is never started early.
50. As a developer, I want the loop to be resumable by simply re-running it, so that no separate resume command is needed.
51. As a developer, I want the plugin packaged as a pi package (`@skkdevcraft/pi-loop`), so that it can be installed via `pi install` or loaded with `pi -e .`.
52. As a maintainer, I want the deterministic core tested without a real model, so that CI is fast and reliable.
53. As a maintainer, I want a single injectable model seam, so that the whole orchestration is testable by substituting one fake.
54. As a maintainer, I want the extension to load without a build step via pi's jiti runtime, so that development is fast.
55. As a maintainer, I want the project to typecheck and test from npm scripts, so that contribution has a clear baseline.
56. As a maintainer, I want the spec, architecture, and guardrails documented, so that contributors and agents build the plugin consistently.

## Implementation Decisions

### Packaging and entry point
- The project is a **pi package** named `@skkdevcraft/pi-loop`, with the `pi-package` keyword and a `pi` manifest exposing the extension entry (`extensions/loop.ts`).
- It is **extension-first**: the extension registers the `/loop` command. Orchestration is a module the command calls into, not logic embedded in the command handler.
- Host-provided packages (notably `@earendil-works/pi-coding-agent`) are declared as `peerDependencies` with `"*"`, never bundled in `dependencies`.
- TypeScript is loaded directly by pi's `jiti`; there is **no build step**. Typechecking is `tsc --noEmit`.

### The single seam
- The only place a model is called is one injectable interface, `runStep(role, input)`. Orchestration code must not import the SDK directly.
- Type shape (decision-rich; keep authoritative):

```ts
type StepRole = "implement" | "verify";

interface StepInput {
  feature: string;
  ticketPath: string;   // absolute
  baseCommit?: string;  // set for verify
  cwd: string;
  model?: string;       // inherited from parent when omitted
}

type StepVerdict = "PASS" | "FAIL";

interface StepResult {
  ok: boolean;
  verdict?: StepVerdict; // verify only
  finalText: string;
  sessionId: string;
}

type RunStep = (role: StepRole, input: StepInput) => Promise<StepResult>;
```

### Session construction
- Both roles are **normal pi sessions** using the SDK defaults: the project's `AGENTS.md`, skills, extensions, tools, and settings are discovered from the project directory. We deliberately do **not** replace the system prompt or strip tools.
- The **implement** prompt forces the `implement` skill (it has `disable-model-invocation: true`) and references the ticket.
- The **verify** prompt asks for a check of each acceptance criterion and mandates a final line of exactly `VERDICT: PASS` or `VERDICT: FAIL: <reason>`. The orchestrator parses that line from the session's final text.
- The orchestrator records the current commit **before** the implement step and passes it as `baseCommit` to verify.
- Sessions are persisted (SDK default) for audit but are **never read back** into any model.
- The model defaults to the model active in the parent session; `--model` overrides it and `--verify-model` overrides verification separately.
- The thinking level is inherited from the parent session.

### Ticket state and transitions
- Tickets retain their existing format: a `Status:` field and `- [ ]` acceptance boxes, plus `Blocked by` references.
- Status vocabulary:

```
ready-for-agent → in-progress → done
                        └─────→ blocked
```

- A ticket is **workable** iff `Status: ready-for-agent` **and** every ticket in its `Blocked by` is `done`.
- The orchestrator sets `in-progress` immediately before the implement step, `done` on `VERDICT: PASS`, and `blocked` (with a note) on `VERDICT: FAIL`.
- A ticket found `in-progress` at start is treated as workable again, with a warning.
- The **orchestrator owns every status transition and the metadata commit**; the model writes only product code.
- Commit guarantee: the `implement` skill normally commits its own work; if the tree is still dirty at close, the orchestrator commits the remainder with a standard message. The loop never commits to `main`/`master`.

### Command contract
- `/loop [feature-slug]` with flags `--model`, `--verify-model`, `--max <n>` (default 10), `--dry-run`, `--force`.
- Runs blocking; `Ctrl-C` cancels gracefully, leaving the current ticket `in-progress`.
- Preconditions: a git repository, a clean working tree, a non-default branch, and a resolvable feature folder. Dirty tree or default branch is refused unless `--force`.

### Visibility
- Child output is appended to the parent transcript as custom entries via `pi.appendEntry(customType, data)` with a registered entry renderer. These entries are stored but **never sent to the model**.
- `pi.sendMessage` is deliberately **not** used for child output, because it would inject child content into the parent's context.
- A footer status line shows the live phase and context size, e.g. `loop 3/7 · implementing · 12.3k ctx`.
- Full child transcripts are persisted under `.loop/runs/<run-id>/`, which is gitignored. `.loop/` state is otherwise derived and need not be committed.

### Tooling
- Tests use Node's built-in `node:test` runner via `tsx`; no additional test framework.
- No configuration file; behavior comes from flags, the parent session's model/thinking level, and pi settings.

## Testing Decisions

- **Good tests exercise external behavior, not implementation details.** Assert *what* the loop does to tickets, commits, and files — not internal call sequences.
- **One seam.** The model boundary is `runStep`. Unit and integration tests substitute a fake `runStep`; CI never calls a real model.
- **Unit-tested (deterministic core):**
  - Frontier selection: only `ready-for-agent` tickets with all blockers `done`, in dependency order; blocked and malformed tickets excluded.
  - Ticket parsing and rewriting: status field, acceptance boxes, blocker references.
  - Status transitions for pass, fail, crash-recovery (`in-progress` re-run).
  - `--dry-run` planning output changes nothing.
  - Precondition checks: dirty tree, default branch, missing/ambiguous feature folder, `--force` overrides.
  - Commit handling: implement-session commit is respected; missing commit is created at close; failure is reported when no commit can be made.
  - Verify verdict parsing: `PASS`, `FAIL`, and missing/garbled verdict.
- **Integration test:** a fixture repository under `test/fixtures/` containing a small dependency graph of tickets and a stub `runStep` that edits files and returns `VERDICT: PASS`; assert the loop walks the frontier, marks tickets `done`, creates commits, stops at the end, and stops (and blocks) on a stubbed failure.
- **Prior art:** none — this is a greenfield project with no existing test suite; the fixture-repo integration pattern is established here first.
- Run `npm run typecheck` and `npm test` before considering work complete.

## Out of Scope

- Creating, naming, switching, or pushing branches; opening PRs; pushing to remotes.
- Parallel or concurrent ticket execution.
- Remote issue trackers — only local `.scratch/<feature>/issues/*.md` files are supported.
- Generating the plan or tickets (that is `to-spec` / `to-tickets`).
- A planner or controller LLM session; the loop is deterministic.
- Token-level live streaming of child output (per-message entries only for now).
- UI beyond transcript entries and the footer status line.
- Scanning multiple feature folders at once.
- Custom compaction or context-budget policy beyond pi's defaults.
- Retrying or auto-fixing a failed verification.
- Non-git version control.
- Publishing/release automation and a package gallery listing.

## Further Notes

- **Status: pre-implementation.** The extension, orchestration core, and tests do not exist yet. This spec defines the target; `README.md` and `AGENTS.md` describe the same design for users and coding agents respectively.
- The earlier `loop/` prototype (an SDK wrapper that made a single `ai(prompt)` call) has been removed; this spec supersedes it.
- **Fresh session per step bounds context *across* tickets, not *within* a ticket.** A single implement step can still accumulate context while it reads files and runs tests; that pressure is handled by pi's normal compaction and is visible in the footer. This is intentional scope.
- The loop's only nondeterministic inputs are the model's implement output and its verification verdict; everything else is a pure function of the ticket files and git state.
- The `runStep` interface also cleanly allows a future CLI wrapper over the same core, though that is not in scope here.
