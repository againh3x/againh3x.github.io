# PublicForumAI Overhaul Plan
Auth + UI polish + security hardening. Written 2026-08-09, grounded in the 10-agent audit (full findings: session task output `wy0hfzj3i.output`).

## System today
- Frontend: static GitHub Pages site (`againh3x/againh3x.github.io` → publicforumai.com). Pages: index, setup, Flow (the in-round page), round (saved-round viewer), flower (standalone AI Flow tool), casewriter, modules, login, profile.
- Backend: FastAPI on Heroku (`pf-ai-debater-24c5902c1a88`), repo `DebatePF-AI`, 15 POST endpoints, every one of them calls a paid API (OpenAI, Deepgram, Google TTS, Perplexity) with no auth, no rate limits, hardcoded keys.
- Partial Firebase Auth exists (project `publicforumai`, SDK v9.23 modular): email/password only, username-first with synthesized `<username>@pf.local` fake emails, no verification, no OAuth (deliberately removed at some point), no 2FA, no gating, no backend token verification. Toolbar widget in `auth.js`.
- A peer branch `luna-upgrade` (other Claude session) owns the model swap to gpt-5.6-luna + citation pipeline in `main.py`; its contract is in `PROMPTS_LUNA_UPGRADE.md` in the backend repo. Auth work must not collide with it (see Coordination).

## 1. Auth architecture

**Identity provider: Firebase Auth (existing project), enforced server-side with firebase-admin.**
Rationale: already integrated, battle-tested password storage and OAuth flows, native email verification, native TOTP MFA (via the Identity Platform upgrade), and the backend can verify ID tokens statelessly. Rolling custom auth would mean owning password hashing, session fixation, token revocation, and OAuth handshakes ourselves for no benefit.

### Sign-in methods
- **Google OAuth**: `GoogleAuthProvider` + `signInWithPopup`, falling back to `signInWithRedirect` when popups are blocked. Google emails count as verified.
- **Email/password**: real, routable email required. The `@pf.local` synthesis is removed. Username is kept as `displayName`. `sendEmailVerification` fires at signup; gated actions are blocked (client and server) until `email_verified` is true. `sendPasswordResetEmail` gives the forgot-password flow.
- **Legacy `@pf.local` accounts**: treated as unverified by the backend. On next login they get a mandatory "attach a real email" step (`verifyBeforeUpdateEmail`), which converts them into verified accounts. No data loss.

### 2FA (TOTP) + recovery
- Firebase **TOTP MFA** (`TotpMultiFactorGenerator`, SDK ≥ 9.19 — we're on 9.23). Requires flipping the project to **Identity Platform** in the console and enabling TOTP — a one-time console step done with Arda (free tier covers this usage).
- Enrollment is optional, from the profile page (QR code + manual secret). Once enrolled, Firebase itself refuses to mint tokens until the TOTP challenge passes — enforcement is at token issuance, not in our code.
- **Recovery codes** (not a Firebase built-in): at enrollment the backend generates 10 single-use codes, stores SHA-256 hashes in Firestore, and returns them for one-time display/download. Recovery endpoint: user proves password ownership (Firebase re-auth), presents a code; backend verifies the hash, consumes it, and uses firebase-admin to unenroll the TOTP factor so they can sign in and re-enroll.
- Fallback if Identity Platform can't be enabled when Arda is available: backend-session 2FA (backend mints its own short-lived session JWT only after TOTP passes; all gated endpoints require it). The frontend gate API is written so this swap wouldn't touch page code.

### Backend enforcement
- All 15 POST endpoints require `Authorization: Bearer <Firebase ID token>`; middleware in a **new file `auth.py`** (keeps `main.py` churn minimal for luna-branch coordination) verifies with `firebase_admin.auth.verify_id_token`, requires `email_verified` (or Google provider), and injects `uid` into the request.
- Structured 401/403 JSON (`{"error": "auth_required" | "email_unverified"}`) that the frontend maps to the gate flow.
- `GET /` stays open for Heroku health checks.

### Account data moves server-side
- Firestore via firebase-admin (server-only; **client Firestore access denied entirely by rules** — a pre-2FA or stolen Firebase token gets nothing).
- `users/{uid}`: gems, createdAt, modules progress. `users/{uid}/rounds/{id}`: saved rounds. `users/{uid}/recovery/{codeHash}`: recovery codes.
- New endpoints: `GET /me` (profile), `POST /rounds` / `GET /rounds` / `GET /rounds/{id}`, `POST /modules/complete`, `POST /profile/import` (one-time migration of the existing localStorage `pfai_profile::<uid>` blob, capped/validated, accepted once per uid).
- Gems become server-awarded on real events (round feedback generated, module completed) instead of client-writable.

### Login gating + state preservation
New shared `gate.js` on every page:
- `requireAuth({ saveState })` — if signed out or unverified: run the page's `saveState()` (stashes to `localStorage["pfai_pending::<page>"]`), then redirect to `login.html?next=<current URL>`. `next` is validated same-origin+whitelist (fixes the existing open redirect at login.html:59-65).
- After login, each page checks for its pending stash and restores form state.
- Gate points (from the audit, with exact entry hooks):
  - **setup.html** start button (`goToLink`, setup.html:666) — stash topic/side/turn/skill (they already serialize to the Flow.html query string, so `next` alone carries them).
  - **Flow.html page entry** (script.js:62 init) — signed-out arrivals bounce to login with the full query string preserved.
  - **All in-round paid buttons** (record/transcribe, generate case/rebuttal/summary/FF, TTS, feedback) — gate *before* `getUserMedia` since live audio can't survive a redirect; `savedRound` autosave already covers generated content.
  - **casewriter.html** generate (casewriter.html:1336) — stash topic/side/skill/contentions (currently DOM-only).
  - **flower.html** record button (flower.html:1324) — stash topic/side/speech selection.
  - **modules.html** — keep the existing whole-page gate, extend `next` to carry module id + page index.
  - **index.html** — nav stays browsable (site remains visitable logged-out, per requirement); the New2Debate localStorage-only gate is replaced by the real modules gate.
- Defense in depth: client gates are UX; the backend 401s are the enforcement. Every fetch wrapper catches 401/403 and triggers the same gate flow, so a bypassed client gate degrades gracefully.

## 2. UI polish

### Toolbar (the #1 bug) — root cause from audit
Two compounding mechanisms: (A) within a page load, `#authSlot` cycles three different geometries (static SIGN IN pill → auth.js hydration reservation 260×44 → signed-in button), with auth.js loading at end-of-body so the jump happens after first paint; (B) across pages, every page ships its own diverged copy of the toolbar CSS (padding 10px vs 12px, logo 1.4/1.55/1rem, three different font stacks, body clearance 64/72/80/100px), and the shared styles.css toolbar rules are only loaded by login.html — which has no toolbar.

Fix:
- New `toolbar.css`, loaded in `<head>` on all pages: fixed-height bar (64px, border-box), fixed-geometry `#authSlot` (both signed-in and signed-out states render at identical size), single `body{padding-top:64px}`, one accent (`#6FCBFF`), one font at weight 700.
- Tiny inline `<head>` script pre-renders the auth slot from the `pfai_auth_snapshot` cache so the correct state paints on first frame; auth.js only reconciles content, never geometry.
- Delete all per-page inline toolbar CSS and "FINAL OVERRIDE" stacks; relative hrefs everywhere; fix modules.html's dead `new2debate.html` link; add the toolbar to login.html for consistency.

### Per-page fixes
All ~170 audited findings, notably: index.html's click-blocking `.toolbar::before` overlay, 500px fixed-width button overflowing phones, double-scroll chevron jank, silent feedback form, negative-margin layout collisions, dueling hero rulesets; setup/casewriter/flower/modules each have their own broken-responsive and dead-CSS lists; alert()/confirm() dialogs replaced with inline UI throughout. **The in-round look (Flow.html/oldstyles.css computed styles) is preserved** — only functional bugs fixed there; oldstyles.css is scoped/deduped without changing what renders.
Copy pass: no em dashes, no AI-slop phrasing, consistent product naming.

## 3. Security hardening

- **Secrets**: OpenAI/Deepgram/Perplexity keys + `tts_key.json` + `.env` are live in a public repo and its history — move all to env vars (`GOOGLE_APPLICATION_CREDENTIALS_JSON` for TTS), add `.gitignore`, and **rotate all four with Arda at deploy time** (rotating early breaks prod). The luna branch also claims env-var work: coordinated so exactly one branch does it (see Coordination).
- **CORS**: `allow_origins=["https://publicforumai.com", "https://www.publicforumai.com"]` (+ localhost for dev), drop wildcard+credentials.
- **Rate limiting**: slowapi keyed by uid (IP fallback pre-auth), per audit: case/speech generation 10/h, /transcribe 40/h + 25MB cap, /tts 30/h + 6k char cap, /tech + /lay 6/h, /process* 20/h. 429s carry `Retry-After`; the frontend fetch wrapper shows a friendly cooldown toast and disables the triggering button with a countdown.
- **Input validation**: length caps on every text field (topic ≤ 500 chars, transcripts ≤ 60k, contentions int 1–4), request-size middleware, graceful 4xx JSON instead of raw 500s.
- **Backend bug fixes** (audit-confirmed): /get_sources UnboundLocalError on Perplexity failure, /tts `app.logger` AttributeError, format_debate_case impact duplication, missing-field `None` interpolation into prompts, duplicate handler names.
- **XSS**: LLM output and user transcripts are rendered via innerHTML in ~20 sinks (script.js, casewriter, flower, round, profile). Add a small local sanitizer (escape-then-format: we control the only markup we emit — `<strong>`, line breaks, and the luna citation anchors per PROMPTS_LUNA_UPGRADE.md's contract) and route every sink through it.
- **Headers**: meta CSP on all pages (GitHub Pages can't set headers), referrer-policy, X-Content-Type-Options where meta-expressible.
- **Misc**: drop dicebear external avatars (local initials avatar), validated `next` redirect, Firestore rules deny-all, EmailJS kept for the contact form (public-key abuse is inherent to client-side EmailJS; acceptable for a contact form once backend abuse paths are closed — noted for Arda).

## 4. Testing
- Backend: pytest suite — auth middleware (valid/expired/unverified/absent tokens, mocked firebase-admin), rate limits, input caps, recovery-code consumption, bug-fix regressions, endpoint smoke with mocked providers.
- Frontend: local serve + Chrome automation across every page — toolbar geometry stability (measure bar height across load/auth states/pages), gate flows with state restoration, signup/verify/2FA/recovery walk-through against Firebase (needs Arda for console steps + a test account), responsive checks at phone/tablet/desktop widths, console-error sweep.
- Live: after Heroku env vars + key rotation + deploy, full production smoke test.

## Coordination (two Claude sessions, shared repos)
- Backend branch for this work: `feat/auth-hardening` off `main`. Luna work lives on `luna-upgrade` (prompt-string edits + model config). Overlap points: env-var extraction (one owner only), /get_sources (gate only, it's retired on the paid tier), /tts input preprocessing (luna adds tag-stripping; auth adds char caps — compose, don't conflict). Merge order to be agreed before either lands on `main`.
- Frontend branch: `feat/overhaul` in `publicforumai-web` (no contention; the other session doesn't touch this repo).

## Needs Arda (none block coding)
1. Firebase console: re-enable Google provider; upgrade to Identity Platform + enable TOTP MFA; confirm authorized domains.
2. Heroku: set env vars, then rotate OpenAI/Deepgram/Perplexity/Google-SA keys, deploy.
3. A live login/2FA/recovery test with a real account.
4. Decisions assumed (flag if wrong): 2FA is optional per-user, not forced; site stays browsable logged-out with only paid/round actions gated; legacy fake-email users are force-migrated to real emails on next login.
