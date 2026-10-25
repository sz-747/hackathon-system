# Starter portal

A team portal, judge portal and admin page for a one-day hackathon: static HTML pages, one Node serverless
function (`api/index.js`) and Postgres. How it works is described in
[`../references/portal.md`](../references/portal.md).

| Page | Who | What |
|---|---|---|
| `/portal` | Teams | Register with the event code, edit the team, answer the judges' questions, submit links |
| `/judge` | Judges | Every team at a glance, then each team's answers, site, video and rubric |
| `/admin` | Organisers | Open and lock submissions, event code, video prompt, judges, results, CSV |
| `/pitch?team=ID` | Team, judges, admin | One team's answers as flash cards |

## Run it locally

Needs Node 20 or later. No database setup: locally it uses an embedded PGlite Postgres.

```bash
npm install
ADMIN_CODE=TEST-ADMN node dev.js          # http://127.0.0.1:8790
```

On Windows PowerShell: `$env:ADMIN_CODE='TEST-ADMN'; node dev.js`.

Open `/admin`, sign in with `TEST-ADMN`, then in **Settings** set an event code, save, and press **Force open**.
Register a team at `/portal` with that code. Add a judge in **Judges** and sign in at `/judge` with their code.

To start with demo data instead, add `PORTAL_DB=memory`: the database starts open with event code `TEST`, a
judge `JUDG-TEST` and two demo teams.

## Make it yours

| Change | Where |
|---|---|
| Event name ("HackDay") | The wordmark and `<title>` in each `.html` file, and `index.html` |
| Team size (2-4) | `TEAM_MIN` / `TEAM_MAX` in `api/index.js`, and `MIN` / `MAX` in `portal.html` |
| Judging criteria and rubric sentences | `BH.criteria` and `BH.LEVELS` in `assets/portal.js`, and `CRITERIA` in `api/index.js` |
| Judges' questions | `PITCH_FIELDS` and `LIMITS` in `api/index.js`, the form in `portal.html`, and the answers card in `BH.deck` (`assets/portal.js`) |
| Time zone (Australia/Sydney) | `SYD` in `assets/portal.js` |
| Default open and lock times | The `insert into settings` line in `lib/db.js` (also editable in admin **Settings**) |
| Colours and fonts | The tokens at the top of `assets/portal.css` |
| Home page | `index.html` is a placeholder: replace it with your event homepage |

## Deploy (Vercel + Neon)

1. Create a Vercel project from this folder and add a Neon Postgres database (it sets `DATABASE_URL`).
2. Set `SESSION_SECRET` (a long random string) and `ADMIN_CODE` (a random `XXXX-XXXX` code) for Production.
   See `.env.example`. The tables are created on the first request.
3. Deploy: `vercel deploy --prod`.

**Previews must not touch the live database**, because Vercel previews share Production's `DATABASE_URL`.
Deploy previews with a throwaway database:

```bash
vercel deploy --local-config vercel.preview.json -e PORTAL_DB=memory -e ADMIN_CODE=<a preview code>
```

## Test

```bash
npm install --no-save playwright-core
npx playwright install chromium        # or set CHROME_PATH to an installed Chrome
PORT=8791 ADMIN_CODE=TEST-ADMN node dev.js &
BASE=http://127.0.0.1:8791 node test/e2e.js
```

Use a fresh server each run (the test registers teams). It covers registration, team edits, answers and links,
locking, the judge flow and rubric, results, CSV export, and the security checks.

## Before the event

- In admin **Settings**: set the event code you'll announce, check the open and lock times, paste the video
  prompt if you use one.
- Add the judges and hand out their codes.
- Delete any test teams.
- Put a QR code to `/portal` and the event code on the briefing screen.
