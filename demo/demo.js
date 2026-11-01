/* See ChatAdmin in Action - the sample-environment demonstration.
 *
 * The one script on neopiq.ai. Rules it keeps (checked by website/check-site.py):
 *   - no network: no fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, dynamic import;
 *   - no storage: no localStorage, sessionStorage, IndexedDB, cookies;
 *   - no framework, no remote asset; everything lives in this page until it is closed.
 * The scenarios are scripted over a FICTIONAL sample tenant, "Contoso Example" (the same name the
 * Microsoft 365 agent's simulated tenant uses). Every result says "simulated". Nothing here can
 * change anything anywhere.
 */
(function () {
  'use strict';

  var ENV = 'Contoso Example';

  /* ------------------------------------------------------------------ scenarios */
  var SCENARIOS = {
    joiner: {
      id: 'joiner',
      label: 'Sarah starts in Finance on Monday. Prepare what she needs.',
      short: 'A joiner: account, group, licence, mailbox, team',
      keywords: ['sarah', 'start', 'starts', 'join', 'joiner', 'onboard', 'new', 'prepare', 'monday', 'hire', 'lisa'],
      steps: [
        { t: 'user', text: 'Sarah starts in Finance on Monday. Prepare what she needs.' },
        { t: 'admin',
          text: 'I checked Microsoft Entra and Microsoft 365 in the ' + ENV + ' environment.',
          chips: [
            ['Entra', 'list_users', 'read', 'search "Sarah": no account; sarah.meier@contoso.example is free'],
            ['Entra', 'describe_group', 'read', 'Finance: security group, 4 members, usage location CH on all of them'],
            ['Entra', 'list_subscribed_skus', 'read', 'Business Basic 3 owned, 2 used, 1 free; Business Standard 1 of 1 used'],
            ['Microsoft 365', 'list_teams', 'read', 'team "Finance": private, owner Mary Jones, 4 members'],
            ['Microsoft 365', 'audit_mailbox_permissions', 'read', 'Finance@contoso.example: shared mailbox; Full Access: the 4 Finance members']
          ],
          after: 'No account exists for Sarah yet and the sign-in name is free. The Finance group, the Finance team and the shared mailbox Finance@contoso.example are used by the same four people. One Business Basic seat is free, the only licence with a free seat, so that is the one I propose; usage location Switzerland, like the other Finance accounts. Two cards, because two Microsoft areas change: the account first, then the mailbox and the team.'
        },
        { t: 'card', id: 'card-e',
          area: 'Microsoft Entra', agent: 'Agent E', kind: 'plan', count: 3,
          env: ENV + ' · Microsoft Entra tenant · operated by Neopiq',
          steps: [
            ['create_user', 'display name Sarah Meier, sign-in name sarah.meier@contoso.example, usage location CH; the initial password is generated on the server and never shown'],
            ['add_group_members', 'group Finance, member sarah.meier@contoso.example'],
            ['assign_license', 'Business Basic (1 seat free of 3)']
          ],
          preview: 'Pre-checks before this card: sign-in name not taken · group exists · licence owned and a seat free.',
          onApprove: [
            { t: 'run', area: 'Microsoft Entra', lines: [
              ['create_user', 'ok · verified: account read back, enabled, id 6f1c…'],
              ['add_group_members', 'ok · verified: Finance now has 5 members'],
              ['assign_license', 'ok · verified: Business Basic assigned, 0 seats free']
            ]},
            { t: 'card', id: 'card-m',
              area: 'Microsoft 365', agent: 'Agent M', kind: 'plan', count: 3,
              env: ENV + ' · Microsoft 365 tenant · acting as the service principal ChatAdmin Agent M',
              steps: [
                ['ensure_mailbox', 'sarah.meier@contoso.example — a read step: the mailbox appears a few minutes after the licence'],
                ['add_team_member', 'team Finance, member sarah.meier@contoso.example'],
                ['grant_mailbox_permission', 'Finance@contoso.example, Full Access for sarah.meier@contoso.example']
              ],
              preview: 'Pre-checks: the team exists and has an owner · the shared mailbox exists and is not protected.',
              onApprove: [
                { t: 'run', area: 'Microsoft 365', lines: [
                  ['ensure_mailbox', 'provisioned · verified: mailbox sarah.meier@contoso.example exists'],
                  ['add_team_member', 'ok · verified: membership read back (Teams may lag the group by a minute)'],
                  ['grant_mailbox_permission', 'ok · verified: rights table read back, Full Access: 5 people']
                ]},
                { t: 'result', state: 'executed', executed: '6 of 6 steps ran (simulated — nothing changed in Microsoft)',
                  verified: 'account read back: enabled, Finance member, Business Basic assigned · team membership read back · mailbox rights read back: Full Access',
                  audit: '2 cards shown, 2 approved; every step in the session transcript' },
                { t: 'admin', text: 'Sarah’s account exists in Microsoft Entra, she is in the Finance group and team, has the Business Basic licence and Full Access to the Finance mailbox. What I could not do: give her a first password — issue a Temporary Access Pass or reset it in the portal. (Simulated: nothing changed in Microsoft.)' }
              ],
              onReject: [
                { t: 'result', state: 'declined', executed: 'nothing ran in Microsoft 365 (simulated)',
                  verified: 'the account, group membership and licence from the first card stay as they are',
                  audit: '2 cards shown: 1 approved, 1 rejected' },
                { t: 'admin', text: 'Rejected — the mailbox and team steps did not run. Sarah’s account, group membership and licence exist from the first card. Say what to change and I will propose the Microsoft 365 card again; I do not retry on my own.' }
              ]
            }
          ],
          onReject: [
            { t: 'result', state: 'declined', executed: 'nothing ran (simulated)', verified: 'no account was created', audit: '1 card shown, rejected' },
            { t: 'admin', text: 'Rejected — nothing ran. Tell me what to change (a different licence, another group, a different sign-in name) and I will propose the card again. I do not retry on my own.' }
          ]
        }
      ]
    },

    roles: {
      id: 'roles',
      label: 'Who has admin roles, and does anyone have one they don’t need?',
      short: 'An access question: reads only, no card',
      keywords: ['admin', 'role', 'roles', 'global', 'administrator', 'access', 'who', 'privilege', 'permission'],
      steps: [
        { t: 'user', text: 'Who has admin roles, and does anyone have one they don’t need?' },
        { t: 'admin',
          text: 'I read the directory roles in the ' + ENV + ' environment. Reads need no approval, so there is no card in this answer.',
          chips: [
            ['Entra', 'list_directory_roles', 'read', 'active roles: Global Administrator (2), User Administrator (1), Groups Administrator (1), Exchange Administrator (1)'],
            ['Entra', 'list_role_members', 'read', 'Global Administrator: admin@contoso.example, mary@contoso.example'],
            ['Entra', 'describe_user', 'read', 'Mary Jones: Procurement lead, owner of the Procurement and Marketing teams'],
            ['Entra', 'list_audit_events', 'read', 'since 30d, actor mary@: 0 directory changes'],
            ['Entra', 'list_role_members', 'read', 'Exchange Administrator: the application ChatAdmin Agent M (expected: that is my own Microsoft 365 identity)']
          ],
          after: 'Four admin roles are active. Two accounts hold Global Administrator: the admin account, and Mary Jones. Mary leads Procurement, owns two teams and has made no change to the directory in the last 30 days — her work is in Teams and mailboxes, which a Global Administrator role is not needed for. A narrower role would cover what she does (Groups Administrator for the groups she owns), or none at all. The Exchange Administrator role is held by my own Microsoft 365 identity, which is expected. The User Administrator and Groups Administrator holders are the IT account; both look in use.'
        },
        { t: 'admin',
          text: 'What I cannot tell from here: whether Mary needs the role for something outside the directory audit log, such as a portal task I do not see. If you want the role removed, that is a card (remove_directory_role) — I never assign Global Administrator from chat, and I never remove the last one.'
        },
        { t: 'result', state: 'read', executed: 'no change proposed — reads only (simulated)', verified: '5 reads, 0 cards', audit: 'the question and the five reads are in the session transcript' }
      ]
    },

    leaver: {
      id: 'leaver',
      label: 'Tom is leaving on Friday.',
      short: 'A leaver: mailbox, files, teams, then the account',
      keywords: ['tom', 'leav', 'leaving', 'left', 'offboard', 'friday', 'departure', 'resign', 'quit'],
      steps: [
        { t: 'user', text: 'Tom is leaving on Friday.' },
        { t: 'admin',
          text: 'I checked Microsoft Entra and Microsoft 365 in the ' + ENV + ' environment.',
          chips: [
            ['Entra', 'describe_user', 'read', 'Tom Weber, tom.weber@contoso.example: Procurement, licence E3, manager Peter Brown, enabled'],
            ['Microsoft 365', 'find_mailbox', 'read', 'user mailbox, 18.2 GB, no archive'],
            ['Microsoft 365', 'lookup_onedrive', 'read', '9.1 GB, 1 240 files, last activity yesterday; manager Peter Brown'],
            ['Microsoft 365', 'audit_team_membership', 'read', 'Procurement: owners Mary Jones and Tom Weber; Tom is also a member of Marketing']
          ],
          after: 'Tom has a user mailbox under 50 GB with no archive, so it can become a shared mailbox without keeping a licence. His manager is Peter Brown, so I will hand the mailbox and the files to Peter unless you say otherwise. He is a co-owner of the Procurement team; Mary stays owner, so nothing is orphaned. One thing I cannot do is wait until Friday: nothing runs between your turns and I have no timer. I will prepare everything now; the first card (Microsoft 365) keeps Tom working, the second (Microsoft Entra) disables the account — approve that one on Friday.'
        },
        { t: 'card', id: 'card-m2',
          area: 'Microsoft 365', agent: 'Agent M', kind: 'plan', count: 6,
          env: ENV + ' · Microsoft 365 tenant · acting as the service principal ChatAdmin Agent M',
          steps: [
            ['convert_mailbox_to_shared', 'tom.weber@contoso.example (confirm_name: Tom Weber)'],
            ['grant_mailbox_permission', 'Tom’s mailbox, Full Access for peter.brown@contoso.example'],
            ['set_mailbox_forwarding', 'forward to peter.brown@contoso.example, keep a copy; internal only'],
            ['set_auto_reply', '"Tom Weber has left Contoso. Please contact Peter Brown." — internal and external'],
            ['transfer_onedrive_access', 'Tom’s OneDrive, write access for peter.brown@contoso.example (confirm_name: tom.weber@contoso.example)'],
            ['add_team_member', 'team Procurement: Peter Brown as owner']
          ],
          preview: 'No message is read or moved. Pre-checks: the mailbox is under 50 GB and has no archive · Peter is an active member · Mary remains an owner of Procurement.',
          onApprove: [
            { t: 'run', area: 'Microsoft 365', lines: [
              ['convert_mailbox_to_shared', 'ok · verified: recipient type SharedMailbox; the licence may be removed'],
              ['grant_mailbox_permission', 'ok · verified: Full Access: Peter Brown'],
              ['set_mailbox_forwarding', 'ok · verified: ForwardingAddress Peter Brown, DeliverToMailboxAndForward true'],
              ['set_auto_reply', 'ok · verified: auto-reply enabled, both audiences'],
              ['transfer_onedrive_access', 'ok · verified: Peter Brown has write access to the drive'],
              ['add_team_member', 'ok · verified: owners Mary Jones, Peter Brown, Tom Weber']
            ]},
            { t: 'card', id: 'card-e2',
              area: 'Microsoft Entra', agent: 'Agent E', kind: 'plan', count: 3,
              env: ENV + ' · Microsoft Entra tenant · operated by Neopiq',
              steps: [
                ['update_user', 'tom.weber@contoso.example: enabled false'],
                ['revoke_user_sessions', 'tom.weber@contoso.example: sign out everywhere'],
                ['remove_license', 'E3 from tom.weber@contoso.example (the shared mailbox needs none)']
              ],
              preview: 'In the real product this card would also decline itself after five minutes — you would ask again on Friday. In this sample it waits for you.',
              onApprove: [
                { t: 'run', area: 'Microsoft Entra', lines: [
                  ['update_user', 'ok · verified: accountEnabled false'],
                  ['revoke_user_sessions', 'ok · verified: sessions revoked'],
                  ['remove_license', 'ok · verified: no licence; E3 seat freed']
                ]},
                { t: 'result', state: 'executed', executed: '9 of 9 steps ran (simulated — nothing changed in Microsoft)',
                  verified: 'shared mailbox, forwarding, auto-reply, OneDrive access and team ownership read back · account disabled, sessions revoked, licence removed',
                  audit: '2 cards shown, 2 approved; every step in the session transcript' },
                { t: 'admin', text: 'Tom’s mailbox is shared and forwards to Peter with a copy kept, Peter has Full Access and his files, the auto-reply is set, Peter co-owns Procurement, the account is disabled and signed out, and the E3 seat is free. Not done: deleting the account — it stays, disabled, until you ask; a delete card restates the exact sign-in name. (Simulated: nothing changed in Microsoft.)' }
              ],
              onReject: [
                { t: 'result', state: 'declined', executed: 'the Microsoft Entra steps did not run (simulated)',
                  verified: 'the Microsoft 365 hand-over from the first card stays in place; Tom’s account is still enabled',
                  audit: '2 cards shown: 1 approved, 1 rejected' },
                { t: 'admin', text: 'Rejected — Tom’s account stays enabled and licensed; the mailbox and file hand-over from the first card remain. Ask again on Friday and I will propose the same three steps.' }
              ]
            }
          ],
          onReject: [
            { t: 'result', state: 'declined', executed: 'nothing ran (simulated)', verified: 'Tom’s mailbox, files and teams are unchanged', audit: '1 card shown, rejected' },
            { t: 'admin', text: 'Rejected — nothing ran. If someone other than Peter should take over, say who and I will propose the card again.' }
          ]
        }
      ]
    }
  };

  var ORDER = ['joiner', 'roles', 'leaver'];

  /* ------------------------------------------------------------------ dom helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  var thread = document.getElementById('demo-thread');
  var status = document.getElementById('demo-status');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.demo-scenarios button[data-scenario]'));
  var form = document.getElementById('demo-form');
  var input = document.getElementById('demo-input');
  var resetBtn = document.getElementById('demo-reset');
  var active = null;

  function say(text) { if (status) status.textContent = text; }

  function clearThread() {
    while (thread.firstChild) thread.removeChild(thread.firstChild);
  }

  function scrollTo(node) {
    if (node && node.scrollIntoView) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function addUser(text) {
    var m = el('div', 'msg msg--user');
    m.appendChild(el('span', 'msg__who', 'You'));
    m.appendChild(el('p', null, text));
    thread.appendChild(m);
    return m;
  }

  function addSystem(text) {
    var m = el('p', 'msg msg--system', text);
    thread.appendChild(m);
    return m;
  }

  function addAdmin(step) {
    var m = el('div', 'msg msg--admin');
    m.appendChild(el('span', 'msg__who', 'ChatAdmin'));
    m.appendChild(el('p', null, step.text));
    if (step.chips) {
      var ul = el('ul', 'chips');
      ul.setAttribute('aria-label', 'What ChatAdmin inspected');
      step.chips.forEach(function (c) {
        var li = el('li');
        var chip = el('span', 'chip chip--' + c[2]);
        chip.appendChild(el('span', 'chip__area', c[0] + ' · '));
        chip.appendChild(document.createTextNode(c[1]));
        chip.title = c[3];
        li.appendChild(chip);
        li.appendChild(el('span', 'sr-only', ' — ' + c[3]));
        ul.appendChild(li);
      });
      m.appendChild(ul);
      var det = el('details');
      det.appendChild(el('summary', null, 'What each read returned (simulated)'));
      var dl = el('ul');
      step.chips.forEach(function (c) { dl.appendChild(el('li', null, c[1] + ': ' + c[3])); });
      det.appendChild(dl);
      m.appendChild(det);
    }
    if (step.after) m.appendChild(el('p', null, step.after));
    thread.appendChild(m);
    return m;
  }

  function addRun(step) {
    var m = el('div', 'msg msg--admin');
    m.appendChild(el('span', 'msg__who', step.area + ' · running the approved steps (simulated)'));
    var ol = el('ol');
    step.lines.forEach(function (l) {
      var li = el('li');
      var code = el('code', null, l[0]);
      li.appendChild(code);
      li.appendChild(document.createTextNode(' — ' + l[1]));
      ol.appendChild(li);
    });
    m.appendChild(ol);
    m.appendChild(el('p', 'small muted', 'Verified after change: each line above is the state read back from the sample tenant, not the intention.'));
    thread.appendChild(m);
    return m;
  }

  function addResult(step) {
    var cls = 'result';
    if (step.state === 'declined') cls += ' result--failed';
    if (step.state === 'partial') cls += ' result--partial';
    var r = el('div', cls);
    r.setAttribute('aria-label', 'Result');
    var dl = el('dl');
    var rows = [[step.state === 'read' ? 'read' : step.state, step.executed], ['verified', step.verified], ['audit', step.audit]];
    rows.forEach(function (row) {
      dl.appendChild(el('dt', null, row[0]));
      dl.appendChild(el('dd', null, row[1]));
    });
    r.appendChild(dl);
    var a = el('pre', 'audit', '{"event":"card_resolved","decision":"' +
      (step.state === 'declined' ? 'declined' : (step.state === 'read' ? 'none' : 'approved')) +
      '","environment":"' + ENV + '","simulated":true}');
    r.appendChild(a);
    thread.appendChild(r);
    return r;
  }

  function addCard(step) {
    var c = el('div', 'card-approval');
    c.id = step.id;
    c.setAttribute('role', 'group');
    c.setAttribute('aria-label', 'Approval card: ' + step.area);
    var head = el('div', 'card-approval__head');
    var h = el('h3', null, step.area + ' (' + step.agent + ') proposes a plan — ' + step.count + ' steps, one approval');
    head.appendChild(h);
    head.appendChild(el('span', 'status status--dev', 'simulated'));
    c.appendChild(head);
    var env = el('p', 'card-approval__env');
    env.appendChild(document.createTextNode('Environment: '));
    env.appendChild(el('strong', null, step.env));
    c.appendChild(env);
    c.appendChild(el('p', 'card-approval__facts', 'SIMULATED · auto-declines in 5 min in the real product · approved by a signed-in person in the real product (not in this sample)'));
    var ol = el('ol', 'plan');
    step.steps.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('code', null, s[0]));
      li.appendChild(document.createTextNode(' — ' + s[1]));
      ol.appendChild(li);
    });
    c.appendChild(ol);
    if (step.preview) c.appendChild(el('p', 'card-approval__preview', step.preview));
    var actions = el('div', 'card-approval__actions');
    var approve = el('button', 'btn btn--primary btn--small', 'Approve');
    approve.type = 'button';
    var reject = el('button', 'btn btn--ghost btn--small', 'Reject');
    reject.type = 'button';
    var hint = el('span', 'small', 'needs the ' + step.area + ' key in the real product');
    actions.appendChild(approve);
    actions.appendChild(reject);
    actions.appendChild(hint);
    c.appendChild(actions);

    function decide(approved) {
      c.classList.add('is-decided', approved ? 'is-approved' : 'is-rejected');
      var v = el('p', 'verdict ' + (approved ? 'verdict--approved' : 'verdict--rejected'),
        approved ? '✓ Approved — running ' + step.count + ' steps (simulated)' : '✗ Rejected — nothing ran');
      actions.insertBefore(v, hint);
      hint.textContent = '';
      say(approved ? step.area + ': approved, running the steps (simulated).' : step.area + ': rejected, nothing ran.');
      play(approved ? step.onApprove : step.onReject);
    }
    approve.addEventListener('click', function () { decide(true); });
    reject.addEventListener('click', function () { decide(false); });
    thread.appendChild(c);
    approve.focus();
    return c;
  }

  function play(steps) {
    if (!steps) return;
    var last = null;
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s.t === 'user') last = addUser(s.text);
      else if (s.t === 'admin') last = addAdmin(s);
      else if (s.t === 'run') last = addRun(s);
      else if (s.t === 'result') last = addResult(s);
      else if (s.t === 'card') { last = addCard(s); break; } /* wait for the click */
    }
    scrollTo(last);
  }

  function start(id) {
    var sc = SCENARIOS[id];
    if (!sc) return;
    active = id;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-scenario') === id ? 'true' : 'false'); });
    clearThread();
    addSystem('Sample environment ' + ENV + ' · every result below is simulated · nothing here can change anything');
    say('Playing: ' + sc.label);
    play(sc.steps);
  }

  function pick(text) {
    var t = (text || '').toLowerCase();
    var best = null, bestScore = 0;
    ORDER.forEach(function (id) {
      var score = 0;
      SCENARIOS[id].keywords.forEach(function (k) { if (t.indexOf(k) !== -1) score += 1; });
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return best;
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { start(b.getAttribute('data-scenario')); });
  });

  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      var id = pick(text);
      if (id) {
        start(id);
        var note = addSystem('Nearest scripted scenario for “' + text + '”: ' + SCENARIOS[id].label);
        thread.insertBefore(note, thread.children[1] || null);
      } else {
        clearThread();
        addUser(text);
        var m = el('div', 'msg msg--admin');
        m.appendChild(el('span', 'msg__who', 'ChatAdmin'));
        m.appendChild(el('p', null, 'In this sample I can show three things:'));
        var ul = el('ul');
        ORDER.forEach(function (sid) { ul.appendChild(el('li', null, SCENARIOS[sid].label + ' — ' + SCENARIOS[sid].short)); });
        m.appendChild(ul);
        m.appendChild(el('p', null, 'Pick one on the left, or type a request that sounds like one of them. The real product understands your own words and inspects your real environment; this page plays scripted conversations over a fictional one.'));
        thread.appendChild(m);
        say('No matching scenario in this sample.');
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      }
      input.value = '';
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      clearThread();
      active = null;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      thread.appendChild(el('p', 'demo-empty', 'Pick a scenario, or type a request. Nothing you do here reaches Microsoft or leaves this page.'));
      say('Cleared.');
    });
  }

  /* deep links: demo/#joiner, #roles, #leaver */
  var hash = (location.hash || '').replace('#', '');
  if (SCENARIOS[hash]) {
    start(hash);
  } else {
    thread.appendChild(el('p', 'demo-empty', 'Pick a scenario, or type a request. Nothing you do here reaches Microsoft or leaves this page.'));
  }
  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace('#', '');
    if (SCENARIOS[h] && h !== active) start(h);
  });
})();
