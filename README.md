# Hackathon System

Everything you need to run a one-day hackathon's software, as a reusable agent skill plus starter code:

- **What to put on your event homepage**, and what to leave off.
- **A participant portal**: teams register themselves on the day with an event code, answer the judges'
  questions, and submit a site link and a demo video.
- **A judge portal**: every team at a glance with your marks and notes, then each team as four cards
  (answers, site, demo video, rubric) with a rubric that has a sentence for every score.
- **An admin page**: open and lock submissions, set the event code, add judges, rank teams by average score,
  export a CSV.

It was built for, and first used at, [BarkerHacks 2026](https://barkerhacks.org), a free one-day AI hackathon
for high school students in Sydney.

## What's here

| Path | What it is |
|---|---|
| [`SKILL.md`](SKILL.md) | The skill: decisions to settle first, deliverables, acceptance checks. Point your coding agent at it. |
| [`references/homepage.md`](references/homepage.md) | The homepage message: section order, FAQ set, what to cut. |
| [`references/portal.md`](references/portal.md) | How the portal works: architecture, data model, API, flows, deploys, security. |
| [`docs/working.md`](docs/working.md) | Decision log and lessons from real use, newest first. |
| [`template/`](template/) | The starter portal: static pages, one serverless API function, Postgres. |

## Quick start

1. Copy `template/` into your project and follow [`template/README.md`](template/README.md) to run it locally.
2. Change the event name, dates, team size and judging criteria (all listed in that README).
3. Deploy to Vercel with a Neon Postgres database, set `SESSION_SECRET` and `ADMIN_CODE`, and you're live.

Using a coding agent? Give it `SKILL.md`: it lists the decisions to ask you about before it writes anything.

## Status

Maintained alongside a live event; updated as the portal changes. See [`docs/working.md`](docs/working.md)
for what changed and why. Issues and pull requests are welcome.

## License

[MIT](LICENSE).
