# 01 — Ticket model and frontier selection

**What to build:** The deterministic ticket engine the loop is built on. Given a feature folder of ticket files, the plugin reads each ticket's `Status`, `Blocked by` references, and acceptance boxes; decides which tickets are *workable*; and returns the next ticket to work, in dependency order. It can rewrite a ticket's status and tick its acceptance boxes in place without disturbing the rest of the file. A ticket with a missing or malformed status is reported and excluded rather than crashing the run. A ticket left `in-progress` by a crash is treated as workable again so the run can resume.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Reads `Status`, `Blocked by` references, and `- [ ]` acceptance boxes from a feature's ticket files.
- [x] A ticket is workable only when its status is `ready-for-agent` (or `in-progress`, for crash recovery) and every ticket it lists under `Blocked by` is `done`.
- [x] The next workable ticket is returned in dependency order; blocked and malformed tickets are excluded.
- [x] Rewriting a status or ticking an acceptance box preserves the rest of the ticket file unchanged.
- [x] A missing or malformed status is reported and skipped safely, never causing a wrong pick or a crash.
