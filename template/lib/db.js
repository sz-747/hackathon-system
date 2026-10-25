// One query function for both worlds: Neon Postgres in production (DATABASE_URL), an embedded
// PGlite Postgres for local development and tests (no env needed). Same SQL either way.
// PORTAL_DB=memory forces PGlite even when DATABASE_URL is set: previews share production's env,
// so a preview deployed with it gets a throwaway database instead of the live one, opened for testing.
'use strict';

let ready = null;

const SCHEMA = `
create table if not exists settings (
  id int primary key,
  opens_at timestamptz not null,
  locks_at timestamptz not null,
  force text not null default '',
  tracks jsonb not null default '["Track 1","Track 2","Track 3"]'
);
create table if not exists teams (
  id serial primary key,
  name text not null default '',
  track text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists members (
  id serial primary key,
  team_id int not null references teams(id) on delete cascade,
  name text not null,
  school text not null default '',
  email text not null default '',
  role text not null default '',
  code text not null unique,
  claimed_at timestamptz
);
create table if not exists pitches (
  team_id int primary key references teams(id) on delete cascade,
  app_name text not null default '',
  tagline text not null default '',
  audience text not null default '',
  problem text not null default '',
  solution text not null default '',
  mission text not null default '',
  value text not null default '',
  site_url text not null default '',
  video_url text not null default '',
  updated_at timestamptz
);
create table if not exists judges (
  id serial primary key,
  name text not null,
  track text not null default '',
  code text not null unique
);
create table if not exists scores (
  judge_id int not null references judges(id) on delete cascade,
  team_id int not null references teams(id) on delete cascade,
  score int,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (judge_id, team_id)
);
create table if not exists attempts (
  ip text primary key,
  n int not null default 0,
  window_start timestamptz not null default now()
);
alter table scores add column if not exists criteria jsonb not null default '{}';
alter table teams add column if not exists code text;
create unique index if not exists teams_code_key on teams (code);
alter table members alter column code drop not null;
alter table settings add column if not exists join_code text not null default '';
alter table settings add column if not exists codex_prompt text not null default '';
insert into settings (id, opens_at, locks_at)
  values (1, '2026-11-03T20:00:00Z', '2026-11-04T07:45:00Z')
  on conflict (id) do nothing;
`;

const PREVIEW_SEED = [
  "update settings set force = 'open', join_code = 'TEST', codex_prompt = 'Placeholder video prompt for the preview. Set the real one in admin Settings.' where id = 1",
  "insert into judges (name, code) values ('Preview Judge', 'JUDG-TEST')",
  "insert into teams (name, code) values ('Demo Owls', 'DEMO-OWLS'), ('Demo Foxes', 'DEMO-FOXS')",
  `insert into members (team_id, name, school)
     select id, 'Ada Lovelace', 'Northside High' from teams where code = 'DEMO-OWLS'
     union all select id, 'Alan Turing', 'Eastwood College' from teams where code = 'DEMO-OWLS'
     union all select id, 'Grace Hopper', 'Westfield Grammar' from teams where code = 'DEMO-OWLS'
     union all select id, 'Linus Torvalds', 'Northside High' from teams where code = 'DEMO-FOXS'
     union all select id, 'Margaret Hamilton', 'Southbank Girls' from teams where code = 'DEMO-FOXS'`,
  `insert into pitches (team_id, app_name, tagline, audience, problem, solution, mission, value, site_url, video_url, updated_at)
     select id, 'Rosterly', 'One roster every teacher can trust.',
       'Heads of department at high schools who build the casual-relief roster each morning.',
       'Rosters live in three spreadsheets and a group chat. By 8 am nobody knows who is covering period 2.',
       'A single board that pulls absences from the school system and suggests covers, with one tap to confirm.',
       'Give teachers their mornings back.',
       'Cuts the daily roster scramble from 40 minutes to 5 for one head of department, every school day.',
       'https://example.com', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', now()
     from teams where code = 'DEMO-OWLS'`,
  `insert into pitches (team_id, app_name, tagline, problem, updated_at)
     select id, 'StudyBuddy', 'Flashcards that quiz you back.', 'Revision is boring, so nobody does it until the night before.', now()
     from teams where code = 'DEMO-FOXS'`
];

async function connect() {
  let run;
  if (process.env.DATABASE_URL && process.env.PORTAL_DB !== 'memory') {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    run = (text, params) => sql.query(text, params);
  } else {
    let PGlite;
    try { PGlite = require('@electric-sql/pglite').PGlite; }
    catch (e) { const err = new Error('DATABASE_URL is not set: connect the Neon database to this project.'); err.code = 'NO_DATABASE'; throw err; }
    const db = process.env.PGLITE_DIR ? new PGlite(process.env.PGLITE_DIR) : new PGlite();
    await db.waitReady;
    run = async (text, params) => (await db.query(text, params)).rows;
  }
  // Schema statements one at a time: Neon's HTTP driver takes a single statement per call. That is ~16
  // round trips, so a database that already has this exact schema (recorded by hash) skips them: a cold
  // start then costs one query instead of sixteen.
  const version = require('crypto').createHash('sha256').update(SCHEMA).digest('hex').slice(0, 16);
  const applied = await run('select v from schema_version where id = 1', []).then(r => r[0] && r[0].v, () => null);
  if (applied !== version) {
    for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await run(stmt, []);
    await run('create table if not exists schema_version (id int primary key, v text not null)', []);
    await run('insert into schema_version (id, v) values (1, $1) on conflict (id) do update set v = excluded.v', [version]);
  }
  // A preview's throwaway database starts open with event code TEST, a placeholder video prompt, a demo
  // judge (JUDG-TEST) and two demo teams (DEMO-OWLS complete, DEMO-FOXS half done). Every function
  // instance gets its own copy, so anything saved in admin doesn't reach the others or survive an idle reset.
  if (process.env.PORTAL_DB === 'memory' && (await run('select join_code from settings where id = 1', []))[0].join_code === '') {
    for (const stmt of PREVIEW_SEED) await run(stmt, []);
  }
  return run;
}

/** Connect (and set up the schema) once per instance; later calls reuse the same promise. */
function warm() {
  if (!ready) ready = connect().catch(e => { ready = null; throw e; });
  return ready;
}

/** query(text, params) -> rows */
async function query(text, params = []) {
  const run = await warm();
  return run(text, params);
}

module.exports = { query, warm };
