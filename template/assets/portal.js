// Shared helpers for the portal pages: API calls, event-time formatting, escaping, the star canvas.
(function () {
  'use strict';
  var BH = window.BH = {};

  BH.api = async function (method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var r = await fetch('/api/' + path, opts);
    var ct = r.headers.get('content-type') || '';
    var data = ct.indexOf('json') >= 0 ? await r.json() : await r.text();
    if (!r.ok) { var e = new Error((data && data.error) || 'Request failed'); e.status = r.status; e.data = data; throw e; }
    return data;
  };

  var SYD = 'Australia/Sydney'; // the event's time zone: change it for your city
  BH.fmt = function (iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: SYD, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); };
  BH.time = function (iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: SYD, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); };
  BH.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  BH.href = function (u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u; };

  BH.phase = function (st) {
    if (st.phase === 'open') return { cls: 'open', text: 'Portal open · submissions lock at <b>' + BH.time(st.locks_at) + '</b>' };
    if (st.phase === 'before') return { cls: 'before', text: 'Locked until the event starts · opens <b>' + BH.fmt(st.opens_at) + '</b>' };
    return { cls: 'locked', text: 'Submissions locked at <b>' + BH.fmt(st.locks_at) + '</b>' };
  };

  // YouTube, Vimeo and Google Drive links become an embed; anything else is just a link.
  BH.embed = function (url) {
    url = String(url || '').trim(); var m;
    if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([\w-]{6,})/))) return 'https://www.youtube.com/embed/' + m[1];
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    if ((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    return null;
  };

  BH.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };

  // Sign-in form: input.code + button inside form.login-form; calls onOk(kind).
  BH.login = function (form, onOk, expect) {
    var input = form.querySelector('input'), msg = form.querySelector('.msg'), btn = form.querySelector('button');
    input.addEventListener('input', function () {
      var v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      input.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); msg.textContent = ''; btn.disabled = true;
      var label = btn.textContent; btn.textContent = 'Signing in…';
      try { var r = await BH.api('POST', 'login', { code: input.value, expect: expect }); onOk(r.kind); }
      catch (err) { msg.textContent = err.message; }
      btn.disabled = false; btn.textContent = label;
    });
    setTimeout(function () { input.focus(); }, 50);
  };

  // Judging rubric. Each criterion is marked 1 to 5 (total out of 20): [key, name, guiding question, [one sentence per level]].
  BH.LEVELS = ['Poor', 'Developing', 'Solid', 'Strong', 'Outstanding'];
  BH.criteria = [
    ['problem', 'Problem', 'Does the team understand a genuine problem? Look for evidence: who has it, how they know, and why it matters now.', [
      'No clear problem: it is a solution looking for a reason, or nobody really has this problem.',
      'A problem is named but it is vague or generic, with no sense of who has it or why it matters.',
      'A real problem for a named group, explained clearly, but with little evidence that it matters to them.',
      'A specific problem for a clear group, backed by some evidence (examples, numbers, people they asked).',
      'A sharp, well-evidenced problem the team understands deeply, and it is obvious why it matters now.']],
    ['solution', 'Solution', 'Is the design thoughtful, not just clever? A considered approach beats a flashy one that misses the point.', [
      'Does not address the problem they described, or is a generic app with AI added for the sake of it.',
      'Loosely connected to the problem; important parts are missing or unclear.',
      'A sensible approach that addresses the problem, without much thought about the users’ real situation.',
      'A thoughtful design that fits how the users actually work, with clear choices about what to include.',
      'A clever, considered approach that users would clearly choose over what they do today.']],
    ['build', 'Build', 'Does the product work in the demo video and on their site? Score what runs on the day, not what is promised for later.', [
      'Nothing works in the video or on the site: mostly slides, mock-ups or promises.',
      'A few screens or parts work, but the main feature does not.',
      'The main feature works in a basic way, with rough edges or gaps.',
      'The core of the product works reliably in the demo and on the site, and is easy to use.',
      'Works end to end and goes beyond the core feature: impressive for one day of building.']],
    ['pitch', 'Pitch', 'Does the 3-minute video communicate the vision? Problem, insight, product and opportunity, told clearly.', [
      'The video is missing, unclear, or does not explain what they built.',
      'Shows the product, but the problem or the point is hard to follow.',
      'A clear walkthrough of the problem and the product, but flat, rushed or over time.',
      'Clear and engaging: problem, insight and product in a logical order, within 3 minutes.',
      'A compelling story that makes you want it to exist: problem, insight, product and what comes next all land.']]
  ];

  // "Ada, Alan & Grace" for two to four people.
  BH.names = function (list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' & ' + list[list.length - 1]; };

  // A team as flash cards: the answers, the site, the demo video, plus any extra cards (the judge adds a
  // rubric card): extra = [{ label, html }]. end is HTML for buttons that replace Next card on the last card.
  BH.deck = function (b, extra, end) {
    extra = extra || [];
    var p = b.pitch || {}, emb = BH.embed(p.video_url), people = BH.names(b.members.map(function (m) { return m.name; }));
    function sec(title, text, wide) { return '<div class="sec' + (wide ? ' wide' : '') + '"><h3>' + title + '</h3><p>' + (text ? BH.esc(text) : '<span class="empty">Not filled in yet.</span>') + '</p></div>'; }
    function link(url, label) { return '<a class="btn btn-sm" href="' + BH.esc(BH.href(url)) + '" target="_blank" rel="noopener">' + label + '</a>'; }
    var answers = '<div class="head"><div><h1>' + (p.app_name ? BH.esc(p.app_name) : '<span class="empty">Untitled</span>') + '</h1><p class="tag">' + BH.esc(p.tagline || '') + '</p></div>' +
      '<div class="team"><b>' + BH.esc(b.team.name || 'Unnamed team') + '</b>' + BH.esc(people) + '</div></div>' +
      '<div class="grid2">' + sec('Who it’s for', p.audience, true) + sec('The problem', p.problem) + sec('The solution', p.solution) + sec('Mission statement', p.mission, true) + sec('Value / impact', p.value, true) + '</div>';
    var site = p.site_url
      ? '<div class="card-bar"><span class="caption">' + BH.esc(p.site_url) + '</span>' + link(p.site_url, 'Open the site') + '</div>' +
        '<iframe class="frame site" src="' + BH.esc(BH.href(p.site_url)) + '" title="Team site" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>' +
        '<p class="caption" style="margin-top:8px">Some sites refuse to load inside a frame. Use Open the site if this box stays blank.</p>'
      : '<p class="empty-card">No site link yet.</p>';
    var video = p.video_url
      ? (emb ? '<iframe class="frame video" src="' + BH.esc(emb) + '" title="Demo video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>' : '<p class="empty-card">This link can’t play here.</p>') +
        '<div class="card-bar" style="margin-top:10px"><span class="caption">' + BH.esc(p.video_url) + '</span>' + link(p.video_url, 'Open the video') + '</div>'
      : '<p class="empty-card">No demo video yet.</p>';
    var steps = ['Answers', 'Site', 'Demo video'].concat(extra.map(function (x) { return x.label; }));
    var cards = [answers, site, video].concat(extra.map(function (x) { return x.html; }));
    return '<section class="deck" data-at="0">' +
      '<nav class="deck-nav"><div class="deck-tabs" role="tablist">' + steps.map(function (s, i) { return '<button type="button" role="tab" data-go="' + i + '" aria-selected="' + (i === 0) + '"><b>' + (i + 1) + '</b>' + s + '</button>'; }).join('') + '</div></nav>' +
      cards.map(function (c, i) { return '<article class="onepager deck-card" role="tabpanel"' + (i ? ' hidden' : '') + '>' + c + '</article>'; }).join('') +
      '<div class="deck-foot row"><button class="btn btn-sm" type="button" data-step="-1" disabled>&larr; Back</button><button class="btn btn-primary btn-sm" type="button" data-step="1">Next card &rarr;</button>' +
      (end ? '<span class="deck-end row" hidden>' + end + '</span>' : '') + '</div>' +
      '</section>';
  };
  BH.deckGo = function (d, i) {
    var cards = d.querySelectorAll('.deck-card'), last = cards.length - 1;
    i = Math.max(0, Math.min(last, i)); d.setAttribute('data-at', i);
    cards.forEach(function (c, k) { c.hidden = k !== i; });
    d.querySelectorAll('[data-go]').forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); });
    d.querySelector('[data-step="-1"]').disabled = i === 0;
    var next = d.querySelector('[data-step="1"]'), end = d.querySelector('.deck-end');
    next.disabled = i === last;
    if (end) { end.hidden = i !== last; next.hidden = i === last; }
  };
  BH.deckStep = function (d, by) { BH.deckGo(d, Number(d.getAttribute('data-at')) + by); };
  // Tabs and Back/Next inside any deck under root.
  BH.wireDecks = function (root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.deck [data-go], .deck [data-step]'); if (!b) return;
      var d = b.closest('.deck');
      if (b.hasAttribute('data-go')) BH.deckGo(d, Number(b.getAttribute('data-go'))); else BH.deckStep(d, Number(b.getAttribute('data-step')));
    });
  };
  // Arrow keys, unless someone is typing.
  BH.typing = function (e) { return /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable; };

  // Leaving a page signed in as the wrong kind: sign out first so the other page asks for its code.
  BH.switchTo = async function (href) { try { await BH.api('POST', 'logout'); } catch (e) {} location.href = href; };

  BH.logout = async function () { try { await BH.api('POST', 'logout'); } catch (e) {} location.reload(); };

  // The same twinkling sky as the landing page, trimmed: static under reduced motion.
  BH.stars = function () {
    var c = document.querySelector('.sky canvas'); if (!c) return;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = c.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), W, H, stars = [], raf = 0;
    var tints = ['255,255,255', '255,255,255', '214,226,255', '255,232,214', '190,205,255'];
    function size() { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function seed() { stars = []; var n = Math.min(700, Math.round(W * H / 2200)); for (var i = 0; i < n; i++) { var big = Math.random() < .035; stars.push({ x: Math.random() * W, y: Math.random() * H, r: big ? 1.4 + Math.random() * 1.2 : .35 + Math.random() * .9, big: big, a: big ? .8 + Math.random() * .2 : .25 + Math.random() * .7, tw: .4 + Math.random() * 1.6, ph: Math.random() * 6.28, tint: tints[Math.random() * tints.length | 0] }); } }
    function draw(ts) { raf = 0; var t = ts / 1000; ctx.clearRect(0, 0, W, H); for (var i = 0; i < stars.length; i++) { var p = stars[i], a = p.a * (reduce ? 1 : .72 + .28 * Math.sin(t * p.tw + p.ph)); if (p.big) { var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5); g.addColorStop(0, 'rgba(' + p.tint + ',' + a * .55 + ')'); g.addColorStop(1, 'rgba(' + p.tint + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill(); } ctx.fillStyle = 'rgba(' + p.tint + ',' + a + ')'; if (p.r < .7) ctx.fillRect(p.x, p.y, 1, 1); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); } } if (!reduce && !document.hidden) raf = requestAnimationFrame(draw); }
    function start() { if (!raf) raf = requestAnimationFrame(draw); }
    size(); seed(); start();
    addEventListener('resize', function () { size(); seed(); start(); });
    document.addEventListener('visibilitychange', start);
  };
  document.addEventListener('DOMContentLoaded', BH.stars);
})();
