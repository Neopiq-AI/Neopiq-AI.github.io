/* The demo page controller (demo/index.html): scenario buttons, the free-text box, Start over, deep links.
 * The scenarios and the renderer are in ../assets/js/demo-core.js (window.NeopiqDemo), shared with the homepage.
 * Same house rules: no network, no storage, no framework, nothing leaves this page (check-site.py rule 9).
 */
(function () {
  'use strict';
  var D = window.NeopiqDemo;
  if (!D) return;

  var thread = document.getElementById('demo-thread');
  var status = document.getElementById('demo-status');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.demo-scenarios button[data-scenario]'));
  var form = document.getElementById('demo-form');
  var input = document.getElementById('demo-input');
  var resetBtn = document.getElementById('demo-reset');
  var active = null;
  var EMPTY = 'Pick a scenario, or type a request. Nothing you do here reaches Microsoft or leaves this page.';

  function press(id) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-scenario') === id ? 'true' : 'false'); });
  }

  var player = D.create(thread, {
    root: '../',
    status: status,
    convertTemplate: document.getElementById('demo-convert'),
    onStart: function (id) { active = id; press(id); }
  });

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { player.start(b.getAttribute('data-scenario')); });
  });

  if (form) {
    form.hidden = false;   /* shown only with script: without it a submit would put the text in a URL (R2 L5) */
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      var id = D.pick(text);
      if (id) {
        player.start(id);
        var note = document.createElement('p');
        note.className = 'msg msg--system';
        note.textContent = 'Nearest scripted scenario for “' + text + '”: ' + D.SCENARIOS[id].label;
        thread.insertBefore(note, thread.firstChild);
      } else {
        active = null;
        press(null);
        player.unknown(text);
      }
      input.value = '';
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      active = null;
      press(null);
      player.empty(EMPTY);
      if (status) status.textContent = 'Cleared.';
    });
  }

  /* deep links: demo/#joiner, #roles, #mailbox, #leaver, #licences, #azure, #powerplatform */
  var hash = (location.hash || '').replace('#', '');
  if (D.SCENARIOS[hash]) {
    player.start(hash);
  } else {
    player.empty(EMPTY);
  }
  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace('#', '');
    if (D.SCENARIOS[h] && h !== active) player.start(h);
  });
})();
