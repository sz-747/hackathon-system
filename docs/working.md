# Decision log

Dated decisions and lessons from real use, newest first. The first event was BarkerHacks 2026 (one day,
high school students, AI tools, about a week of portal iteration before the event). Add a line whenever the
homepage message or the portal changes, and keep `../references/*.md` describing the current design.

## Decisions

- **2026-10-26** Homepage trimmed: a three-number "build notice" strip and a "Why this event?" essay section
  were removed; the tools provided were cut to what was actually confirmed (one AI subscription per team).
- **2026-10-26** Homepage: a quiet Team portal link beside the menu, Team portal and Judge portal in the
  footer, and the pinned Sign up button swaps to Team portal automatically during event hours.
- **2026-10-26** Went live with everything below.
- **2026-10-26** Pre-launch security sweep: removed an unused public sign-up endpoint (sign-ups go through an
  external form), JSON-only writes, sign-in limit 50 per 10 minutes per IP (shared WiFi), CSV
  formula-injection guard, anti-framing and nosniff headers, clear error for a deleted judge, warm-up without
  an extra query per request, a transitive `zod` version overridden to clear `npm audit`.
- **2026-10-26** Rubric card footer simplified to Back · Save · Next team; Next team goes to the next team in
  order rather than the next unscored one.
- **2026-10-26** Rubric moved from a side panel to a fourth card laid out as a horizontal grid; team cards on
  the judging home show only the total and the notes. Reason: demo videos are short enough to recall on the
  rubric card, and the grid reads better full width.
- **2026-10-26** Rubric gained a sentence for every level (1 Poor to 5 Outstanding) of each criterion; the judge
  team view uses the full screen width.
- **2026-10-26** Judging home shows every team as a card, three across, with the judge's total and notes at the
  bottom; the briefing folds away after the first score; sort by team order or score. Reason: judges decide
  while seeing every team at once, not one team at a time.
- **2026-10-26** Preview databases seed a demo judge (`JUDG-TEST`) and two demo teams, so the judge flow can be
  tried on a preview without relying on admin changes reaching the same server instance.
- **2026-10-26** Judge portal reworked into a judging home (how it works, the criteria, *Start judging*, team
  index) and a team view with Previous / jump / Next and the team's flash cards. Marks auto-save when moving
  between teams.
- **2026-10-26** Answers page (`/pitch`) became flash cards (answers, site preview, video); print button
  removed: judges want the video large, not paper.
- **2026-10-26** Site link accepts any public site (an AI-builder's hosted site or a Vercel production link).
- **2026-10-26** The video prompt became a single *Copy video prompt* button: teams film once and paste the
  prompt into their AI coding tool, which edits the video and offers a few styles to pick from.
- **2026-10-26** Portal cards straightened (no tilt) and two-column inputs aligned.
- **2026-10-25** Homepage rewritten: open to anyone curious, no deadline, no selection, teams of 2-4, idea over
  polish; the sign-up button pinned.
- **2026-10-25** Portal: one track; teams of 2-4 self-register on the day with an event code; no live pitches,
  judges watch videos; admin Results tab.

## Known pitfalls (with evidence)

- **~5 s wait after pressing a sign-in button on a cold preview.** Warm requests took ~0.15 s; the wait was a
  cold function booting the database only when the sign-in arrived. Fix: start the database on every request
  including page load, skip the schema when its hash matches, and show "Signing in…". A plain un-awaited
  warm-up did nothing on Vercel (still 6.2 s) because the instance pauses after the response; wrapping it in
  `waitUntil` brought a cold sign-in to 0.45 s.
- **Previews can write to the live database.** Vercel Preview shares Production's `DATABASE_URL`. Fix:
  `PORTAL_DB=memory` on previews.
- **Preview 500: PGlite data missing.** `ENOENT pglite.data` until the PGlite files were added to the
  function's `includeFiles` (see `template/vercel.preview.json`).
- **"Portal opens when the event starts" kept reappearing on a preview** after the admin forced it open: each
  serverless instance had its own memory database. Fix: seed preview databases open.
- **Pinned button hidden behind sections.** It lived inside a header whose `z-index` made a stacking context;
  moved to `body`.
- **Broken script from copy edits.** An apostrophe inside a single-quoted JS string stopped a page loading;
  the end-to-end test caught it. Run `node --check` on edited JS.
- **Git-triggered builds built the wrong app.** The hosting project pointed at the repo root, not the site
  folder. Deploy the site folder explicitly, or set the project's root directory.

## Open questions

- With several judges: does every judge score every team (current), or are teams split between judges so
  judging runs in parallel (needs judge-team assignment and a fairness check on averages)?
- Whether AI-builder hosted sites can be published publicly; a Vercel production link is the fallback.
