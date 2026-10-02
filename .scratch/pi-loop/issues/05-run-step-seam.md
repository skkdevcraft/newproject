# 05 — The SDK-backed `runStep` seam

**What to build:** The real model boundary behind the `runStep` interface. Every implement and verify call runs in a brand-new pi session that discovers the project's `AGENTS.md`, skills, extensions, and tools. Implement invokes the `implement` skill against the ticket; verify checks each acceptance criterion against the recorded diff base and the working tree and ends with a machine-parseable verdict. The model defaults to the parent session's model with `--model`/`--verify-model` overrides, and the thinking level is inherited. With this ticket, `/loop <feature>` runs the full cycle for real.

**Blocked by:** 04 — The pick → implement → verify → close cycle.

**Status:** ready-for-agent

- [ ] Implement steps run the `implement` skill against the ticket in a fresh, normal pi session.
- [ ] Verify steps run in a separate fresh session and receive the pre-implement base commit for the diff.
- [ ] The verify prompt requires a final line of `VERDICT: PASS` or `VERDICT: FAIL: <reason>`; parsing is deterministic, and a missing or garbled verdict is treated as a step that did not conclude and fails closed.
- [ ] Sessions use the parent session's model by default; `--model` and `--verify-model` override it; the thinking level is inherited.
- [ ] No provider or model name is hardcoded, and no session is reused across iterations.
- [ ] `/loop <feature>` runs the full cycle end-to-end against a real ticket backlog.
