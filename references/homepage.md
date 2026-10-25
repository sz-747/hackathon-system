# Homepage message

What the public event page says, in order, and why. Written from BarkerHacks 2026, an open, under-18, one-day
hackathon; adjust where your decisions differ (see the decision table in [`../SKILL.md`](../SKILL.md)). The
starter portal ships without a homepage, so build this page in your own design.

## Audience and tone

Students aged about 14-17 and their parents. Most have never been to a hackathon. Write directly to them:
short sentences, second person, plain words, your audience's local spelling. Lead with facts, then
reassurance.

## The core message

- **It's for anyone curious who wants to build.** Having built things before is a nice bonus that may help
  someone move faster, but it is not required and not what organisers look for.
- **No experience and no current project needed.** Come with an idea or find one on the day.
- **The idea matters most, not polish.** Nobody expects a finished product in a day.
- **You won't be alone.** Mentors, organisers and other students are in the room to learn from.
- **Free, one day, in person**, with the date, venue and hours stated plainly.
- **Teams of 2 to 4.** Come with friends, or come solo and team up at the briefing.

## Section order (2026)

1. **Hero**: eyebrow ("Free under-18 AI hackathon in Sydney"), event name + year, one paragraph (what, who,
   team size, date, venue), big "Sign up free" button, a reassurance line ("No experience or current project
   needed. Come with friends or come solo."), supporter logos.
2. **Who it's for**: "You don't need to have built anything before" + four points (no experience, the idea
   matters most, team of 2-4, learn on the day).
3. *(cut in 2026: a "Why BarkerHacks?" essay section and a three-number "build notice" strip under the logos)*
4. **Event details**: date, venue, hours, free, bring a laptop and charger.
5. **The day**: timeline from arrival to awards, including when the demo video is due and that judges watch
   videos (no live pitches).
6. **What you can build** and the tools provided. 2026: only a ChatGPT Pro subscription per team; list
   nothing that isn't confirmed (API credits and "more tooling announced later" were cut).
7. **Who can come + teams**: open eligibility, team formation, registering in the portal on the day.
8. **After you sign up**: what the email covers, parent/guardian consent for under-18s.
9. **FAQ** (below), **closing call to action**, organisers, footer.

A sign-up button stays pinned top-right on every screen. A quiet **Team portal** pill sits beside the menu
(hidden on phones), and the footer links **Team portal** and **Judge portal**. Not a big portal button before
the event: the portal is locked until it starts, and a prominent button would suggest teams must register now.
**Event day**: make the pinned button swap itself to *Team portal →* during event hours (a few lines of
script comparing the time with two constants, plus a `?eventday=1` override for previewing). Put a QR code to
`/portal` and the event code on the briefing screen.

## FAQ set

Is there an under-18 hackathon in [city]? · Who can come? · When and where? · Is it free? · How do I sign up?
· What do I need to do before the event? · How is judging done? · How does team formation work? · How do I
connect to the WiFi? · How do I get the AI tools? · How do I submit?

Each answer is two to four sentences and repeats the key fact (date, team size, lock time) rather than
pointing elsewhere.

## Cut in 2026, and why

| Removed | Reason |
|---|---|
| Application deadline and "places are limited" | Sign-up is open; a deadline put people off |
| Selection criteria and "assessed on evidence" section | The event is not selective; it read as gatekeeping |
| "Strongest young builders", "evidence you've built" | Pushed away beginners, the main audience |
| Three tracks and live finalist pitches | One track; judges watch videos instead |
| Teams of two, organiser-matched pairs | Teams of 2-4 self-register on the day |
| A second sign-up section just above the FAQ | Redundant once the sign-up button is pinned |
| "Build notice" strip (01 day, 25 schools, 04 things judged) | The school count was a placeholder; the strip added nothing the hero didn't say |
| "Why BarkerHacks?" section | Long essay copy; the "who it's for" section already makes the case |
| OpenAI API credits and "more tooling announced later" | Only a ChatGPT Pro subscription is provided |

## Search and AI-readable copies

Keep the page crawlable without JavaScript: real text for every fact (decorative mock cards are
`aria-hidden` and repeat nothing that is not also in text), one `h1`, an Event JSON-LD block, meta and Open
Graph descriptions that match the page, and a plain-text Markdown copy of the page regenerated from the HTML
after every copy change (a small script that walks the visible text is enough), plus an `llms.txt` updated by
hand when the message changes.
