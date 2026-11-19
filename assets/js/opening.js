/* app.html, "Getting ChatAdmin ready" (the wait round, 2026-11-17; the owner: no always-on hub, hide its cold start).
 * The ChatAdmin hub pauses when nobody uses it (every app scales to zero), so its first answer can take 20-30 s. This
 * page is static and on neopiq.ai, so it shows at once. It:
 *   - asks the hub to wake its products (POST /api/wake, no cookie, the answer never read),
 *   - asks /healthz whether the hub answers (no cookie; a plain GET that reads the status when the hub allows this site
 *     by CORS, and otherwise, after the browser refuses the cross-site answer, which only happens once the hub HAS
 *     answered, one GET in no-cors mode whose arrival is the signal),
 *   - draws a determinate bar (eased towards 90% over the usual start time, 100% when the hub answers) and honest stages:
 *     "Starting your ChatAdmin workspace in Switzerland" -> "Almost ready" (after most of the usual time) -> "Opening
 *     sign-in" (only once the hub has answered, or at the 45 s cap),
 *   - rotates three short facts (all three stay visible with reduced motion, and without JavaScript),
 *   - forwards with location.replace (so Back returns to the page before, never into a loop) to the visible link's
 *     address plus ?plan=msp|standard|essential, ?via=<channel> and ?ref=<invitation code> when the page was opened
 *     with them (each validated; nothing else is carried).
 * The address comes from the page's own link (a[data-product]); this file writes no address. Nothing is stored.
 * check-site.py rule 9 lets this file (and wake.js) make requests, to the product address only.
 */
(function () {
  'use strict';
  var EXPECT_S = 25, CAP_S = 45, PROBE_TIMEOUT_MS = 20000, RETRY_MS = 1500, FACT_MS = 6000, TICK_MS = 200;
  var STAGES = ['Starting your ChatAdmin workspace in Switzerland', 'Almost ready', 'Opening sign-in'];
  var target = null, origin = null, t0 = 0, done = false, ticker = null, rotator = null;

  function q(sel) { return document.querySelector(sel); }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function setStage(i) {
    var el = q('[data-ready-stage]');
    if (el && el.textContent !== STAGES[i]) { el.textContent = STAGES[i]; }
  }
  function setBar(pct) {
    var bar = q('[data-ready-bar]'), fill = q('[data-ready-fill]');
    if (!bar || !fill) { return; }
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    fill.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
  }
  function tick() {
    var s = (Date.now() - t0) / 1000;
    var pct = s < EXPECT_S ? 90 * (1 - Math.pow(1 - s / EXPECT_S, 2)) : 90 + 5 * Math.min(1, (s - EXPECT_S) / (CAP_S - EXPECT_S));
    setBar(pct);
    setStage(s >= EXPECT_S * 0.6 ? 1 : 0);
    if (s >= CAP_S) { go(); }
  }

  function go() {
    if (done) { return; }
    done = true;
    if (ticker) { clearInterval(ticker); }
    if (rotator) { clearInterval(rotator); }
    setStage(2);
    setBar(100);
    window.location.replace(target);
  }
  var attempts = 0;
  /* 1.5 s, then a little longer each time, at most 5 s: an unreachable hub is not asked more than needed */
  function retry() { if (!done) { attempts += 1; setTimeout(probe, Math.min(5000, RETRY_MS + attempts * 500)); } }

  function probe() {
    if (done) { return; }
    var url = origin + '/healthz';
    var ctl = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var kill = ctl ? setTimeout(function () { ctl.abort(); }, PROBE_TIMEOUT_MS) : null;
    var opts = { method: 'GET', cache: 'no-store', credentials: 'omit' };
    if (ctl) { opts.signal = ctl.signal; }
    window.fetch(url, opts).then(function (r) {
      if (kill) { clearTimeout(kill); }
      if (r.ok) { go(); } else { retry(); }
    }, function (err) {
      if (kill) { clearTimeout(kill); }
      if (done) { return; }
      if (err && err.name === 'AbortError') { retry(); return; }
      /* refused: by CORS (the hub answered, this site may not read it) or by the network. A no-cors GET tells the two
         apart: it arrives only from a hub that answers. */
      window.fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
        .then(function () { go(); }, function () { retry(); });
    });
  }

  function wakeProducts() {
    try {
      window.fetch(origin + '/api/wake', { method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true, cache: 'no-store' })
        .catch(function () { /* a courtesy: the health check decides */ });
    } catch (e) { /* no wake */ }
  }

  function rotateFacts() {
    var facts = document.querySelectorAll('[data-fact]');
    if (facts.length < 2 || reducedMotion()) { return; }
    var i = 0;
    function show() {
      for (var k = 0; k < facts.length; k++) { facts[k].hidden = k !== i; }
    }
    show();
    rotator = setInterval(function () { i = (i + 1) % facts.length; show(); }, FACT_MS);
  }

  function start() {
    var link = q('a[data-product]');
    if (!link) { return; }
    var base = link.getAttribute('href');
    // carried on to /start: the plan (msp|standard|essential), the entry channel (via=marketplace|linkedin|...)
    // and an invitation code (ref=...); each validated so nothing else from the address reaches the hub
    var q = window.location.search || '', keep = [];
    var m = /[?&]plan=(msp|standard|essential)(?:&|$)/.exec(q);
    if (m) keep.push('plan=' + m[1]);
    var v = /[?&]via=([a-z][a-z0-9-]{1,23})(?:&|$)/.exec(q);
    if (v) keep.push('via=' + v[1]);
    var r = /[?&]ref=([A-Za-z0-9_-]{6,64})(?:&|$)/.exec(q);
    if (r) keep.push('ref=' + r[1]);
    target = base + (keep.length ? '?' + keep.join('&') : '');
    link.setAttribute('href', target);
    try { origin = new window.URL(base).origin; } catch (e) { origin = null; }
    if (!origin || typeof window.fetch !== 'function') { window.location.replace(target); return; }
    var bar = q('[data-ready-bar]');
    if (bar) { bar.hidden = false; }
    t0 = Date.now();
    tick();
    ticker = setInterval(tick, TICK_MS);
    rotateFacts();
    wakeProducts();
    probe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
