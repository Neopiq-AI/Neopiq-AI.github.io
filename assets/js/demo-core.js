/* ChatAdmin demo engine - the sample-environment demonstration (WEB round, W-DEMO, 2026-11-02).
 *
 * Shared by demo/demo.js (the demo page) and assets/js/demo-home.js (the compact demo on the homepage).
 * Rules it keeps (checked by website/check-site.py rule 9):
 *   - no network: no fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, dynamic import;
 *   - no storage: no localStorage, sessionStorage, IndexedDB, cookies;
 *   - no framework, no remote asset, no absolute URL; everything lives in the page until it is closed.
 * Seven scripted scenarios over the FICTIONAL sample tenant "Contoso Example" (the same name the Microsoft 365
 * agent's simulated tenant uses). Each card carries one neutral "simulated" tag (.tag--sim, not a product status);
 * the page's band or the frame's bar says it once more. Nothing here can change anything anywhere.
 *
 * The operating model it renders (design direction section 7), with the components of DESIGN-SYSTEM.md 5.4:
 *   REQUEST -> INSPECTION (check lines completing) -> PROPOSAL ("N changes ready", Review & approve) -> the card
 *   (Approve / Reject, simulated) -> EXECUTE -> VERIFY -> EXPLAIN -> the conversion block.
 * Agent names, tool names, API operations, identifiers and diagnostic lines appear ONLY inside the closed
 * "Show technical details" disclosure. Every fact comes from agents-dev/docs/TOOLS.md, docs/WEBCHAT.md and
 * docs/demo/ (read-only for the site): tools, pre-checks, card shapes, verify lines and limits.
 */
(function () {
  'use strict';

  var ENV = 'Contoso Example';
  var ENV_E = ENV + ' · Microsoft Entra tenant · operated by Neopiq';
  var ENV_M = ENV + ' · Microsoft 365 tenant · operated by Neopiq';
  var ENV_A = ENV + ' · Azure subscription …4f21 · operated by Neopiq';
  var ENV_PP = ENV + ' · Power Platform tenant · operated by Neopiq';

  /* A scenario: request -> inspect[] (customer line + the read behind it) -> reason -> proposal -> cards[] ->
     result -> explain -> tech. A read-only scenario has no proposal and no cards: answer + limits + result. */
  var SCENARIOS = {

    joiner: {
      id: 'joiner',
      label: 'Sarah joins Finance on Monday. Prepare what she needs.',
      short: 'A joiner · 6 changes on 2 cards · Microsoft Entra, Microsoft 365',
      areas: 'Microsoft Entra · Microsoft 365',
      keywords: ['sarah', 'join', 'joins', 'joiner', 'start', 'starts', 'onboard', 'new colleague', 'new hire', 'hire', 'prepare', 'monday', 'needs'],
      inspect: [
        { text: 'Identity environment checked — no account for Sarah yet; sarah.meier@contoso.example is free',
          read: ['Entra', 'list_users', 'search "Sarah": 0 accounts; contoso.example is a verified domain, the sign-in name is free'] },
        { text: 'Finance group identified — a security group with 4 members, usage location Switzerland on all of them',
          read: ['Entra', 'describe_group', 'Finance: security group, owner Mary Jones, members Mary Jones, Lukas Frei, Nina Roth, Jonas Huber'] },
        { text: 'Licence availability checked — one Business Basic seat free',
          read: ['Entra', 'list_subscribed_skus', 'Business Basic 3 owned, 2 used, 1 free; Business Standard 12 of 12 used'] },
        { text: 'Finance team identified — private, owner Mary Jones, the same 4 members',
          read: ['Microsoft 365', 'list_teams', 'search "Finance": team Finance, private, owner Mary Jones, 4 members'] },
        { text: 'Relevant mailbox identified — Invoices@contoso.example, shared, used by the same four people',
          read: ['Microsoft 365', 'audit_mailbox_permissions', 'Invoices@contoso.example: shared mailbox; Full Access: the 4 Finance members; Send As: Mary Jones'] }
      ],
      reason: 'Sarah needs what the four Finance people have; Business Basic is the only licence with a free seat. Two Microsoft areas change, so two cards: the account first, then the mailbox and the team.',
      proposal: { count: 6, note: '2 cards · Microsoft Entra, then Microsoft 365' },
      cards: [
        { id: 'card-joiner-entra', area: 'Microsoft Entra', agent: 'Agent E', env: ENV_E, risk: 'approval',
          identity: 'the delegated sign-in of a named administrator, acting with that person’s rights and never more',
          steps: [
            ['create_user', 'Create the account Sarah Meier, sarah.meier@contoso.example, usage location Switzerland — the first password is generated on the server and never shown'],
            ['add_group_members', 'Add her to the Finance group'],
            ['assign_license', 'Assign the free Business Basic seat']
          ],
          preview: 'Checked before this card: the sign-in name is not taken · the group exists · the licence is owned and a seat is free.',
          run: [
            ['create_user', 'Account created — read back: enabled', 'POST /users; re-read: accountEnabled true, id 6f1c…'],
            ['add_group_members', 'Finance group — read back: 5 members', 'POST /groups/{id}/members/$ref; re-read: 5 members'],
            ['assign_license', 'Business Basic — read back: assigned to Sarah, 0 seats free', 'POST /users/{id}/assignLicense; re-read: skuPartNumber O365_BUSINESS_ESSENTIALS']
          ],
          onReject: {
            result: { state: 'declined', executed: 'nothing ran', verified: 'no account was created', audit: '1 card shown, rejected' },
            explain: 'Rejected — nothing ran. Tell me what to change (a different licence, another group, a different sign-in name) and I will propose the card again. I do not retry on my own.'
          }
        },
        { id: 'card-joiner-m365', area: 'Microsoft 365', agent: 'Agent M', env: ENV_M, risk: 'high',
          riskReason: 'Full Access to a mailbox is a permission change on a principal',
          identity: 'the application “ChatAdmin Agent M” with a certificate, Exchange Administrator role, no permission on mail content',
          steps: [
            ['ensure_mailbox', 'Wait for Sarah’s mailbox — it appears a few minutes after the licence (a read step)'],
            ['add_team_member', 'Add her to the Finance team'],
            ['grant_mailbox_permission', 'Give her Full Access to Invoices@contoso.example']
          ],
          preview: 'Checked before this card: the team exists and has an owner · the shared mailbox exists and is not protected. No message is read.',
          run: [
            ['ensure_mailbox', 'Mailbox — read back: exists for sarah.meier@contoso.example', 'state provisioned'],
            ['add_team_member', 'Finance team — read back: member (Teams may lag the group by a minute)', 'POST /teams/{id}/members; re-read: 5 members'],
            ['grant_mailbox_permission', 'Invoices mailbox — read back: Full Access for 5 people', 'Add-MailboxPermission -AutoMapping; re-read: the rights table']
          ],
          onReject: {
            result: { state: 'partial', executed: '3 of 6 steps ran — the Microsoft 365 steps did not run', verified: 'the account, group membership and licence from the first card stay as they are', audit: '2 cards shown: 1 approved, 1 rejected' },
            explain: 'Rejected — the mailbox and team steps did not run. Sarah’s account, group membership and licence exist from the first card. Say what to change and I will propose the Microsoft 365 card again; I do not retry on my own.'
          }
        }
      ],
      result: { state: 'executed', executed: '6 of 6 steps', verified: 'every object read back from the sample tenant, not assumed', audit: '2 cards shown, 2 approved; everything in the session transcript' },
      explain: 'Sarah’s account exists, she is in the Finance group and team, has the Business Basic licence and Full Access to the Invoices mailbox. What I could not do: give her a first password — issue a Temporary Access Pass or reset it in the portal.',
      tech: {
        specialists: 'Microsoft Entra (Agent E), Microsoft 365 (Agent M), coordinated by ChatAdmin’s coordinator, which holds no key and cannot approve.',
        identifiers: 'user id 6f1c… · group Finance 53be… · Business Basic (O365_BUSINESS_ESSENTIALS): 1 seat free of 3 before, 0 after'
      }
    },

    roles: {
      id: 'roles',
      label: 'Who has administrator access?',
      short: 'An access question · reads only, no card · Microsoft Entra',
      areas: 'Microsoft Entra',
      keywords: ['admin', 'administrator', 'role', 'roles', 'global', 'access', 'who has', 'privilege', 'permission', 'rights'],
      inspect: [
        { text: 'Active administrator roles listed — 4 roles in use',
          read: ['Entra', 'list_directory_roles', 'active: Global Administrator (2), User Administrator (1), Groups Administrator (1), Exchange Administrator (1)'] },
        { text: 'Global Administrator holders read — admin@contoso.example and Mary Jones',
          read: ['Entra', 'list_role_members', 'Global Administrator: admin@contoso.example (member), mary.jones@contoso.example (member)'] },
        { text: 'Mary Jones’s work checked — Head of Finance; no change to the directory in 30 days',
          read: ['Entra', 'describe_user', 'Mary Jones: Head of Finance, owner of the Finance team and the Finance group, last sign-in today'] },
        { text: 'Audit log read — every directory change of the last 30 days was made by the IT accounts',
          read: ['Entra', 'list_audit_events', 'since 30d: 14 directory changes; actor admin@ 9, it.ops@ 5, mary.jones@ 0'] },
        { text: 'The other roles read — User and Groups Administrator: it.ops@contoso.example; Exchange Administrator: the ChatAdmin service (expected)',
          read: ['Entra', 'list_role_members', 'User Administrator, Groups Administrator: it.ops@contoso.example; Exchange Administrator: the application ChatAdmin Agent M (expected)'] }
      ],
      answer: 'Two accounts hold Global Administrator: the IT account admin@contoso.example and Mary Jones. Mary leads Finance and has not changed the directory in 30 days; her work is in Teams and mailboxes, which needs no administrator role — a narrower role, or none, would cover it. it.ops holds User Administrator and Groups Administrator, both in use. The Exchange Administrator role is held by the ChatAdmin service, which is expected. Nothing changes from this answer; reads need no approval.',
      limits: 'What I cannot tell from here: whether Mary needs the role for a portal task the audit log does not show. If you want it removed, that is a card — I never assign Global Administrator from chat, and I never remove the last one.',
      result: { state: 'read', executed: 'no change proposed — reads only', verified: '5 reads, 0 cards', audit: 'the question and the five reads are in the session transcript' },
      tech: {
        specialists: 'Microsoft Entra (Agent E), through Microsoft Graph and nothing else.',
        identifiers: 'Global Administrator template 62e9… · 2 members · removal would be remove_directory_role (never the last one)'
      }
    },

    mailbox: {
      id: 'mailbox',
      label: 'Create a shared mailbox for Finance.',
      short: 'A shared mailbox · 1 change on 1 card · Microsoft 365',
      areas: 'Microsoft 365',
      keywords: ['mailbox', 'shared', 'mail', 'create a shared', 'finance@', 'inbox', 'exchange'],
      inspect: [
        { text: 'Address checked — Finance@contoso.example is held by nobody',
          read: ['Microsoft 365', 'audit_recipient_addresses', 'Finance@contoso.example: no mailbox, mail user or group holds it'] },
        { text: 'Existing Finance mailboxes found — Invoices@contoso.example, shared, 4 people',
          read: ['Microsoft 365', 'find_mailbox', 'query "Finance", kind all: Invoices@contoso.example (shared), no other match'] },
        { text: 'Finance group read — owner Mary Jones, 4 members',
          read: ['Entra', 'describe_group', 'Finance: Mary Jones (owner), Lukas Frei, Nina Roth, Jonas Huber'] }
      ],
      reason: 'The address is free and the Finance people already share Invoices@. I propose one shared mailbox Finance@contoso.example with Mary Jones as owner (Full Access and Send As) and the three other members with Full Access. A shared mailbox under 50 GB without an archive needs no licence. One card, one change.',
      proposal: { count: 1, note: '1 card · Microsoft 365' },
      cards: [
        { id: 'card-mailbox-m365', area: 'Microsoft 365', agent: 'Agent M', env: ENV_M, risk: 'approval',
          identity: 'the application “ChatAdmin Agent M” with a certificate, Exchange Administrator role, no permission on mail content',
          steps: [
            ['create_shared_mailbox', 'Create the shared mailbox Finance, Finance@contoso.example — owner Mary Jones (Full Access and Send As), members Lukas Frei, Nina Roth, Jonas Huber (Full Access)']
          ],
          preview: 'Checked before this card: the name and the address are free · one mailbox per card · a shared mailbox, never a user mailbox.',
          run: [
            ['create_shared_mailbox', 'Mailbox created — read back: Finance@contoso.example, shared', 'New-Mailbox -Shared; Add-MailboxPermission -AutoMapping; Add-RecipientPermission; re-read: audit_mailbox_permissions'],
            ['audit_mailbox_permissions', 'Permissions — read back: Full Access 4 people, Send As Mary Jones', 'the verification read']
          ],
          onReject: {
            result: { state: 'declined', executed: 'nothing ran', verified: 'no mailbox was created', audit: '1 card shown, rejected' },
            explain: 'Rejected — nothing ran. Tell me who should own it or have access and I will propose the card again.'
          }
        }
      ],
      result: { state: 'executed', executed: '1 of 1 step', verified: 'the mailbox and its rights table read back', audit: '1 card shown, 1 approved; everything in the session transcript' },
      explain: 'Finance@contoso.example exists as a shared mailbox; Mary can send as it, all four can open it, and it appears in their Outlook within the hour. Nothing else was changed — tell me if someone else should have access.',
      tech: {
        specialists: 'Microsoft 365 (Agent M), through Microsoft Graph and the Exchange Online administration endpoint.',
        identifiers: 'exchange guid 9a2e… · recipient type SharedMailbox · no licence attached'
      }
    },

    leaver: {
      id: 'leaver',
      label: 'Offboard Peter safely.',
      short: 'A leaver · 8 changes on 2 cards · Microsoft 365, Microsoft Entra',
      areas: 'Microsoft 365 · Microsoft Entra',
      keywords: ['peter', 'offboard', 'leav', 'leaving', 'left', 'depart', 'resign', 'quit', 'last day', 'disable', 'safely'],
      inspect: [
        { text: 'Peter identified — Peter Weber, Procurement, Business Standard licence, manager Anna Keller, account enabled',
          read: ['Entra', 'describe_user', 'peter.weber@contoso.example: Procurement, licence Business Standard, manager Anna Keller, enabled, no directory role'] },
        { text: 'His mailbox checked — a user mailbox, 18.2 GB, no archive',
          read: ['Microsoft 365', 'find_mailbox', 'user mailbox, 18.2 GB of 50 GB, no archive'] },
        { text: 'His files located — OneDrive 9.1 GB, 1 240 files, last activity yesterday',
          read: ['Microsoft 365', 'lookup_onedrive', 'active; 9.1 GB; manager Anna Keller as the natural transferee'] },
        { text: 'His teams checked — co-owner of Procurement with Anna Keller; member of Marketing',
          read: ['Microsoft 365', 'audit_team_membership', 'Procurement: owners Anna Keller, Peter Weber; Marketing: member'] },
        { text: 'What his licence covers — mailbox, Teams, OneDrive; nothing else depends on it',
          read: ['Microsoft 365', 'analyze_license_impact', 'remove Business Standard: Exchange mailbox kept 30 days then deleted unless shared first, Teams lost, OneDrive lost after grace'] }
      ],
      reason: 'Safely means nothing of his is lost or deleted and he cannot sign in afterwards: his mailbox becomes shared (under 50 GB, no archive, so no licence) and his manager Anna Keller takes over the mailbox and the files. Two cards: the Microsoft 365 hand-over first, then the Microsoft Entra steps that lock the account — I have no timer, so approve the second on his last day.',
      proposal: { count: 8, note: '2 cards · Microsoft 365, then Microsoft Entra' },
      cards: [
        { id: 'card-leaver-m365', area: 'Microsoft 365', agent: 'Agent M', env: ENV_M, risk: 'high',
          riskReason: 'a mailbox type change, a forwarding, a permission grant and an ownership transfer',
          identity: 'the application “ChatAdmin Agent M” with a certificate, Exchange Administrator role, no permission on mail content',
          steps: [
            ['convert_mailbox_to_shared', 'Convert his mailbox to a shared mailbox — the card restates the exact name: Peter Weber'],
            ['grant_mailbox_permission', 'Give Anna Keller Full Access to it'],
            ['set_mailbox_forwarding', 'Forward new mail to Anna, keeping a copy — internal only; external forwarding is never possible'],
            ['set_auto_reply', 'Set the auto-reply “Peter Weber has left Contoso. Please contact Anna Keller.” — internal and external'],
            ['transfer_onedrive_access', 'Give Anna write access to his OneDrive files']
          ],
          preview: 'No message is read or moved. Checked before this card: the mailbox is under 50 GB with no archive · Anna is an active member · Procurement keeps an owner.',
          run: [
            ['convert_mailbox_to_shared', 'Mailbox — read back: shared; the licence may go', 'Set-Mailbox -Type Shared; re-read: RecipientTypeDetails SharedMailbox'],
            ['grant_mailbox_permission', 'Full Access — read back: Anna Keller', 'Add-MailboxPermission -AutoMapping'],
            ['set_mailbox_forwarding', 'Forwarding — read back: to Anna Keller, copy kept', 'Set-Mailbox -ForwardingAddress -DeliverToMailboxAndForward true'],
            ['set_auto_reply', 'Auto-reply — read back: on, both audiences', 'Set-MailboxAutoReplyConfiguration; re-read: Get-MailboxAutoReplyConfiguration'],
            ['transfer_onedrive_access', 'OneDrive — read back: Anna Keller has write access', 'POST /users/{id}/drive/root/invite, requireSignIn, no invitation mail']
          ],
          onReject: {
            result: { state: 'declined', executed: 'nothing ran', verified: 'Peter’s mailbox, files and teams are unchanged', audit: '1 card shown, rejected' },
            explain: 'Rejected — nothing ran. If someone other than Anna should take over, say who and I will propose the card again.'
          }
        },
        { id: 'card-leaver-entra', area: 'Microsoft Entra', agent: 'Agent E', env: ENV_E, risk: 'high',
          riskReason: 'disabling an account, revoking sessions and removing a licence cut a person off',
          identity: 'the delegated sign-in of a named administrator, acting with that person’s rights and never more',
          steps: [
            ['update_user', 'Disable the account peter.weber@contoso.example'],
            ['revoke_user_sessions', 'Sign him out everywhere'],
            ['remove_license', 'Remove the Business Standard licence — the shared mailbox needs none']
          ],
          preview: 'Checked before this card: the account is not an administrator and not the last of anything. In the real product this card declines itself after five minutes — you would ask again on his last day; here it waits.',
          run: [
            ['update_user', 'Account — read back: disabled', 'PATCH /users/{id} accountEnabled false; re-read'],
            ['revoke_user_sessions', 'Sessions — read back: revoked', 'POST /users/{id}/revokeSignInSessions'],
            ['remove_license', 'Licence — read back: none; one Business Standard seat freed', 'POST /users/{id}/assignLicense removeLicenses; re-read']
          ],
          onReject: {
            result: { state: 'partial', executed: '5 of 8 steps ran — the Microsoft Entra steps did not run', verified: 'the hand-over from the first card stays in place; Peter’s account is still enabled', audit: '2 cards shown: 1 approved, 1 rejected' },
            explain: 'Rejected — Peter’s account stays enabled and licensed; the mailbox and file hand-over from the first card remain. Ask again on his last day and I will propose the same three steps.'
          }
        }
      ],
      result: { state: 'executed', executed: '8 of 8 steps', verified: 'shared mailbox, forwarding, auto-reply and OneDrive access read back · account disabled, sessions revoked, licence removed', audit: '2 cards shown, 2 approved; everything in the session transcript' },
      explain: 'Peter’s mailbox is shared and forwards to Anna with a copy kept, Anna has Full Access and his files, the auto-reply is on, the account is disabled and signed out, and the seat is free. Not done: deleting the account — it stays, disabled, until you ask; a delete card restates the exact sign-in name.',
      tech: {
        specialists: 'Microsoft 365 (Agent M), Microsoft Entra (Agent E), coordinated by ChatAdmin’s coordinator, which holds no key and cannot approve.',
        identifiers: 'user id 2b7d… · drive id b!9f… · team Procurement 3f45… · Business Standard (O365_BUSINESS_PREMIUM) 12 of 12 used before, 11 after'
      }
    },

    licences: {
      id: 'licences',
      label: 'Review our available Microsoft licences.',
      short: 'A licence review · reads only, no card · Microsoft Entra, Microsoft 365',
      areas: 'Microsoft Entra · Microsoft 365',
      keywords: ['licen', 'license', 'licence', 'seat', 'seats', 'sku', 'subscription', 'e3', 'e5', 'business basic', 'business standard', 'review'],
      inspect: [
        { text: 'Licences owned and used read — Business Basic 3 of 3 · Business Standard 10 of 12 · Entra ID P1 12 of 12',
          read: ['Entra', 'list_subscribed_skus', 'O365_BUSINESS_ESSENTIALS 3/3; O365_BUSINESS_PREMIUM 10/12; AAD_PREMIUM 12/12'] },
        { text: 'Disabled accounts still licensed found — 2: Lena Vogt and Marco Rossi, both Business Standard',
          read: ['Entra', 'list_users', 'enabled false: lena.vogt@, marco.rossi@ (licensed); 3 others unlicensed'] },
        { text: 'Sign-in activity checked — every enabled licensed account signed in within 90 days',
          read: ['Entra', 'list_audit_events', 'signins true, since 90d: 10 of 10 enabled licensed accounts active (Entra ID P1 allows the sign-in log)'] },
        { text: 'What removing those two licences would break — nothing in use; each mailbox is kept 30 days, then deleted',
          read: ['Microsoft 365', 'analyze_license_impact', 'lena.vogt@, marco.rossi@: Exchange mailbox lost_after_grace (30 days), Teams and OneDrive lost; no other SKU covers them'] }
      ],
      answer: 'You own three licences. Business Basic is full (3 of 3). Business Standard has 2 free seats and 2 more held by disabled accounts — Lena Vogt and Marco Rossi have left; their mailboxes would be deleted 30 days after the licence goes, so if their mail must be kept, convert the mailboxes to shared first. Microsoft Entra ID P1 is full. No enabled account is idle. Nothing changes from this answer; reads need no approval.',
      limits: 'If you want the two seats freed, say so and I will propose one card with two steps (remove the licence from each account) — or four, with the two mailbox conversions first. I do not change a licence without a card.',
      result: { state: 'read', executed: 'no change proposed — reads only', verified: '4 reads, 0 cards', audit: 'the question and the four reads are in the session transcript' },
      tech: {
        specialists: 'Microsoft Entra (Agent E) for the licences and accounts, Microsoft 365 (Agent M) for the impact analysis.',
        identifiers: 'SKUs O365_BUSINESS_ESSENTIALS, O365_BUSINESS_PREMIUM, AAD_PREMIUM · the freeing card would be remove_license × 2 (Agent E), convert_mailbox_to_shared × 2 (Agent M)'
      }
    },

    azure: {
      id: 'azure',
      label: 'Why did our Azure resources change?',
      short: 'A change investigation · reads only, no card · Microsoft Azure',
      areas: 'Microsoft Azure',
      keywords: ['azure', 'resource', 'resources', 'changed', 'change', 'why did', 'subscription', 'deploy', 'vm', 'cost', 'activity'],
      inspect: [
        { text: 'Activity log read — 3 write operations in the last 24 hours, all by dev.lee@contoso.example',
          read: ['Azure', 'get_activity_log', 'last 24 h: Microsoft.Resources/deployments/write, virtualMachines/write, networkSecurityGroups/write; caller dev.lee@contoso.example, 02:14'] },
        { text: 'The deployment inspected — dev-build-02 in rg-app-dev: a virtual machine, a network interface, a network security group',
          read: ['Azure', 'get_deployment', 'dev-build-02: Succeeded; resources vm-build-02, nic-build-02, nsg-build-02; mode Incremental'] },
        { text: 'Public exposure checked — the new security group opens port 22 to the Internet',
          read: ['Azure', 'find_public_exposure', 'nsg-build-02 rule allow-ssh: TCP 22 from Internet (0.0.0.0/0), priority 100'] },
        { text: 'Cost and waste checked — the virtual machine is the only new billable resource; one unattached disk from an earlier machine still costs money',
          read: ['Azure', 'find_idle_resources', 'disk-build-01-os: unattached since 7 days, 128 GB; no orphan public IP'] }
      ],
      answer: 'Three changes, one cause: at 02:14 dev.lee deployed the template dev-build-02 into rg-app-dev, which created the virtual machine vm-build-02, its network interface and a security group. That security group allows SSH (port 22) from the whole Internet — the one thing here I would not leave as it is. Separately, the disk disk-build-01-os has had no machine for a week and still costs money. Nothing changes from this answer; reads need no approval.',
      limits: 'If you want the port closed or the disk removed, each is a card: narrowing the rule is a change to the security group; deleting the disk restates its exact name. I never grant Owner or User Access Administrator, and I deploy incrementally only.',
      result: { state: 'read', executed: 'no change proposed — reads only', verified: '4 reads, 0 cards', audit: 'the question and the four reads are in the session transcript' },
      tech: {
        specialists: 'Microsoft Azure (Agent A), through Azure Resource Manager, Resource Graph and Cost Management; identity: the hosted service’s managed identity, Contributor plus a role-assignment permission restricted by Azure to an allowlist.',
        identifiers: 'subscription …4f21 · /subscriptions/…/resourceGroups/rg-app-dev/providers/Microsoft.Network/networkSecurityGroups/nsg-build-02 · the fixing cards would be put_resource (the rule) and delete_resource (confirm_name)'
      }
    },

    powerplatform: {
      id: 'powerplatform',
      label: 'Create a sandbox environment for Finance.',
      short: 'A new environment · 1 change on 1 card · Microsoft Power Platform',
      areas: 'Microsoft Power Platform',
      keywords: ['sandbox', 'environment', 'environments', 'power', 'platform', 'power apps', 'power automate', 'dataverse', 'dlp', 'maker', 'flow', 'app'],
      inspect: [
        { text: 'Environments listed — Contoso (default), Production, Testing (Sandbox); none for Finance',
          read: ['Power Platform', 'list_environments', 'Contoso (default), Production, Testing (Sandbox); all in Europe'] },
        { text: 'Data-loss-prevention coverage read — one policy, Default; it covers Production and Testing, not the default environment',
          read: ['Power Platform', 'list_dlp_policies', 'Default: OnlyEnvironments [Production, Testing]; environments_without_any_policy: [Contoso (default)]'] },
        { text: 'Region checked — the other environments are in Europe; the new one goes there too',
          read: ['Power Platform', 'describe_environment', 'Testing: Sandbox, Europe, no Dataverse, security group none'] }
      ],
      reason: 'One change: a Sandbox environment “Finance Sandbox” in Europe, without a Dataverse database (add one later when an app needs it); who may build in it follows your tenant’s maker settings, and restricting it to the Finance group is a second card (built, first live run pending). Microsoft accepts the creation and then provisions, so I report it done only after reading it back.',
      proposal: { count: 1, note: '1 card · Microsoft Power Platform' },
      cards: [
        { id: 'card-pp-env', area: 'Microsoft Power Platform', agent: 'Agent PP', env: ENV_PP, risk: 'approval',
          identity: 'the delegated sign-in of a Power Platform administrator through Microsoft’s first-party client',
          steps: [
            ['create_environment', 'Create the Sandbox environment Finance Sandbox in Europe, no Dataverse database']
          ],
          preview: 'Checked before this card: the name is free · the region is valid. Microsoft answers “accepted” first; the card is not reported done until the environment is read back.',
          run: [
            ['create_environment', 'Creation accepted — Microsoft answered “accepted”, provisioning', 'POST /providers/Microsoft.BusinessAppPlatform/environments: 202; polled'],
            ['describe_environment', 'Environment — read back: Finance Sandbox, Sandbox, Europe, state Ready, no Dataverse', 'completed true; the verification read']
          ],
          onReject: {
            result: { state: 'declined', executed: 'nothing ran', verified: 'no environment was created', audit: '1 card shown, rejected' },
            explain: 'Rejected — nothing ran. Say a different region or name and I will propose the card again.'
          }
        }
      ],
      result: { state: 'executed', executed: '1 of 1 step', verified: 'the environment read back in state Ready, not assumed from the acceptance', audit: '1 card shown, 1 approved; everything in the session transcript' },
      explain: 'Finance Sandbox exists in Europe. Not done: restricting it to the Finance group and a data-loss-prevention policy for it — for now both are steps in the Power Platform admin center (the new environment is not covered by the Default policy). No Dataverse database: say so when an app needs one.',
      explainNote: { text: 'Restricting an environment to a group and creating or changing a data-loss-prevention policy from ChatAdmin are built and await their first live run.', status: 'dev', label: 'in development' },
      tech: {
        specialists: 'Microsoft Power Platform (Agent PP), through the Power Platform administration APIs.',
        identifiers: 'environment id 7444… · geo Europe · no Dataverse · the group step would be manage_environment, the policy step create_dlp_policy (both in development)'
      }
    }
  };

  var ORDER = ['joiner', 'roles', 'mailbox', 'leaver', 'licences', 'azure', 'powerplatform'];
  var RISK_WORDS = { approval: 'approval required — a state change behind one card',
                     high: 'high — the card plus a typed confirmation of the target in the customer model',
                     extreme: 'extreme — the card plus a fresh sign-in in the customer model' };
  var AREA_SHORT = { 'Microsoft Entra': 'Entra', 'Microsoft 365': 'Microsoft 365', 'Microsoft Azure': 'Azure', 'Microsoft Power Platform': 'Power Platform' };

  /* ------------------------------------------------------------------ helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* ------------------------------------------------------------------ the player */
  function create(thread, opts) {
    opts = opts || {};
    var root = opts.root || '';
    var statusEl = opts.status || null;
    var token = 0;            /* bumped on every start or clear: pending timers of an older run do nothing */
    var timers = [];

    function say(text) { if (statusEl) statusEl.textContent = text; }

    function later(ms, fn) {
      var mine = token;
      var t = setTimeout(function () { if (mine === token) fn(); }, reducedMotion() ? 0 : ms);
      timers.push(t);
    }

    function clear() {
      token += 1;
      timers.forEach(function (t) { clearTimeout(t); });
      timers = [];
      while (thread.firstChild) thread.removeChild(thread.firstChild);
    }

    function reveal(node) {
      thread.appendChild(node);
      if (node.scrollIntoView) {
        node.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      return node;
    }

    function phase(parent, text) { parent.appendChild(el('span', 'phase', text)); }

    function addSystem(text) { return reveal(el('p', 'msg msg--system', text)); }

    function addUser(text) {
      var m = el('div', 'msg msg--user');
      phase(m, 'Request');
      m.appendChild(el('p', null, text));
      return reveal(m);
    }

    function addResult(r) {
      var cls = 'result';
      if (r.state === 'declined') cls += ' result--failed';
      if (r.state === 'partial') cls += ' result--partial';
      var box = el('div', cls);
      box.setAttribute('aria-label', 'Result');
      var dl = el('dl');
      [[r.state === 'read' ? 'read' : r.state, r.executed], ['verified', r.verified], ['audit', r.audit]].forEach(function (row) {
        dl.appendChild(el('dt', null, row[0]));
        dl.appendChild(el('dd', null, row[1]));
      });
      box.appendChild(dl);
      return box;
    }

    function chips(list, kind, label) {
      var ul = el('ul', 'chips');
      ul.setAttribute('aria-label', label);
      list.forEach(function (c) {
        var li = el('li');
        var chip = el('span', 'chip chip--' + kind);
        chip.appendChild(el('span', 'chip__area', c[0] + ' · '));
        chip.appendChild(document.createTextNode(c[1]));
        li.appendChild(chip);
        ul.appendChild(li);
      });
      return ul;
    }

    function kv(parent, key, text) {
      var p = el('p');
      p.appendChild(el('span', 'tech__k', key));
      p.appendChild(document.createTextNode(' ' + text));
      parent.appendChild(p);
    }

    /* The one place agent names, tools, API operations, identifiers and diagnostic lines appear. */
    function addTech(parent, sc, decisions) {
      var det = el('details', 'tech');
      det.appendChild(el('summary', null, 'Show technical details'));
      var body = el('div', 'tech__body');
      kv(body, 'Specialists', sc.tech.specialists);
      var reads = sc.inspect.map(function (i) { return [i.read[0], i.read[1]]; });
      kv(body, 'Reads', '');
      body.appendChild(chips(reads, 'read', 'The read operations ChatAdmin ran'));
      var diag = el('ul', 'tech__diag');
      sc.inspect.forEach(function (i) { diag.appendChild(el('li', null, i.read[1] + ': ' + i.read[2])); });
      body.appendChild(diag);
      if (sc.cards) {
        var changes = [];
        sc.cards.forEach(function (c) {
          c.steps.forEach(function (s) { changes.push([AREA_SHORT[c.area] || c.area, s[0]]); });
        });
        kv(body, 'Changes', '');
        body.appendChild(chips(changes, 'change', 'The operations on the cards'));
        sc.cards.forEach(function (c) {
          var line = el('p');
          line.appendChild(el('span', 'tech__k', c.area));
          line.appendChild(document.createTextNode(' ' + c.agent + ' · identity: ' + c.identity + ' · risk class: ' + (RISK_WORDS[c.risk] || c.risk) + (c.riskReason ? ' (' + c.riskReason + ')' : '') + ' '));
          var st = el('span', 'status status--dev', 'in development');
          line.appendChild(st);
          body.appendChild(line);
        });
      }
      kv(body, 'Identifiers', sc.tech.identifiers);
      var audit = { event: sc.cards ? 'card_resolved' : 'turn_completed', environment: ENV };
      if (sc.cards) { audit.cards = decisions.length; audit.decisions = decisions; audit.approved_by = 'signed-in person'; }
      else { audit.reads = sc.inspect.length; audit.cards = 0; }
      audit.simulated = true;
      body.appendChild(el('pre', 'audit', JSON.stringify(audit)));
      det.appendChild(body);
      parent.appendChild(det);
    }

    function addConvert() {
      var tpl = opts.convertTemplate;
      if (!tpl) return;
      var node = tpl.content ? tpl.content.cloneNode(true) : null;
      if (!node) return;
      var wrap = el('div', 'convert-slot');
      wrap.appendChild(node);
      reveal(wrap);
      if (typeof opts.onComplete === 'function') opts.onComplete();
    }

    /* INSPECTION: the lines appear pending and complete one by one, then the reasoning. */
    function addInspection(sc, done) {
      var m = el('div', 'msg msg--admin');
      phase(m, 'Inspection');
      var ul = el('ul', 'inspect');
      var items = sc.inspect.map(function (i) {
        var li = el('li', 'is-pending', i.text);
        ul.appendChild(li);
        return li;
      });
      m.appendChild(ul);
      reveal(m);
      var step = 460;
      items.forEach(function (li, idx) {
        later(step * (idx + 1), function () {
          li.classList.remove('is-pending');
          if (idx === items.length - 1) {
            later(320, function () {
              if (sc.reason) {
                m.appendChild(el('p', null, sc.reason));
                say('Inspection complete: ' + sc.proposal.count + ' changes ready.');
              } else {
                say('Inspection complete: reads only, no card.');
              }
              later(260, done);
            });
          }
        });
      });
    }

    function addProposal(sc, onReview) {
      var box = el('div', 'proposal');
      var count = el('p', 'proposal__count', sc.proposal.count + (sc.proposal.count === 1 ? ' change ready ' : ' changes ready '));
      count.appendChild(el('small', null, sc.proposal.note));
      box.appendChild(count);
      var action = el('p', 'proposal__action');
      var btn = el('button', 'btn btn--primary', 'Review & approve');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        btn.disabled = true;
        box.classList.add('is-reviewed');
        onReview();
      });
      action.appendChild(btn);
      box.appendChild(action);
      reveal(box);
      btn.focus();
    }

    function addCard(card, index, total, onDecision) {
      var c = el('div', 'card-approval');
      c.id = card.id;
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', 'Approval card ' + (index + 1) + ' of ' + total + ': ' + card.area);
      var head = el('div', 'card-approval__head');
      head.appendChild(el('h3', null, card.area + ' — ' + card.steps.length + (card.steps.length === 1 ? ' step' : ' steps') + ', one approval'));
      head.appendChild(el('span', 'tag tag--sim', 'simulated'));   /* not a product status: .tag--sim, DESIGN-SYSTEM.md 5.4 */
      c.appendChild(head);
      var env = el('p', 'card-approval__env');
      env.appendChild(document.createTextNode('Environment: '));
      env.appendChild(el('strong', null, card.env));
      c.appendChild(env);
      c.appendChild(el('p', 'card-approval__facts', 'Approved by a signed-in person · declines after five minutes of silence · bound to ' + ENV));
      var ol = el('ol', 'plan');
      card.steps.forEach(function (s) { ol.appendChild(el('li', null, s[1])); });
      c.appendChild(ol);
      if (card.preview) c.appendChild(el('p', 'card-approval__preview', card.preview));
      var actions = el('div', 'card-approval__actions');
      var approve = el('button', 'btn btn--primary btn--small', 'Approve');
      approve.type = 'button';
      var reject = el('button', 'btn btn--ghost btn--small', 'Reject');
      reject.type = 'button';
      actions.appendChild(approve);
      actions.appendChild(reject);
      c.appendChild(actions);
      function decide(approved) {
        c.classList.add('is-decided', approved ? 'is-approved' : 'is-rejected');
        actions.appendChild(el('p', 'verdict ' + (approved ? 'verdict--approved' : 'verdict--rejected'),
          approved ? '✓ Approved — running ' + card.steps.length + (card.steps.length === 1 ? ' step' : ' steps')
                   : '✗ Rejected — nothing ran'));
        say(approved ? card.area + ': approved, running the steps.' : card.area + ': rejected, nothing ran.');
        onDecision(approved);
      }
      approve.addEventListener('click', function () { decide(true); });
      reject.addEventListener('click', function () { decide(false); });
      reveal(c);
      approve.focus();
      return c;
    }

    /* EXECUTE / VERIFY: the read-back lines complete one by one; the result block lands in the last run message. */
    function addRun(card, isLast, sc, done) {
      var m = el('div', 'msg msg--admin');
      phase(m, 'Execute · verify');
      var ul = el('ul', 'run');
      var items = card.run.map(function (l) {
        var li = el('li', 'is-pending', l[1]);
        ul.appendChild(li);
        return li;
      });
      m.appendChild(ul);
      reveal(m);
      var step = 380;
      items.forEach(function (li, idx) {
        later(step * (idx + 1), function () {
          li.classList.remove('is-pending');
          if (idx === items.length - 1) {
            m.appendChild(el('p', 'small muted', 'Verified after change: the state read back, not the intention.'));
            if (isLast) m.appendChild(addResult(sc.result));
            later(300, done);
          }
        });
      });
    }

    function addExplain(sc, text, note, decisions) {
      var m = el('div', 'msg msg--admin');
      phase(m, sc.cards ? 'Explain' : 'Answer');
      m.appendChild(el('p', null, text));
      if (note) {
        var p = el('p', 'small');
        p.appendChild(document.createTextNode(note.text + ' '));
        p.appendChild(el('span', 'status status--' + note.status, note.label));
        m.appendChild(p);
      }
      if (sc.limits) m.appendChild(el('p', null, sc.limits));
      addTech(m, sc, decisions);
      reveal(m);
      return m;
    }

    function runCards(sc, index, decisions) {
      var card = sc.cards[index];
      addCard(card, index, sc.cards.length, function (approved) {
        decisions.push(approved ? 'approved' : 'rejected');
        if (!approved) {
          later(200, function () {
            var m = el('div', 'msg msg--admin');
            phase(m, 'Explain');
            m.appendChild(addResult(card.onReject.result));
            m.appendChild(el('p', null, card.onReject.explain));
            addTech(m, sc, decisions);
            reveal(m);
            say('Scenario finished: rejected.');
            later(250, addConvert);
          });
          return;
        }
        var isLast = index === sc.cards.length - 1;
        later(250, function () {
          addRun(card, isLast, sc, function () {
            if (isLast) {
              addExplain(sc, sc.explain, sc.explainNote, decisions);
              say('Scenario finished: executed and verified.');
              later(250, addConvert);
            } else {
              addSystem('Second card — ' + sc.cards[index + 1].area + ' · ' + sc.cards[index + 1].steps.length + ' steps');
              later(250, function () { runCards(sc, index + 1, decisions); });
            }
          });
        });
      });
    }

    function start(id) {
      var sc = SCENARIOS[id];
      if (!sc) return false;
      clear();
      addUser(sc.label);
      say('Playing: ' + sc.label);
      if (typeof opts.onStart === 'function') opts.onStart(id);
      later(350, function () {
        addInspection(sc, function () {
          if (sc.cards) {
            addProposal(sc, function () {
              later(200, function () { runCards(sc, 0, []); });
            });
          } else {
            addExplain(sc, sc.answer, null, []);
            later(200, function () {
              reveal(addResult(sc.result));
              say('Scenario finished: reads only, nothing to approve.');
              later(250, addConvert);
            });
          }
        });
      });
      return true;
    }

    function unknown(text) {
      clear();
      addUser(text);
      var m = el('div', 'msg msg--admin');
      phase(m, 'Answer');
      m.appendChild(el('p', null, 'In this sample I can show seven things:'));
      var ul = el('ul');
      ORDER.forEach(function (sid) { ul.appendChild(el('li', null, SCENARIOS[sid].label + ' — ' + SCENARIOS[sid].short)); });
      m.appendChild(ul);
      m.appendChild(el('p', null, 'Pick one, or type a request that sounds like one of them.'));
      reveal(m);
      say('No matching scenario in this sample.');
    }

    function empty(text) {
      clear();
      thread.appendChild(el('p', 'demo-empty', text));   /* no reveal(): nothing to scroll to on load (R3 H1) */
    }

    return { start: start, clear: clear, unknown: unknown, empty: empty, root: root };
  }

  window.NeopiqDemo = { SCENARIOS: SCENARIOS, ORDER: ORDER, ENV: ENV, pick: pick, create: create };
})();
