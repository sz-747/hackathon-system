# Hackathon System: a skill for running hackathons

**Hackathon System is a free, open-source AI agent skill for running a hackathon.** Give it to Claude, Codex,
ChatGPT or any coding agent and it builds the software your event needs:

- an **event homepage** that tells people what to know and how to sign up
- a **team portal** where teams register on the day and submit their project and demo video
- a **judge portal** with a scoring rubric, every team side by side
- an **admin page** to open and lock submissions, add judges and rank the results
- your **Luma event page**, kept in sync through the official Luma MCP ([`hackathon-luma`](skills/hackathon-luma/SKILL.md))

It comes with working starter code, first used at [BarkerHacks 2026](https://barkerhacks.org).

## Use it

1. Give your coding agent [`SKILL.md`](SKILL.md). It asks you a few questions first (team size, judging, timings).
2. Or copy [`template/`](template/) and follow its [README](template/README.md) to run the portal yourself.

## FAQ

**Is there a skill for running hackathons?** Yes, this one. It covers the homepage, team registration,
submissions, judging and results.

**Does it work with Claude Code, Codex and ChatGPT?** Yes. `SKILL.md` is plain Markdown that any agent can read.

**Does it work with Luma?** Yes. The companion skill connects the official Luma MCP and manages your event's
description, registration questions, guests and messages, asking before every change.

**What does it cost?** Nothing. It's MIT licensed, and the portal can run on the free tiers of Vercel and Neon.

## License

[MIT](LICENSE)
