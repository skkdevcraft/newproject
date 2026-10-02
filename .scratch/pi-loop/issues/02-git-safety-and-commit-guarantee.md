# 02 — Git safety and the commit guarantee

**What to build:** Everything the loop needs from git. It can tell whether the working tree is clean, report the current branch and refuse to run on a default branch, capture the commit that implementation starts from so verification can diff against it, detect whether the implement step already committed, and commit any remaining changes at close with a standard message. It never creates, switches, or pushes branches.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Reports whether the working tree is clean.
- [ ] Reports the current branch and refuses to start on `main`/`master` unless forced.
- [ ] Captures the current commit before implementation as the verification diff base.
- [ ] Detects a commit made by the implement step and does not create a redundant one.
- [ ] Commits remaining changes at close with a standard message when the implement step left the tree dirty.
- [ ] Never creates, switches, or pushes branches; reports a clear failure when a commit cannot be made.
