# 06 — Live visibility: child entries, footer, and run transcripts

**What to build:** Full visibility into the autonomous run without polluting the parent model's context. As each child step runs, its finalized assistant messages, tool calls, and tool results are appended to the parent transcript as `loop:child` entries through `pi.appendEntry`, never `pi.sendMessage`. A footer status line shows the current phase and context pressure. Each run's full child transcripts are persisted under `.loop/runs/<run-id>/` for later inspection and are never read back into a model.

**Blocked by:** 05 — The SDK-backed `runStep` seam.

**Status:** ready-for-agent

- [ ] Child assistant messages, tool calls, and tool results appear in the parent transcript as they happen.
- [ ] Child output is displayed with `pi.appendEntry` and a registered renderer; `pi.sendMessage` is not used for it.
- [ ] Child content never enters the parent model's context.
- [ ] A footer status line shows the live phase and ticket progress, e.g. `loop 3/7 · implementing · 12.3k ctx`.
- [ ] Each run's child transcripts are persisted under `.loop/runs/<run-id>/`, and `.loop/runs/` stays gitignored.
- [ ] Persisted transcripts are never read back into any model.
