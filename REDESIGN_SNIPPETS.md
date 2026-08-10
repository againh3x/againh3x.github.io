# REDESIGN_SNIPPETS.md

Canonical shared blocks for the redesign. Page agents paste these VERBATIM and
only make the substitutions each block's instructions call out. Do not restyle
or reorder anything here; the auth-slot pre-paint architecture depends on the
snippet and auth.js rendering byte-identical markup.

Blue means the user, red means the AI. Never map colors to Aff/Neg.
No em dashes anywhere, in copy or comments.

---

## 1. Head block

Paste at the top of `<head>` on every standard page. Substitutions:

- `PAGE TITLE`: the page's own title.
- Keep the CSP meta EXACTLY as printed (identical across all pages).
- `Flow.html` gets NO site header but still uses this head block minus the
  pre-paint snippet if it has no `#authSlot`.

```html
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https://*.googleusercontent.com https://www.google-analytics.com https://www.googletagmanager.com; media-src 'self' blob:; connect-src 'self' https://pf-ai-debater-24c5902c1a88.herokuapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://api.emailjs.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com https://apis.google.com https://publicforumai.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self' https://api.emailjs.com"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<script>
/* Clickjacking guard. frame-ancestors is ignored in <meta> and GitHub Pages
   cannot send X-Frame-Options, so hide the page first, then try to break out. */
if (self !== top) { document.documentElement.style.display = 'none'; try { top.location = self.location; } catch (e) {} }
</script>

<!-- Google tag (gtag.js) -->
<script async="" src="https://www.googletagmanager.com/gtag/js?id=G-ERE3HL6LKB"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-ERE3HL6LKB');
</script>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>PAGE TITLE</title>
<link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180"/>
<link href="/favicon-32x32.png" rel="icon" sizes="32x32" type="image/png"/>
<link href="/favicon-16x16.png" rel="icon" sizes="16x16" type="image/png"/>
<link href="/site.webmanifest" rel="manifest"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
<link rel="stylesheet" href="toolbar.css"/>
<link rel="stylesheet" href="pf-theme.css"/>
```

Notes:
- Do NOT add the old Roboto or Font Awesome links; icons are inline SVG now.
- Page-specific `<style>` goes AFTER these links so page CSS can win the
  cascade where needed.
- Give the body `class="pf-page"` (or set the same background/font tokens in
  page CSS) so the page picks up the theme base.

### 1b. #authSlot pre-paint snippet

Paste directly after the CSS links, before any page `<style>`, on every page
that carries the site header. This must match auth.js byte-for-byte in the
classes and structure it paints. If you change it, change auth.js too, and
vice versa (foundation owns both).

```html
<script>
/* Paint the cached auth state into #authSlot before first render; auth.js reconciles. */
(function () {
  var snap = null;
  try { snap = JSON.parse(localStorage.getItem('pfai_auth_snapshot')); } catch (e) {}
  if (!snap || !snap.uid) return;
  document.documentElement.classList.add('pfai-signed-in');
  var painted = false;
  function paint() {
    if (painted) return;
    var slot = document.getElementById('authSlot');
    if (!slot) return;
    painted = true;
    obs.disconnect();
    var name = (snap.displayName || (snap.email || '').split('@')[0] || 'User').trim();
    var initials = name.slice(0, 2).toUpperCase() || '?';
    var premium = snap.plan === 'premium';
    var planLabel = premium ? 'Premium' : 'Free plan';
    slot.innerHTML = '<div class="user-menu-wrap">' +
      '<button class="pf-avatar-btn' + (premium ? ' premium' : '') + '" type="button" aria-haspopup="true" aria-expanded="false">' +
      '<span class="pf-avatar-initials"></span>' +
      (premium ? '<span class="pf-avatar-star">★</span>' : '') +
      '</button></div>';
    slot.querySelector('.pf-avatar-initials').textContent = initials;
    slot.querySelector('.pf-avatar-btn').title = name + ' · ' + planLabel;
    var myRounds = document.querySelectorAll('a[data-nav="myrounds"]');
    for (var i = 0; i < myRounds.length; i++) myRounds[i].setAttribute('href', 'rounds.html');
  }
  var obs = new MutationObserver(paint);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', paint);
})();
</script>
```

---

## 2. Site header markup

First element inside `<body>` on every standard page. `Flow.html` gets NO site
header (the round page keeps its own top bar). Substitutions:

1. Add `aria-current="page"` to the nav link for the current page (that is the
   whole active-state mechanism; toolbar.css styles it). On pages not in the
   nav (index, login, profile, round, ballot) mark nothing. rounds.html IS in
   the nav (My Rounds): it marks its own data-nav="myrounds" link active.
2. In the SIGN IN href, replace `%2Fsetup.html` with the page's own path,
   URL-encoded (index.html uses `%2Findex.html`, casewriter.html uses
   `%2Fcasewriter.html`, and so on). Pages that should never round-trip back
   to themselves after login (login.html itself) drop the `?next=` part.
3. Do not touch the My Rounds link: it ships pointing at login and the
   pre-paint snippet + auth.js swap it to rounds.html when signed in.

```html
<nav class="toolbar">
  <a class="logo" href="index.html">
    <img src="android-chrome-192x192.png" alt="PublicForumAI logo"/>
    <span class="logo-text">PublicForumAI</span>
  </a>
  <div class="nav-links">
    <a href="flower.html">Flow</a>
    <a href="casewriter.html">Casewriter</a>
    <a href="setup.html">Practice Round</a>
    <a href="login.html?next=%2Frounds.html" data-nav="myrounds">My Rounds</a>
    <a href="modules.html">Training</a>
    <a href="pricing.html">Pricing</a>
  </div>
  <div id="authSlot"><a href="login.html?next=%2Fsetup.html"><div class="button signin"><span class="title">SIGN IN</span></div></a></div>
</nav>
```

The bar is sticky; pages need NO body top padding for it. Do not add any.

---

## 3. Site footer markup

Last element before the scripts on every standard page (not Flow.html). The
form field names (`from_email`, `message`), the form id, and the EmailJS ids
in the script below are load-bearing; never rename them.

```html
<footer class="pf-footer">
  <div class="pf-footer-cols">
    <div class="pf-footer-brand">
      <a class="pf-footer-logo" href="index.html">
        <img src="android-chrome-192x192.png" alt="PublicForumAI logo"/>
        <span>PublicForumAI</span>
      </a>
      <p class="pf-footer-tag">Empowering debaters through AI</p>
    </div>
    <div class="pf-footer-contact">
      <h4>Contact Us</h4>
      <a class="pf-footer-email" href="mailto:support@publicforumai.com">support@publicforumai.com</a>
      <div class="pf-footer-or"><span></span><span class="pf-footer-or-label">OR</span><span></span></div>
      <form id="feedbackForm" class="pf-footer-form">
        <input name="from_email" placeholder="Your email" required="" type="email"/>
        <textarea name="message" placeholder="Your feedback" required="" rows="3"></textarea>
        <button type="submit">Submit Feedback</button>
        <p class="pf-form-status" id="feedbackStatus" role="status" hidden></p>
      </form>
    </div>
    <div class="pf-footer-social">
      <h4>Follow Us</h4>
      <div class="pf-footer-links">
        <a href="https://www.linkedin.com/in/arda-altintepe-584b5b306/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://www.youtube.com/@PublicForumAI" target="_blank" rel="noopener">YouTube</a>
        <a href="https://www.reddit.com/r/PublicForumAI/" target="_blank" rel="noopener">Reddit</a>
      </div>
    </div>
  </div>
  <div class="pf-footer-bottom-wrap">
    <div class="pf-footer-bottom">
      <span>© 2026 PublicForumAI. All rights reserved.</span>
      <span>Not for use in live rounds.</span>
    </div>
  </div>
</footer>
```

### 3b. Footer form wiring

Paste once per page, after the footer (an inline script is fine; CSP allows
it). Identical everywhere.

```html
<script>
// Feedback form: inline status messages, no dialogs.
(function () {
  var form = document.getElementById('feedbackForm');
  var status = document.getElementById('feedbackStatus');
  if (!form || !status) return;

  function showStatus(message, ok) {
    status.textContent = message;
    status.classList.remove('ok', 'err');
    status.classList.add(ok ? 'ok' : 'err');
    status.hidden = false;
  }

  try {
    if (window.emailjs) emailjs.init('wgsczkr19C1FrKtLj');
  } catch (e) { /* handled on submit */ }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!window.emailjs) {
      showStatus('The feedback service did not load. Please email us directly instead.', false);
      return;
    }

    var btn = form.querySelector('button');
    status.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    function done() {
      btn.disabled = false;
      btn.textContent = 'Submit Feedback';
    }

    emailjs.sendForm('service_t9hewr3', 'template_i2yiwaj', form)
      .then(function () {
        form.reset();
        showStatus('Thanks! Your feedback was sent.', true);
        done();
      }, function (error) {
        showStatus('Something went wrong and your feedback was not sent. Please try again, or email us directly.', false);
        console.error('Error:', error);
        done();
      });
  });
})();
</script>
```

---

## 4. Script include order

At the very end of `<body>`, after the footer and its wiring script. The
order is a hard security requirement (sanitize and gate must exist before any
API result renders):

```html
<script src="auth.js"></script>
<script src="sanitize.js"></script>
<script src="gate.js"></script>
<script src="api.js"></script>
```

Pages without gated content still include all four (auth paints the header,
api provides pfMe/pfUpsell). Page-specific scripts go after these.

---

## 5. pfNextSpeech helper (copy-paste into round pages)

The glow/navigation cue: exactly one action button carries the cyan halo
(`box-shadow: var(--pf-glow)`), the next speech in the round. If that speech
is on the sheet the user is not looking at, the Toggle button glows instead.
These sequence arrays are the contract's production ordering for both
speaking orders; do not reorder them.

```js
/* pfNextSpeech(cells, youFirst) -> { sheet: 'my'|'ai', i: 0..3 } or null.
   cells = { my: [s0,s1,s2,s3], ai: [s0,s1,s2,s3] } where each entry is the
   cell state and 'done' means that speech is flowed. Columns per sheet:
   0 Case, 1 Rebuttal, 2 Summary, 3 Final Focus. 'my' is the user's sheet
   (the user's case plus the AI answering it); 'ai' is the AI's sheet.
   youFirst is true when the user speaks first. When resuming a server
   draft, build cells by marking a slot 'done' when its content field is
   non-empty, 'empty' otherwise, then recompute the glow from this. */
function pfNextSpeech(cells, youFirst) {
  var seq = youFirst
    ? [['my', 0], ['ai', 0], ['ai', 1], ['my', 1], ['my', 2], ['ai', 2], ['ai', 3], ['my', 3]]
    : [['ai', 0], ['my', 0], ['my', 1], ['ai', 1], ['ai', 2], ['my', 2], ['my', 3], ['ai', 3]];
  for (var k = 0; k < seq.length; k++) {
    var sheet = seq[k][0], i = seq[k][1];
    if (cells[sheet][i] !== 'done') return { sheet: sheet, i: i };
  }
  return null;
}
```

---

## 6. pf-theme.css class reference

Tokens: every README design token is a `--pf-*` custom property on `:root`
(see pf-theme.css for the full list). Highlights: `--pf-bg`, `--pf-surface`,
`--pf-border`, `--pf-text`, `--pf-text-muted`, `--pf-accent` (page accent
#7DD3FC), `--pf-accent-bar` (topbar-only #6FCBFF), `--pf-blue`, `--pf-ai`,
`--pf-gold`, `--pf-font`, `--pf-font-serif`, `--pf-font-mono`, `--pf-glow`.

| Class | Use |
|---|---|
| `pf-page` (on body) | Theme base: bg, text color, Archivo stack |
| `pf-btn-primary` (+ `--lg`) | Action-blue button/link, 42px (48px lg) |
| `pf-btn-secondary` | Deep-blue secondary button |
| `pf-btn-ghost` | Transparent bordered button (Not now, Manage plan) |
| `pf-card` (+ `--home`, `--list`, `--sunken`) | Surface card; home 10px radius, list 8px |
| `pf-panel-header` | Raised panel header strip |
| `pf-input` | Text input/textarea, sunken bg, focus border |
| `pf-option` (+ `.is-selected` or `aria-pressed="true"`) | Setup/judge option buttons; children `pf-option-label`, `pf-option-note` |
| `pf-chip pf-chip--won` / `--lost` | 44x24 mono Won/Lost result chip |
| `pf-chip pf-chip--premium` | Gold premium chip |
| `pf-plan-badge` (+ `--premium`) | 20px plan name badge on Plan cards |
| `pf-quota-bar` > `pf-quota-bar__fill` (+ `.is-full`, `.is-premium`) | 5px quota bar; set fill width inline. Amber, red at limit, blue premium |
| `pf-eyebrow` (+ `--accent`) | Mono uppercase eyebrow label |
| `pf-section-num` | Mono `01`-style section number |
| `pf-menu`, `pf-menu-item`, `pf-menu-chev` | Generic dropdown surface + rows |
| `pf-modal-backdrop` > `pf-modal` | Overlay modal shell |
| `pf-upsell-*` | Upsell modal internals (pfUpsell in api.js builds these) |
| `pf-dots` (6 empty spans) | Six-dot loader, `pf-dot` staggered |
| `pf-lock-badge` | 16px premium lock pinned to a button's top-right; parent needs `position: relative` |
| `pf-footer` + `pf-footer-*` | Footer layout (markup in section 3) |

Keyframes available: `pf-dot`, `pf-wave`, `pf-bar`, `pf-fade`, `pf-ready`.

api.js globals: `pfFetch`, `pfToast`, `pfCooldown`, `pfUpsell(feature, {resetAt})`,
`pfMe({fresh})`, `pfMeInvalidate()`, `pfRoundStart(data, opts)`,
`pfRoundPatch(id, patch, opts)`, `pfRoundDelete(id, opts)`, `pfRounds(opts)`,
`pfRound(id, opts)`. Upsell feature slugs: `speak`, `redo`, `contentions`,
`real_evidence`, `rounds`, `cases`, plus internal `quota_rounds` /
`quota_cases` (fired automatically on 402 quota_exhausted with the resetAt
date appended). `pfMe` resolves null signed out; it tolerates a backend
without plan fields (treat missing plan as free). Listen for the `pfai:me`
CustomEvent (detail = the /me JSON) to refresh quota meters, and never render
LLM or user text with innerHTML except through `pfSanitize` /
`pfSanitize.escape`.
