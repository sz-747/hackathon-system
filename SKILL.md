---
name: hackathon-system
description: Stand up a hackathon or student build event fast - the public homepage message and a participant, judge and admin portal (self-registered teams, submissions, video-based judging, results). Use when hosting a hackathon or build event and you need the event site, sign-ups, team registration, submission form, judging screens or admin controls. Not for entering someone else's hackathon.
---

# Hackathon System

**Category:** Workflow. **Status:** living skill, first built for BarkerHacks 2026 (a one-day high school AI
hackathon) and updated as it is used (see the [decision log](docs/working.md)).

## Goal

Ship, in as little time as possible, everything an organiser needs to run a one-day hackathon:

1. A **public homepage** that tells people what the event is, who it is for and how to sign up.
2. A **participant portal** where teams register themselves on the day, answer the judges' questions and
   submit their site and demo video.
3. A **judge portal** where judges compare every team, watch each team's video, read the answers, open the
   site and score against a written rubric.
4. An **admin page** to set the event code, open and lock submissions, add judges, see teams and rank results.

**Does not cover:** venue, catering, sponsorship or prizes; visual design beyond the starter's look (re-theme
`template/assets/portal.css` with your own brand); entering a hackathon as a competitor.

## Inputs to settle first

Most rework comes from changing these mid-way. Ask the organiser for each one before writing copy or code,
and record the answers in the project. The example column is what BarkerHacks 2026 ended with.

| Decision | Example (BarkerHacks 2026) |
|---|---|
| Who can come; selective or open | Open: any under-18 high school student in the city, no experience needed |
| Sign-up deadline | None shown |
| Team size | 2 to 4 |
| How teams form | Self-registered on the day with an event code; solo people team up at the briefing |
| Tracks | One |
| Judging | No live pitches; judges watch a short demo video and read the answers |
| Criteria | Problem, Solution, Build, Pitch (video); each 1-5 with a sentence per level, total /20 |
| Submission | Answers to the judges' questions, a public site link, a demo video link |
| Timings | Portal opens at the start, submissions lock before judging |
| Helpers | A copyable AI prompt that edits the demo video for the team |
| Several judges | Every judge scores every team; results rank by the average |
| Sign-ups | An external form; events listed on Luma use `hackathon-luma` |

## Resources

- [Homepage message](references/homepage.md): section order, what to say and what to cut, FAQ set.
- [Portal build](references/portal.md): architecture, data model, API, flows, preview and deploy pattern,
  tests and security.
- [Decision log](docs/working.md): dated decisions and lessons with their evidence. Read it before starting.
- [`hackathon-luma`](skills/hackathon-luma/SKILL.md): companion skill for events that list on Luma. It connects
  the official Luma MCP and keeps the Luma event (description, registration, guests, messages) in line with
  the homepage.
- [Starter portal](template/): working code for everything in the portal reference. Copy it and change the
  event settings listed in [`template/README.md`](template/README.md); that is the fastest path.

## Acceptance checks

The system is ready for an event when all of these were checked, with the evidence reported:

1. The homepage states date, place, cost, who can come, team size and how to sign up above the fold, and
   contains nothing contradicted by the decisions above (no stale deadline, team size or track wording).
2. On a fresh database: admin sets the event code and opens the portal; a team registers with the code, gets
   a team code, a teammate signs in with it; answers and links save; a judge sees every team, scores it and
   moves to the next; the admin Results tab ranks by score; the CSV export opens. The end-to-end test covers
   this (`node test/e2e.js` against a local server).
3. Registration fails cleanly with a wrong event code, outside the open window, and with too few or too many
   people.
4. Pages work at 390px wide with no horizontal scroll.
5. A preview deployment uses a throwaway database, never the production one.
6. Production has its own session secret and admin code; the portal is locked until the event starts.

State which checks ran and which did not.

## Output

The event site and portal in the target project, deployed to a preview for the organiser to try, then to
production on their go-ahead; plus a short report of the acceptance checks.

## Keeping this skill current

After any change to the homepage message or portal (new feature, bug fix, reversed decision), update the skill
in the same piece of work: a dated line in [docs/working.md](docs/working.md) saying what changed and why; the
affected reference file brought up to date; a known pitfall only from a real failure, with what showed it.
