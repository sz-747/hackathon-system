# Maintaining this repository

- `SKILL.md` is the agent-facing contract; `references/` and `docs/` hold the detail; `template/` is the code
  the references describe. README files are for people.
- When the portal changes, change `template/`, `references/portal.md` and `docs/working.md` together, so the
  docs never describe code that isn't there.
- Before committing template changes: `node --check` on edited JS, then the end-to-end test against a fresh
  `node dev.js` (see `template/README.md`). `npm audit --omit=dev` must be clean.
- Commit small, one change per commit, with a message that says what changed.
- Never commit secrets, real participant data, access codes from a live event, or private hosting details.
  Example codes in docs and tests (`TEST`, `TEST-ADMN`, `JUDG-TEST`) are fine.
