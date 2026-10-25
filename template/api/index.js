// Hackathon portal API. One function, one router. Paths are relative to /api/.
//   POST login {code}             team, member, judge or admin code -> session cookie
//   POST logout
//   POST register {join_code, name, members:[{name, school}]}   public, only while the window is open
//   GET  me                        everything the signed-in person may see
//   PUT  team {name, members:[{id?, name, school}]}   member, only while the window is open
//   PUT  pitch {fields...}         member, only while the window is open
//   GET  pitch?team=ID | ?all=1    one-pager data (own team / judge or admin: any team)
//   PUT  score {team_id, criteria:{problem,solution,build,pitch}, notes}   judge (each 1-5, total /20)
//   GET  admin/overview  POST admin/import  POST admin/judge  PUT admin/settings
//   GET  admin/export    DELETE admin/team?id=  DELETE admin/judge?id=
// One track: every judge sees every team. The old track columns stay in the database, unused.
'use strict';
const { query, warm } = require('../lib/db');
const { waitUntil } = require('@vercel/functions');
const auth = require('../lib/auth');

const PITCH_FIELDS = ['app_name', 'tagline', 'audience', 'problem', 'solution', 'mission', 'value', 'site_url', 'video_url'];
const TEAM_MIN = 2, TEAM_MAX = 4;
const LIMITS = { app_name: 80, tagline: 160, audience: 600, problem: 1200, solution: 1200, mission: 600, value: 800, site_url: 400, video_url: 400 };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) { // Vercel may have parsed it already
      if (typeof req.body === 'string') { try { return resolve(req.body ? JSON.parse(req.body) : {}); } catch (e) { return resolve({}); } }
      return resolve(req.body || {});
    }
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', reject);
  });
}
function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }
function ip(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function isSecure(req) { return (req.headers['x-forwarded-proto'] || '') === 'https'; }

async function settings() { return (await query('select * from settings where id = 1'))[0]; }
function state(s, now = new Date()) {
  const opens = new Date(s.opens_at), locks = new Date(s.locks_at);
  let phase = now < opens ? 'before' : now < locks ? 'open' : 'locked';
  if (s.force === 'open') phase = 'open'; else if (s.force === 'locked') phase = 'locked'; else if (s.force === 'before') phase = 'before';
  return { phase, opens_at: opens.toISOString(), locks_at: locks.toISOString(), now: now.toISOString(), force: s.force };
}
function locked(res, st) {
  return send(res, 423, { error: st.phase === 'before' ? 'The portal opens when the event starts.' : 'Submissions are locked.', state: st });
}

// Fifty wrong codes per ten minutes per address, tracked in the database so every instance shares it.
// On event WiFi the whole room shares one address, so a low limit would lock everyone out after a few
// typos; codes come from 31^8 (about 850 billion) combinations, so fifty guesses is still no real risk.
const MAX_ATTEMPTS = 50;
async function tooManyAttempts(addr) {
  const rows = await query('select n, window_start from attempts where ip = $1', [addr]);
  if (!rows.length) return false;
  const fresh = Date.now() - new Date(rows[0].window_start).getTime() < 10 * 60 * 1000;
  return fresh && rows[0].n >= MAX_ATTEMPTS;
}
async function noteAttempt(addr, ok) {
  if (ok) { await query('delete from attempts where ip = $1', [addr]); return; }
  await query(`insert into attempts (ip, n, window_start) values ($1, 1, now())
    on conflict (ip) do update set
      n = case when now() - attempts.window_start > interval '10 minutes' then 1 else attempts.n + 1 end,
      window_start = case when now() - attempts.window_start > interval '10 minutes' then now() else attempts.window_start end`, [addr]);
}

async function teamBundle(teamId) {
  const team = (await query('select * from teams where id = $1', [teamId]))[0];
  if (!team) return null;
  const members = await query('select id, name, school, role, claimed_at from members where team_id = $1 order by id', [teamId]);
  const pitch = (await query('select * from pitches where team_id = $1', [teamId]))[0] || null;
  return { team, members, pitch };
}
async function ensurePitch(teamId) { await query('insert into pitches (team_id) values ($1) on conflict do nothing', [teamId]); }
async function newTeam(name) {
  let code, tries = 0;
  do { code = auth.newCode(); tries++; } while (tries < 5 && (await query('select 1 from teams where code = $1', [code])).length);
  const t = (await query('insert into teams (name, code) values ($1, $2) returning id, code', [name, code]))[0];
  await ensurePitch(t.id);
  return t;
}
// [{name, school}] -> clean rows, or an error string. Blank rows are dropped before counting.
function cleanMembers(list) {
  const rows = (Array.isArray(list) ? list : []).map(m => ({
    id: Number(m && m.id) || null, name: clip(m && m.name, 80).trim(), school: clip(m && m.school, 80).trim()
  })).filter(m => m.name || m.school);
  if (rows.some(m => !m.name)) return 'Every teammate needs a name.';
  if (rows.length < TEAM_MIN || rows.length > TEAM_MAX) return `Teams have ${TEAM_MIN} to ${TEAM_MAX} people.`;
  return rows;
}
function sameJoinCode(a, b) {
  const n = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return !!n(b) && n(a) === n(b);
}

async function login(req, res, body) {
  const addr = ip(req);
  if (await tooManyAttempts(addr)) return send(res, 429, { error: 'Too many attempts. Wait ten minutes and try again.' });
  const code = auth.normaliseCode(body.code);
  if (!code) return send(res, 400, { error: 'Enter your code.' });
  let who = null;
  const admin = process.env.ADMIN_CODE && auth.normaliseCode(process.env.ADMIN_CODE);
  if (admin && code === admin) who = { kind: 'admin' };
  if (!who) { const t = (await query('select id from teams where code = $1', [code]))[0]; if (t) who = { kind: 'member', team_id: t.id }; }
  if (!who) { const m = (await query('select id, team_id from members where code = $1', [code]))[0]; if (m) who = { kind: 'member', id: m.id, team_id: m.team_id }; }
  if (!who) { const j = (await query('select id from judges where code = $1', [code]))[0]; if (j) who = { kind: 'judge', id: j.id }; }
  // A code only signs you in on its own page. Anywhere else it is refused like a wrong code:
  // no session is set and it counts as a failed attempt, so codes cannot hop between portals.
  if (!who || (body.expect && body.expect !== who.kind)) {
    await noteAttempt(addr, false);
    return send(res, 401, { error: 'That code is not for this page. Check it and try again.' });
  }
  await noteAttempt(addr, true);
  if (who.kind === 'member' && who.id) await query('update members set claimed_at = coalesce(claimed_at, now()) where id = $1', [who.id]);
  auth.setSession(res, who, isSecure(req));
  return send(res, 200, { kind: who.kind });
}

// Public, on the day: one person registers the team and gets a team code their teammates sign in
// with. The event code read out at the briefing keeps strangers from creating teams.
async function register(req, res, body) {
  const key = 'join:' + ip(req);
  if (await tooManyAttempts(key)) return send(res, 429, { error: 'Too many attempts. Wait ten minutes and try again.' });
  const s = await settings(), st = state(s);
  if (st.phase !== 'open') return locked(res, st);
  if (!sameJoinCode(body.join_code, s.join_code)) {
    await noteAttempt(key, false);
    return send(res, 401, { error: 'That event code is not right. It is on the screen at the briefing.' });
  }
  const name = clip(body.name, 60).trim();
  if (!name) return send(res, 400, { error: 'Give your team a name.' });
  const members = cleanMembers(body.members);
  if (typeof members === 'string') return send(res, 400, { error: members });
  await noteAttempt(key, true);
  const t = await newTeam(name);
  for (const m of members) await query('insert into members (team_id, name, school) values ($1, $2, $3)', [t.id, m.name, m.school]);
  auth.setSession(res, { kind: 'member', team_id: t.id }, isSecure(req));
  return send(res, 200, { kind: 'member', code: t.code });
}

async function me(req, res, s) {
  const set = await settings(), st = state(set);
  if (s.kind === 'member') {
    const b = await teamBundle(s.team_id);
    if (!b) { auth.clearSession(res); return send(res, 401, { error: 'Your team no longer exists.' }); }
    return send(res, 200, { kind: 'member', me: s.id || null, state: st, codex_prompt: set.codex_prompt, ...b });
  }
  if (s.kind === 'judge') {
    const judge = (await query('select id, name from judges where id = $1', [s.id]))[0];
    if (!judge) { auth.clearSession(res); return send(res, 401, { error: 'Judge not found.' }); }
    const teams = await query(`select t.id, t.name, p.app_name, p.tagline, p.site_url, p.video_url, p.updated_at,
        sc.score, sc.notes, sc.criteria,
        (select string_agg(m.name, ', ' order by m.id) from members m where m.team_id = t.id) as people
      from teams t left join pitches p on p.team_id = t.id
      left join scores sc on sc.team_id = t.id and sc.judge_id = $1
      order by t.name, t.id`, [judge.id]);
    return send(res, 200, { kind: 'judge', judge, state: st, teams });
  }
  if (s.kind === 'admin') return send(res, 200, { kind: 'admin', state: st });
  return send(res, 401, { error: 'Sign in.' });
}

async function putTeam(req, res, s, body) {
  const st = state(await settings());
  if (st.phase !== 'open') return locked(res, st);
  const name = clip(body.name, 60).trim();
  if (!name) return send(res, 400, { error: 'Give your team a name.' });
  const members = cleanMembers(body.members);
  if (typeof members === 'string') return send(res, 400, { error: members });
  const have = (await query('select id from members where team_id = $1', [s.team_id])).map(r => r.id);
  const keep = members.filter(m => have.includes(m.id)).map(m => m.id);
  for (const id of have) if (!keep.includes(id)) await query('delete from members where id = $1', [id]);
  for (const m of members) {
    if (keep.includes(m.id)) await query('update members set name = $1, school = $2 where id = $3', [m.name, m.school, m.id]);
    else await query('insert into members (team_id, name, school) values ($1, $2, $3)', [s.team_id, m.name, m.school]);
  }
  await query('update teams set name = $1 where id = $2', [name, s.team_id]);
  return send(res, 200, await teamBundle(s.team_id));
}

async function putPitch(req, res, s, body) {
  const st = state(await settings());
  if (st.phase !== 'open') return locked(res, st);
  await ensurePitch(s.team_id);
  const sets = [], vals = [];
  for (const f of PITCH_FIELDS) if (f in body) { vals.push(clip(body[f], LIMITS[f])); sets.push(`${f} = $${vals.length}`); }
  if (!sets.length) return send(res, 400, { error: 'Nothing to save.' });
  vals.push(s.team_id);
  await query(`update pitches set ${sets.join(', ')}, updated_at = now() where team_id = $${vals.length}`, vals);
  return send(res, 200, { pitch: (await query('select * from pitches where team_id = $1', [s.team_id]))[0] });
}

async function getPitch(req, res, s, url) {
  const all = url.searchParams.get('all') === '1';
  const st = state(await settings());
  let ids = [];
  if (all) {
    if (s.kind !== 'admin' && s.kind !== 'judge') return send(res, 403, { error: 'Not allowed.' });
    ids = (await query('select id from teams order by name, id')).map(r => r.id);
  } else {
    const id = Number(url.searchParams.get('team'));
    if (!id) return send(res, 400, { error: 'Which team?' });
    if (s.kind === 'member' && id !== s.team_id) return send(res, 403, { error: 'Not your team.' });
    ids = [id];
  }
  const out = [];
  for (const id of ids) { const b = await teamBundle(id); if (b) out.push(b); }
  return send(res, 200, { state: st, teams: out });
}

const CRITERIA = ['problem', 'solution', 'build', 'pitch'];
async function putScore(req, res, s, body) {
  if (!(await query('select 1 from judges where id = $1', [s.id])).length) { auth.clearSession(res); return send(res, 401, { error: 'Your judge code was removed. Ask the organisers.' }); }
  const teamId = Number(body.team_id);
  if (!(await query('select 1 from teams where id = $1', [teamId])).length) return send(res, 404, { error: 'That team no longer exists.' });
  const given = body.criteria && typeof body.criteria === 'object' ? body.criteria : {};
  const criteria = {};
  for (const k of CRITERIA) { const n = Number(given[k]); if (n >= 1 && n <= 5) criteria[k] = Math.round(n); }
  // The total (out of 20) only counts once all four criteria are marked.
  const score = CRITERIA.every(k => criteria[k]) ? CRITERIA.reduce((a, k) => a + criteria[k], 0) : null;
  await query(`insert into scores (judge_id, team_id, score, criteria, notes, updated_at) values ($1, $2, $3, $4, $5, now())
    on conflict (judge_id, team_id) do update set score = $3, criteria = $4, notes = $5, updated_at = now()`, [s.id, teamId, score, JSON.stringify(criteria), clip(body.notes, 2000)]);
  return send(res, 200, { ok: true });
}

// ---- admin ----
async function adminOverview(req, res) {
  const s = await settings(), st = state(s);
  const teams = await query(`select t.*, p.app_name, p.tagline, p.site_url, p.video_url, p.updated_at as pitch_updated,
      (select count(*)::int from scores sc where sc.team_id = t.id) as score_count,
      (select round(avg(sc.score)::numeric, 2)::float from scores sc where sc.team_id = t.id and sc.score is not null) as avg_score
    from teams t left join pitches p on p.team_id = t.id order by t.name, t.id`);
  const members = await query('select id, team_id, name, school, email, code, claimed_at from members order by team_id, id');
  const judges = await query('select j.*, (select count(*)::int from scores sc where sc.judge_id = j.id) as scored from judges j order by j.id');
  return send(res, 200, { state: st, settings: { join_code: s.join_code, codex_prompt: s.codex_prompt }, teams, members, judges });
}
async function adminImport(req, res, body) {
  // rows: [{team: "1", name, school, email}] -> people sharing a team key land in one team, with one team code
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return send(res, 400, { error: 'No rows.' });
  const teams = {}; const created = [];
  for (const r of rows) {
    const key = clip(r.team, 40).trim() || ('solo-' + created.length + '-' + Math.random());
    const name = clip(r.name, 80).trim(); if (!name) continue;
    if (!teams[key]) teams[key] = await newTeam(clip(r.team_name, 60).trim());
    const m = (await query('insert into members (team_id, name, school, email) values ($1, $2, $3, $4) returning id',
      [teams[key].id, name, clip(r.school, 80).trim(), clip(r.email, 120).trim()]))[0];
    created.push({ id: m.id, team_id: teams[key].id, name, code: teams[key].code });
  }
  return send(res, 200, { created, teams: Object.keys(teams).length });
}
async function adminJudge(req, res, body) {
  const name = clip(body.name, 80).trim(); if (!name) return send(res, 400, { error: 'Name?' });
  const code = auth.newCode();
  const j = (await query('insert into judges (name, code) values ($1, $2) returning *', [name, code]))[0];
  return send(res, 200, { judge: j });
}
async function adminSettings(req, res, body) {
  const s = await settings();
  const force = ['', 'open', 'locked', 'before'].includes(body.force) ? body.force : s.force;
  const opens = body.opens_at && !isNaN(Date.parse(body.opens_at)) ? new Date(body.opens_at).toISOString() : s.opens_at;
  const locks = body.locks_at && !isNaN(Date.parse(body.locks_at)) ? new Date(body.locks_at).toISOString() : s.locks_at;
  const join = 'join_code' in body ? clip(body.join_code, 40).trim() : s.join_code;
  const prompt = 'codex_prompt' in body ? clip(body.codex_prompt, 8000) : s.codex_prompt;
  await query('update settings set force = $1, opens_at = $2, locks_at = $3, join_code = $4, codex_prompt = $5 where id = 1', [force, opens, locks, join, prompt]);
  return send(res, 200, { state: state(await settings()) });
}
async function adminExport(req, res) {
  const rows = await query(`select t.id as team_id, t.name as team, t.code as team_code, m.name as person, m.school, m.email,
      p.app_name, p.tagline, p.audience, p.problem, p.solution, p.mission, p.value, p.site_url, p.video_url, p.updated_at,
      (select round(avg(sc.score)::numeric, 2) from scores sc where sc.team_id = t.id and sc.score is not null) as avg_total_of_20,
      (select round(avg((sc.criteria->>'problem')::int)::numeric, 2) from scores sc where sc.team_id = t.id) as avg_problem,
      (select round(avg((sc.criteria->>'solution')::int)::numeric, 2) from scores sc where sc.team_id = t.id) as avg_solution,
      (select round(avg((sc.criteria->>'build')::int)::numeric, 2) from scores sc where sc.team_id = t.id) as avg_build,
      (select round(avg((sc.criteria->>'pitch')::int)::numeric, 2) from scores sc where sc.team_id = t.id) as avg_pitch
    from teams t join members m on m.team_id = t.id left join pitches p on p.team_id = t.id order by t.name, t.id, m.id`);
  const cols = rows.length ? Object.keys(rows[0]) : ['team_id'];
  // Cells starting with = + - @ (or a tab/return) would run as formulas in Excel; a leading apostrophe keeps them text.
  const esc = v => { let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => esc(r[c])).join(','))).join('\r\n');
  res.statusCode = 200; res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="teams.csv"'); res.setHeader('Cache-Control', 'no-store');
  res.end('﻿' + csv);
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = req.method;
  // Start the database (and, on a fresh instance, its setup) on every request, including the signed-out
  // GET me a page makes when it opens, so it is usually ready by the time someone submits their code.
  // waitUntil keeps that work running after the response; without it Vercel pauses the instance mid-boot.
  waitUntil(warm().catch(() => {}));
  try {
    if (path === 'logout' && method === 'POST') { auth.clearSession(res); return send(res, 200, { ok: true }); }
    // Writes must be JSON. A plain HTML form on another site cannot send that content type, so this
    // closes off cross-site form posts on top of the SameSite cookie.
    if ((method === 'POST' || method === 'PUT') && !/^application\/json\b/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send JSON.' });
    if (path === 'login' && method === 'POST') return await login(req, res, await readBody(req));
    if (path === 'register' && method === 'POST') return await register(req, res, await readBody(req));
    const s = auth.session(req);
    if (!s) return send(res, 401, { error: 'Sign in with your code.' });
    if (path === 'me' && method === 'GET') return await me(req, res, s);
    if (path === 'team' && method === 'PUT' && s.kind === 'member') return await putTeam(req, res, s, await readBody(req));
    if (path === 'pitch' && method === 'PUT' && s.kind === 'member') return await putPitch(req, res, s, await readBody(req));
    if (path === 'pitch' && method === 'GET') return await getPitch(req, res, s, url);
    if (path === 'score' && method === 'PUT' && s.kind === 'judge') return await putScore(req, res, s, await readBody(req));
    if (path.startsWith('admin/')) {
      if (s.kind !== 'admin') return send(res, 403, { error: 'Admins only.' });
      const sub = path.slice(6);
      if (sub === 'overview' && method === 'GET') return await adminOverview(req, res);
      if (sub === 'import' && method === 'POST') return await adminImport(req, res, await readBody(req));
      if (sub === 'judge' && method === 'POST') return await adminJudge(req, res, await readBody(req));
      if (sub === 'settings' && method === 'PUT') return await adminSettings(req, res, await readBody(req));
      if (sub === 'export' && method === 'GET') return await adminExport(req, res);
      if (sub === 'team' && method === 'DELETE') { await query('delete from teams where id = $1', [Number(url.searchParams.get('id'))]); return send(res, 200, { ok: true }); }
      if (sub === 'judge' && method === 'DELETE') { await query('delete from judges where id = $1', [Number(url.searchParams.get('id'))]); return send(res, 200, { ok: true }); }
    }
    return send(res, 404, { error: 'No such route.' });
  } catch (e) {
    console.error(e);
    if (e.code === 'NO_DATABASE') return send(res, 503, { error: 'The portal database is not connected yet. Organisers: add the Neon database to the Vercel project.' });
    return send(res, 500, { error: 'Something went wrong on our side. Try again in a moment.' });
  }
};
