/* wake.js - the early wake (the wait round, 2026-11-17; the owner: no always-on hub, hide the cold start instead).
 * Every page with a Sign in / Get started action loads this file from its header. After the page has loaded it sends
 * ONE request to the ChatAdmin hub, POST /api/wake, so the hub (which pauses when nobody uses it) starts while the
 * visitor reads, and opening ChatAdmin a little later is quick.
 *
 * What the request carries: nothing. mode no-cors (the answer is never read), credentials omit (no cookie goes with it),
 * no body, no identifier, no query; keepalive lets it finish when the visitor moves on at once.
 * How often: at most once per tab per five minutes. The time of the last wake is the only thing kept, in this tab's
 * session storage (gone when the tab closes); a browser that refuses storage simply wakes again.
 * When not at all: an automated browser (navigator.webdriver) and a visitor with Save-Data on.
 *
 * check-site.py rule 9 names this file, and opening.js, as the only scripts that may make a request, and this file as
 * the only one that may use session storage; HUB below must be the origin of the product address in app.html.
 */
(function () {
  'use strict';
  var HUB = 'https://app-chatadmin-hub.nicefield-f64590ef.switzerlandnorth.azurecontainerapps.io';
  var KEY = 'chatadmin-wake';
  var EVERY_MS = 5 * 60 * 1000;

  function due() {
    try {
      var last = Number(window.sessionStorage.getItem(KEY) || 0);
      if (last && Date.now() - last < EVERY_MS) { return false; }
      window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) { /* storage refused: wake anyway */ }
    return true;
  }

  function wake() {
    var nav = window.navigator || {};
    if (nav.webdriver) { return; }
    if (nav.connection && nav.connection.saveData) { return; }
    if (typeof window.fetch !== 'function' || !due()) { return; }
    try {
      window.fetch(HUB + '/api/wake', { method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true, cache: 'no-store' })
        .catch(function () { /* a courtesy: nothing to do */ });
    } catch (e) { /* an old browser without these options: no wake */ }
  }

  if (document.readyState === 'complete') {
    wake();
  } else {
    window.addEventListener('load', wake);
  }
}());
