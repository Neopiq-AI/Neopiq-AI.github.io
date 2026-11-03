/* The compact demo on the homepage (index.html, the @region:demo block): progressive enhancement over the static
 * rendering of the joiner scenario. Without this script every scenario link opens the full demo page; with it, a
 * tap plays the scenario in place with the same engine (assets/js/demo-core.js, window.NeopiqDemo).
 * Same house rules: no network, no storage, no framework, nothing leaves this page (check-site.py rule 9).
 */
(function () {
  'use strict';
  var D = window.NeopiqDemo;
  if (!D) return;
  var frame = document.querySelector('.demo-frame[data-demo="home"]');
  if (!frame) return;
  var thread = frame.querySelector('.thread');
  var status = frame.querySelector('.demo-frame__status');
  if (!thread) return;
  var picks = Array.prototype.slice.call(frame.querySelectorAll('.demo-picks a[data-scenario]'));

  var player = D.create(thread, {
    root: '',
    status: status,
    onStart: function (id) {
      picks.forEach(function (a) {
        if (a.getAttribute('data-scenario') === id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      frame.classList.add('is-playing');
    }
  });

  /* every link that names a scenario inside the frame plays it here instead of opening the demo page */
  frame.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[data-scenario]') : null;
    if (!a || !frame.contains(a)) return;
    var id = a.getAttribute('data-scenario');
    if (!D.SCENARIOS[id]) return;
    ev.preventDefault();
    player.start(id);
  });
})();
