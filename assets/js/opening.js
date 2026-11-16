/* app.html, "Opening ChatAdmin": the page stays on screen while the browser follows the meta refresh to the
 * ChatAdmin hub. The hub sleeps when unused (every app scales to zero), so its first answer can take 20-30 s;
 * until it answers, the browser keeps showing this page. This script only shows that the wait is progress:
 * the elapsed seconds and a status line. It makes no request and keeps nothing (check-site.py rule 9);
 * the navigation itself is the meta refresh, which also works without this script.
 */
(function () {
  'use strict';
  var STEPS = [
    [0, 'Starting ChatAdmin…'],
    [4, 'Waking ChatAdmin up…'],
    [12, 'Still starting: ChatAdmin was idle, so this takes a little longer…'],
    [25, 'Almost there…'],
    [45, 'This is taking longer than usual. You can keep waiting or use the button below.']
  ];
  var t0 = 0, timer = null;

  function render() {
    var stepEl = document.querySelector('[data-opening-step]');
    var timeEl = document.querySelector('[data-opening-time]');
    if (!stepEl || !timeEl) { return; }
    var secs = Math.floor((Date.now() - t0) / 1000);
    var text = STEPS[0][1];
    for (var i = 0; i < STEPS.length; i++) { if (secs >= STEPS[i][0]) { text = STEPS[i][1]; } }
    stepEl.textContent = text;
    if (secs >= 2) { timeEl.hidden = false; timeEl.textContent = secs + ' s'; }
  }

  function start() {
    t0 = Date.now();
    if (timer) { clearInterval(timer); }
    render();
    timer = setInterval(render, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  /* Back from the hub (the page restored from the back-forward cache): count again from zero. */
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) { start(); } });
}());
