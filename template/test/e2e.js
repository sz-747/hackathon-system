// End-to-end run against dev.js (ADMIN_CODE=TEST-ADMN). node test/e2e.js [outDir]
// Needs playwright-core (`npm install --no-save playwright-core`, or PLAYWRIGHT_CORE=<its folder>) and a
// Chromium: Playwright's own (`npx playwright install chromium`) or an installed Chrome via CHROME_PATH.
const path = require('path');
const assert = require('assert');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = process.argv[2] || __dirname, BASE = process.env.BASE || 'http://127.0.0.1:8790';
const PROMPT = 'Clone https://github.com/example/video-template and edit demo.mp4 into a 3-minute video.';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  const fresh = (w = 1280, h = 900, storageState) => browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce', storageState });

  // ---- admin: sign in, set the event code and Codex prompt, add a judge, force open ----
  const admin = await fresh();
  await admin.goto(BASE + '/admin', { waitUntil: 'load' });
  await admin.fill('#code', 'TEST-ADMN'); await admin.click('.login-form button');
  await admin.waitForSelector('#admin:not([hidden])');
  await admin.click('[data-tab="settings"]');
  await admin.fill('#join', 'owls 2026'); await admin.fill('#prompt', PROMPT);
  await admin.click('#settings-form button[type=submit]');
  await admin.waitForFunction(() => /Settings saved/.test(document.querySelector('#saved').textContent));
  await admin.click('[data-force="open"]');
  await admin.waitForFunction(() => document.querySelector('#strip').classList.contains('open'));
  await shot(admin, 'admin-settings');
  await admin.click('[data-tab="judges"]');
  await admin.fill('#j-name', 'Judge Judy'); await admin.click('#judge-form button[type=submit]');
  await admin.waitForFunction(() => document.querySelectorAll('#judges-table .mono').length === 1);
  const judgeCode = await admin.$eval('#judges-table .mono', e => e.textContent);

  // ---- register: wrong event code refused, then three people register one team ----
  const team = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await team.goto(BASE + '/portal', { waitUntil: 'load' });
  await team.waitForSelector('#login:not([hidden])');
  await shot(team, 'portal-login');
  await team.click('#to-register'); await team.waitForSelector('#register:not([hidden])');
  assert.strictEqual(await team.$$eval('#reg-people .person', e => e.length), 2, 'two empty rows to start');
  await team.fill('#reg-join', 'wrong'); await team.fill('#reg-name', 'Night Owls');
  const rows = '#reg-people .person';
  await team.fill(`${rows}:nth-of-type(1) [data-k=name]`, 'Ada Lovelace'); await team.fill(`${rows}:nth-of-type(1) [data-k=school]`, 'Northside High');
  await team.fill(`${rows}:nth-of-type(2) [data-k=name]`, 'Alan Turing'); await team.fill(`${rows}:nth-of-type(2) [data-k=school]`, 'Eastwood College');
  await team.click('#reg-people .add');
  await team.fill(`${rows}:nth-of-type(3) [data-k=name]`, 'Grace Hopper'); await team.fill(`${rows}:nth-of-type(3) [data-k=school]`, 'Westfield Grammar');
  await team.click('#register-form button[type=submit]');
  await team.waitForFunction(() => /event code/.test(document.querySelector('#register-msg').textContent));
  await shot(team, 'portal-register');
  await team.fill('#reg-join', '  OWLS   2026 '); // case and spacing do not matter
  await team.click('#register-form button[type=submit]');
  await team.waitForSelector('#box:not([hidden])');
  assert.ok(await team.$eval('#codebox', e => e.classList.contains('fresh')), 'team code shown loudly after registering');
  const teamCode = await team.textContent('#team-code');
  assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(teamCode), 'team code format: ' + teamCode);
  assert.strictEqual(await team.$$eval('#team-people .person', e => e.length), 3, 'three people registered');
  await team.click('#copy-prompt');
  assert.strictEqual(await team.evaluate(() => navigator.clipboard.readText()), PROMPT, 'codex prompt copied to the clipboard');

  // ---- team card: 2 to 4 people, remove and add, explicit save ----
  await team.click('#team-people .add');
  assert.ok(await team.$eval('#team-people .add', e => e.disabled), 'cannot add a fifth');
  await team.click('#team-people .person:nth-of-type(4) .rm');
  await team.click('#team-people .person:nth-of-type(3) .rm');
  assert.ok(await team.$eval('#team-people .person .rm', e => e.disabled), 'cannot go below two');
  await team.fill('#team-people .person:nth-of-type(2) [data-k=name]', 'Alan M. Turing');
  await team.click('#team-save');
  await team.waitForFunction(() => /Saved/.test(document.querySelector('#team-saved').textContent));

  // ---- answers and links autosave ----
  await team.fill('#f-app_name', 'Rosterly'); await team.fill('#f-tagline', 'One roster every teacher can trust.');
  await team.fill('#f-audience', 'Heads of department at high schools who build the casual-relief roster each morning.');
  await team.fill('#f-problem', 'Rosters live in three spreadsheets and a group chat. By 8 am nobody knows who is covering period 2.');
  await team.fill('#f-solution', 'A single board that pulls absences from the SIS and suggests covers, with one tap to confirm.');
  await team.fill('#f-mission', 'Give teachers their mornings back.');
  await team.fill('#f-value', 'Cuts the daily roster scramble from 40 minutes to 5 for one head of department, every school day.');
  await team.fill('#f-site_url', 'https://rosterly.example.com'); await team.fill('#f-video_url', 'https://youtu.be/dQw4w9WgXcQ');
  await team.waitForFunction(() => /Saved/.test(document.querySelector('#saved').textContent), null, { timeout: 8000 });
  await team.waitForTimeout(1200);
  await team.reload({ waitUntil: 'load' }); await team.waitForSelector('#box:not([hidden])');
  assert.ok(!(await team.$eval('#codebox', e => e.classList.contains('fresh'))), 'code banner quiet after reload');
  assert.deepStrictEqual(await team.$$eval('#team-people [data-k=name]', e => e.map(x => x.value)), ['Ada Lovelace', 'Alan M. Turing'], 'members persisted');
  assert.strictEqual(await team.inputValue('#f-value'), 'Cuts the daily roster scramble from 40 minutes to 5 for one head of department, every school day.', 'answers persisted');
  assert.strictEqual(await team.inputValue('#f-video_url'), 'https://youtu.be/dQw4w9WgXcQ', 'video persisted');
  await shot(team, 'portal-box');

  // ---- a teammate signs in with the team code ----
  const mate = await fresh();
  await mate.goto(BASE + '/portal', { waitUntil: 'load' });
  await mate.fill('#code', teamCode.toLowerCase().replace('-', '')); // sloppy entry should still work
  await mate.click('.login-form button'); await mate.waitForSelector('#box:not([hidden])');
  assert.strictEqual(await mate.inputValue('#f-app_name'), 'Rosterly', 'teammate sees the same team');
  // phone width
  const phone = await fresh(390, 844, await mate.context().storageState());
  await phone.goto(BASE + '/portal', { waitUntil: 'load' }); await phone.waitForSelector('#box:not([hidden])');
  const sw = await phone.evaluate(() => document.documentElement.scrollWidth); assert.ok(sw <= 390, 'no horizontal overflow on phone: ' + sw);
  await shot(phone, 'portal-phone'); await phone.close(); await mate.close();
  // answers page
  const teamId = (await team.getAttribute('#preview', 'href')).split('=')[1];
  const hand = await fresh(1000, 1200, await team.context().storageState());
  await hand.goto(BASE + '/pitch?team=' + teamId, { waitUntil: 'load' }); await hand.waitForSelector('.deck-card:not([hidden])');
  assert.ok((await hand.textContent('.deck-card:not([hidden])')).includes('Ada Lovelace & Alan M. Turing'), 'answers card renders with names');
  // Flash cards: Next shows the site, then the video; arrow keys go back.
  await hand.click('.deck [data-step="1"]');
  assert.ok(await hand.isVisible('.deck-card:nth-of-type(2) iframe.site'), 'second card shows the site');
  await hand.click('.deck [data-step="1"]');
  assert.ok(await hand.isVisible('.deck-card:nth-of-type(3) iframe.video'), 'third card shows the video');
  assert.ok(await hand.$eval('.deck [data-step="1"]', e => e.disabled), 'Next stops at the last card');
  await shot(hand, 'pitch-video');
  await hand.keyboard.press('ArrowLeft'); await hand.keyboard.press('ArrowLeft');
  assert.ok(await hand.isVisible('.deck-card:nth-of-type(1) .grid2'), 'arrow keys go back to the answers');
  assert.strictEqual(await hand.$('text=Print'), null, 'no print button');
  await shot(hand, 'handout'); await hand.close();

  // ---- the API refuses bad team sizes; a second team registers ----
  const api = await fresh();
  await api.goto(BASE + '/portal', { waitUntil: 'load' });
  const reg = body => api.evaluate(async b => { const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; }, body);
  const base = { join_code: 'owls 2026', name: 'Solo' };
  assert.strictEqual((await reg({ ...base, members: [{ name: 'One' }] })).status, 400, 'one person refused');
  assert.strictEqual((await reg({ ...base, members: [1, 2, 3, 4, 5].map(n => ({ name: 'P' + n })) })).status, 400, 'five people refused');
  assert.strictEqual((await reg({ ...base, name: 'Byte Me', members: [{ name: 'Linus Torvalds', school: 'Hornsby' }, { name: 'Margaret Hamilton', school: 'Southbank Girls' }] })).status, 200, 'second team registers');

  // ---- lock: team sees read-only, saves and registrations are refused ----
  await admin.click('[data-tab="settings"]'); await admin.click('[data-force="locked"]');
  await admin.waitForFunction(() => document.querySelector('#strip').classList.contains('locked'));
  await team.fill('#f-tagline', 'Changed after lock');
  await team.waitForFunction(() => document.querySelector('#f-tagline').disabled, null, { timeout: 8000 });
  await team.reload({ waitUntil: 'load' }); await team.waitForSelector('#box:not([hidden])');
  assert.strictEqual(await team.inputValue('#f-tagline'), 'One roster every teacher can trust.', 'locked write rejected');
  assert.ok(await team.$eval('#team-name', e => e.disabled), 'fields disabled when locked');
  assert.ok(await team.$eval('#team-people .add', e => e.disabled), 'cannot add people when locked');
  assert.strictEqual((await reg({ ...base, name: 'Late', members: [{ name: 'A' }, { name: 'B' }] })).status, 423, 'registration refused when locked');
  await shot(team, 'portal-locked'); await api.close();

  // ---- judge: home with criteria, Start judging, four cards per team (the last is the rubric), team navigation, Save & next ----
  const judge = await fresh(1440, 900);
  await judge.goto(BASE + '/judge', { waitUntil: 'load' });
  await judge.fill('#code', judgeCode); await judge.click('.login-form button');
  await judge.waitForSelector('#list:not([hidden])');
  assert.strictEqual((await judge.$$('.tcard')).length, 2, 'judge sees both teams');
  assert.strictEqual((await judge.$$('#crit-list li')).length, 4, 'home lists the four criteria');
  await shot(judge, 'judge-list');
  await judge.click('#start');
  await judge.waitForSelector('#team:not([hidden])');
  assert.strictEqual(await judge.textContent('#t-pos'), 'Team 1 of 2', 'Start judging opens the first team');
  await judge.click('#next-team'); await judge.waitForFunction(() => document.querySelector('#t-pos').textContent === 'Team 2 of 2');
  await judge.click('#next-team'); await judge.waitForFunction(() => document.querySelector('#t-pos').textContent === 'Team 1 of 2'); // wraps round
  const owls = await judge.$eval('#jump', s => [...s.options].find(o => o.textContent.includes('Night Owls')).value);
  await judge.selectOption('#jump', owls); await judge.waitForFunction(() => document.querySelector('#t-team').textContent === 'Night Owls');
  assert.ok((await judge.textContent('#t-deck .deck-card:not([hidden])')).includes('Rosterly'), 'answers card first');
  await judge.click('#t-deck [data-go="2"]');
  assert.ok((await judge.getAttribute('#t-deck .deck-card:nth-of-type(3) iframe.video', 'src')).includes('youtube.com/embed/dQw4w9WgXcQ'), 'video card embeds the video');
  await judge.keyboard.press('ArrowLeft');
  assert.ok(await judge.isVisible('#t-deck .deck-card:nth-of-type(2) iframe.site'), 'arrow key flips back to the site card');
  // The fourth card is the rubric: criteria down the side, five levels across, a sentence in each.
  await judge.click('#t-deck [data-go="3"]');
  assert.ok(await judge.isVisible('#t-deck .deck-card:nth-of-type(4) #score-form'), 'rubric card holds the score form');
  assert.strictEqual((await judge.$$('#score .lvl')).length, 20, 'four criteria by five levels');
  const row = await judge.$$eval('#score .rubric-row:nth-child(2) .lvl', bs => bs.map(b => Math.round(b.getBoundingClientRect().top)));
  assert.strictEqual(new Set(row).size, 1, 'levels run across the page');
  // A mark left unsaved is saved when the judge moves to another team.
  await judge.click('#score button[data-k="problem"][data-n="4"]');
  await judge.click('#next-team'); await judge.waitForFunction(() => document.querySelector('#t-team').textContent === 'Byte Me');
  await judge.click('#prev-team'); await judge.waitForFunction(() => document.querySelector('#t-team').textContent === 'Night Owls');
  assert.strictEqual(await judge.getAttribute('#score button[data-k="problem"][data-n="4"]', 'aria-checked'), 'true', 'mark kept after moving teams');
  await judge.click('#t-deck [data-go="3"]');
  for (const [k, n] of [['problem', 4], ['solution', 3], ['build', 5], ['pitch', 4]]) await judge.click(`#score button[data-k="${k}"][data-n="${n}"]`);
  assert.ok((await judge.textContent('#total')).includes('16'), 'total out of 20'); await judge.fill('#notes', 'Clear problem, real users, demo worked.');
  await shot(judge, 'judge-team');
  assert.ok(await judge.isHidden('#t-deck .deck-foot [data-step="1"]'), 'no Next card on the rubric card');
  assert.deepStrictEqual(await judge.$$eval('#t-deck .deck-foot button:not([hidden])', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim())), ['← Back', 'Save', 'Next team →'], 'rubric card footer: Back, Save, Next team');
  await judge.click('#t-deck .deck-end [data-then="next"]');
  await judge.waitForFunction(() => document.querySelector('#t-team').textContent === 'Byte Me');
  await judge.click('#back'); await judge.waitForSelector('#list:not([hidden])');
  assert.ok((await judge.textContent('.tcard:has-text("Night Owls") .sc')).includes('16 / 20'), 'total shows in list');
  assert.ok((await judge.textContent('.tcard:has-text("Night Owls") .tc-notes')).includes('Clear problem, real users'), 'notes show on the team card');
  assert.strictEqual(await judge.$('.tcard .tc-marks'), null, 'team cards show the total only');
  const cols = await judge.$$eval('#teams .tcard', cs => new Set(cs.map(c => Math.round(c.getBoundingClientRect().top))).size);
  assert.strictEqual(cols, 1, 'team cards sit side by side in a row');
  assert.strictEqual(await judge.$eval('#brief', e => e.open), false, 'briefing folds away once judging has started');
  await judge.click('.sort [data-sort="score"]');
  assert.ok((await judge.textContent('#teams .tcard:first-child .tag')).includes('Night Owls'), 'sort by score puts the scored team first');
  await shot(judge, 'judge-home-notes');

  // ---- admin sees the ranking and exports ----
  await admin.reload({ waitUntil: 'load' }); await admin.waitForSelector('#admin:not([hidden])');
  assert.ok((await admin.textContent('#teams-table')).includes(teamCode), 'admin sees the team code');
  await admin.click('[data-tab="results"]');
  assert.ok((await admin.textContent('#results-table tr:nth-child(2)')).includes('Night Owls'), 'ranked first');
  await shot(admin, 'admin-results');
  const csv = await admin.evaluate(async () => (await fetch('/api/admin/export')).text());
  assert.ok(csv.includes('Night Owls') && csv.includes('Rosterly') && csv.includes(teamCode), 'csv export');

  // ---- security: writes must be JSON (no cross-site form posts), the old public apply endpoint is gone ----
  const sec = await fresh();
  await sec.goto(BASE + '/portal', { waitUntil: 'load' });
  const probe = await sec.evaluate(async () => {
    const form = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ code: 'TEST-ADMN' }) });
    const apply = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: 'A', last_name: 'B', email: 'a@b.co', school: 'S', year_level: 10, team_status: 'solo' }) });
    return { form: form.status, apply: apply.status };
  });
  assert.strictEqual(probe.form, 415, 'a non-JSON login is refused');
  assert.notStrictEqual(probe.apply, 200, 'public apply endpoint removed');
  await sec.close();

  // ---- wrong-kind and bad-code paths ----
  const j2 = await fresh(1280, 900, await judge.context().storageState());
  await j2.goto(BASE + '/portal', { waitUntil: 'load' }); await j2.waitForSelector('#wrongkind:not([hidden])'); await j2.close();
  const bad = await fresh();
  await bad.goto(BASE + '/portal', { waitUntil: 'load' }); await bad.fill('#code', 'ZZZZ-ZZZZ'); await bad.click('.login-form button');
  await bad.waitForFunction(() => /not for this page/.test(document.querySelector('.login-form .msg').textContent));
  // admin code typed into the judge page: refused, and no session is created
  await bad.goto(BASE + '/judge', { waitUntil: 'load' }); await bad.fill('#code', 'TEST-ADMN'); await bad.click('.login-form button');
  await bad.waitForFunction(() => /not for this page/.test(document.querySelector('.login-form .msg').textContent));
  assert.strictEqual(await bad.evaluate(async () => (await fetch('/api/me')).status), 401, 'no session after wrong-page code');
  await bad.goto(BASE + '/admin', { waitUntil: 'load' }); await bad.waitForSelector('#login:not([hidden])');
  await bad.close();

  await browser.close();
  console.log('E2E OK. team:', teamCode, 'judge:', judgeCode);
})().catch(e => { console.error('E2E FAILED:', e); process.exit(1); });
