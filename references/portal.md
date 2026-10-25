# Portal build

The participant, judge and admin portal in [`template/`](../template/), first built for BarkerHacks 2026. It is
deliberately small: static HTML pages plus one serverless function, so it can be copied and re-themed in an
afternoon. Paths below are relative to `template/`.

## Architecture

- **Pages** (static HTML, shared `assets/portal.css` and `assets/portal.js`): `portal.html` (teams),
  `judge.html`, `admin.html`, `pitch.html` (a team's answers as flash cards).
- **API**: one Node function, `api/index.js`, routed from `/api/*` by a rewrite. Paths: see below.
- **Database**: Postgres. Neon in production via `DATABASE_URL`; embedded PGlite locally and in previews.
  `lib/db.js` runs the schema (idempotent `create table if not exists` / `alter table ... add column if not
  exists`) on first connection, so a deploy migrates itself. Neon's HTTP driver takes one statement per call,
  so the schema's hash is stored in `schema_version` and an up-to-date database skips the ~16 statements
  (cold start: one query instead of sixteen).
- **Cold starts**: every API request, including the signed-out `GET me` a page makes on load, starts the
  database in the background, wrapped in `waitUntil` from `@vercel/functions` (Vercel pauses an instance once
  its response is sent, so plain background work stalls), so it is warm by the time someone submits a code. Sign-in buttons say
  "Signing in…" while waiting.
- **Sessions**: an HMAC-signed cookie (`lib/auth.js`), two weeks, `HttpOnly`, `Secure` on HTTPS.
  `SESSION_SECRET` is required in production (fail loudly if missing).
- **Codes**: 8 characters as `XXXX-XXXX` from an alphabet without look-alike characters. One code per team,
  one per judge, and an admin code from an environment variable.
- **Host config**: `/portal`, `/judge`, `/admin`, `/pitch` and `/api/*` are `no-store` and
  `noindex, nofollow`; `/lib/*` is blocked.

## Data model

| Table | Holds |
|---|---|
| `settings` (one row) | `opens_at`, `locks_at`, `force` (`''`, `open`, `locked`, `before`), `join_code`, `codex_prompt` |
| `teams` | `name`, `code` (unique), `created_at` |
| `members` | `team_id`, `name`, `school` (2-4 per team) |
| `pitches` | one row per team: the answers plus `site_url`, `video_url`, `updated_at` |
| `judges` | `name`, `code` |
| `scores` | `judge_id`, `team_id`, `criteria` (JSON, each 1-5), `score` (total), `notes` |
| `attempts` | failed sign-in counts per IP, shared by every function instance |

## API

```
POST login {code}                      team, judge or admin code -> session cookie
POST logout
POST register {join_code, name, members:[{name, school}]}   public; open window + right event code
GET  me                                everything the signed-in person may see
PUT  team {name, members:[{id?, name, school}]}             team; open window only
PUT  pitch {fields...}                 team; open window only (autosaved from the page)
GET  pitch?team=ID | ?all=1            answers for one team (own team) or all (judge/admin)
PUT  score {team_id, criteria, notes}  judge
GET  admin/overview   PUT admin/settings   POST admin/judge   POST admin/import
GET  admin/export (CSV)   DELETE admin/team?id=   DELETE admin/judge?id=
```

Errors are JSON `{error}` with a fitting status: 400 bad input, 401 not signed in, 403 wrong role, 404,
423 outside the open window (with the current `state`), 429 too many attempts.

## Phases

`before` → `open` → `locked`, from `opens_at` and `locks_at`, overridable by the admin's **Force** buttons.
Registration, team edits and answers only work while `open`. Sign-in works in every phase.

## Flows

**Team.** One person opens `/portal` → *Register a new team* → event code (announced at the briefing;
case and spacing ignored), team name, 2-4 names and schools → lands on the team page with the **team code**
shown large with a Copy button. Teammates sign in with that code. The page has: team card (explicit Save),
judges' questions (autosave), and *Submit your links* (site link, demo video link, a *Copy video prompt*
button that copies the admin's video prompt, an AI prompt such as one for Codex, and *Preview what judges read*).

**Judge.** Signs in with a judge code → **judging home**: progress strip ("N of M scored"), *How it works*,
*What you're scoring* (the four criteria with their guiding questions), a *Start judging* button (first
unscored team; "Carry on judging" or "Review from the start" later) and **every team as a card, three
across** (four on wide screens): name, project and tagline, people, missing video/site, the total out of 20
(no per-criterion breakdown), and the judge's own notes at the bottom. This is the comparison view for the final decision: the briefing folds into one line
once the judge has scored a team, and *Sort by Team order / Your score* lines teams up by their marks.
→ **team view**: a bar with *All teams*, *Previous* / a jump-to-team dropdown (✓ marks scored teams) /
*Next* (wrapping round), and "Team N of M"; then **four full-width cards**: Answers, Site, Demo video and
**Rubric**. The rubric card is a grid, criteria down the side and levels across (1 Poor, 2 Developing,
3 Solid, 4 Strong, 5 Outstanding), with a sentence in every cell; the judge clicks a cell. Below it: running
total /20 and notes. On the rubric card the footer under the card reads *Back · Save · Next team* (Save and
Next team replace *Next card*; Next team saves, then opens the next team in order). Moving to another team by any route saves unsaved marks first, and arrow keys flip cards unless the judge is typing. The rubric is its own card rather than a side panel because
the demo video is short enough to recall, and a full-width grid reads better. The rubric text lives in
`BH.criteria` in `portal.js`; the score form is moved into the rubric card each time the deck is rebuilt.

**Several judges.** Every judge sees and scores every team. Admin Results ranks teams by their average total
across judges and shows how many judges scored each; the CSV export has per-criterion averages. (Splitting
teams between judges is not built; see the open questions in the decision log.)

**Flash cards** (shared `BH.deck` in `portal.js`, used by the judge view and `/pitch`): answers → live site
preview with an *Open the site* button → the demo video embedded large (YouTube, Vimeo, Google Drive). Tabs,
Back / *Next card* (bottom right, under the card) and arrow keys. Answer text is 18px so it reads easily.

**Admin.** Tabs: Teams (codes, links, delete), Results (ranked by average score), Judges (add, codes),
Settings (window times, Force open/lock, event code, Codex prompt), Add a team (bulk import).

## Preview and deploy

- Previews must not touch live data. On Vercel, Preview shares Production's `DATABASE_URL`, so deploy
  previews with `PORTAL_DB=memory`, which forces PGlite. Each function instance has its own copy and admin
  changes don't carry across instances or idle resets, so a memory database seeds itself (`PREVIEW_SEED` in
  `lib/db.js`): portal open, event code `TEST`, a placeholder prompt, a demo judge `JUDG-TEST`, and two demo
  teams (`DEMO-OWLS` complete with site and video, `DEMO-FOXS` half done to show empty states).
- PGlite's `pglite.data`, `pglite.wasm` and `initdb.wasm` must be bundled into the preview function
  (`functions."api/index.js".includeFiles`). Keep that in the preview-only `vercel.preview.json`: it adds about 16 MB.
- Production: deploy the site folder with its own `vercel.json`; set `DATABASE_URL`, `SESSION_SECRET`,
  `ADMIN_CODE`; never set `PORTAL_DB` there.
- Vercel protects preview URLs with a login. Test them with `vercel curl`, or in a browser signed in to the
  Vercel team.

## Tests

`test/e2e.js` (Playwright, headless Chrome) runs the whole event against `node dev.js`: admin settings,
wrong then right event code, 2-4 limits, team edits, teammate sign-in, answers and links autosave, clipboard
copy of the video prompt, phone width, locking (register returns 423), judging home and *Start judging*,
Previous / Next / jump between teams, marks kept when moving teams, the rubric card grid and its *Back · Save ·
Next team* footer, flash cards, JSON-only writes, Results ranking and CSV. Run it on a fresh server (`PORT=<free port>`, `BASE=http://127.0.0.1:<port>`).

## Security notes

- The register endpoint is public; the event code is what stops strangers creating teams. There is no other
  public write endpoint (an old public sign-up endpoint was removed: sign-ups go through an external form).
- Wrong codes: 50 per 10 minutes per IP, stored in the database. On shared event WiFi a whole room shares one
  IP, so a low limit locks everyone out; codes have ~850 billion combinations, so 50 guesses is no real risk.
- Session cookie: HMAC-signed, `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS. Writes (POST/PUT) must be
  `application/json` (415 otherwise), which plain cross-site HTML forms cannot send.
- Every page sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` and a strict referrer policy.
- All user text reaches the page through `BH.esc`; links go through `BH.href` (forces `https://`, so no
  `javascript:` URLs); video embeds only build YouTube, Vimeo or Drive URLs from a captured ID.
- The CSV export prefixes cells starting with `= + - @` with an apostrophe (spreadsheet formula injection).
- Dependencies: `npm audit --omit=dev` must be clean; pin new packages to versions at least two weeks old.
- No personal data beyond names and schools inside the portal. Contact details stay in the sign-up form.
