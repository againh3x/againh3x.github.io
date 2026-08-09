# PublicForumAI Overhaul Plan (v2)
Auth + UI polish + security hardening. v2 incorporates the adversarial design review (3 lenses, 2026-08-09). This document is the binding contract for implementation; where code and this doc disagree, fix the code.

## System today
- Frontend: static GitHub Pages site (`againh3x/againh3x.github.io` → publicforumai.com). Pages: index, setup, Flow (the in-round page), round (saved-round viewer), flower (standalone AI Flow tool), casewriter, modules, login, profile.
- Backend: FastAPI on Heroku (`pf-ai-debater-24c5902c1a88`), repo `DebatePF-AI`. **16 paid POST endpoints** (verified count): /generate_ai_case, /get_sources, /transcribe, /firstrebuttal, /secondrebuttal, /firstsummary, /secondsummary, /finalfocus, /processC, /processR, /processS, /processF, /generate_ai_casewriter, /tts, /tech, /lay. GET / stays open (health check).
- Firebase Auth project `publicforumai` (SDK 9.23 modular): email/password only, username-first with synthesized `<username>@pf.local` emails, no verification, no OAuth, no 2FA, no backend verification.
- Peer branch `luna-upgrade` owns model/prompt work in `main.py` (contract: `PROMPTS_LUNA_UPGRADE.md`). Env-var extraction is owned by THIS branch (`feat/auth-hardening`); luna branch drops that item.

## 1. Auth architecture

Identity: Firebase Auth (existing project), enforced server-side with firebase-admin.

### Sign-in methods
- **Google OAuth**: `GoogleAuthProvider` + `signInWithPopup` ONLY. No `signInWithRedirect` fallback — it silently fails on Safari/Firefox storage partitioning when authDomain (`publicforumai.firebaseapp.com`) differs from the site origin, and no GitHub-Pages-compatible fix exists. On `auth/popup-blocked`, show an inline "allow popups for this site and retry" message. Google emails count as verified.
- **Email/password**: real email required **at signup** (no synthesis). Username kept as `displayName`. `sendEmailVerification` fires at signup **with ActionCodeSettings** `{url: "https://publicforumai.com/login.html?next=<encoded next>"}` so the verifying browser gets routed back. `sendPasswordResetEmail` for forgot-password.
- **Legacy `@pf.local` accounts**: sign-in path keeps a fallback — identifier without `@` attempts `<identifier>@pf.local`. Synthesis is removed from account creation only. After sign-in, legacy users hit a mandatory, **re-entrant** (re-prompted every login until done) "attach a real email" step via `verifyBeforeUpdateEmail`, with explicit copy that (a) clicking the link signs them out everywhere (Firebase revokes refresh tokens on email change) and (b) the new email becomes their login. Handle `auth/requires-recent-login` by re-prompting the password. Legacy users who forgot their password are unrecoverable (reset email goes to a fake address) — login.html detects `@pf.local` + reset attempt and says so honestly instead of pretending to send mail. Flagged for Arda sign-off.

### Email verification UX (the unstick problem)
- Verification in another tab/browser does NOT update the original tab (no auth event fires; cached token keeps `email_verified=false` up to 1h). login.html gets a **"check your email" state** for signed-in-unverified users: resend button + a poll (`user.reload()` every 5s, and on success `getIdToken(true)` then follow `next`) + an "I verified" button doing the same immediately.
- The login auto-redirect must check `email_verified || provider === 'google.com'`, never mere presence of a user — otherwise gate→login→next→gate loops forever for unverified users.

### 2FA (TOTP) + recovery
- Firebase **TOTP MFA** (`TotpMultiFactorGenerator`, needs SDK ≥ 9.19.1 — we ship 9.23). Requires Identity Platform upgrade: free, Spark plan OK (3,000 DAU cap), **no billing account needed**. TOTP enablement may need a REST PATCH rather than a console toggle — exact curl in the Arda checklist. Enforcement is at token issuance by Firebase itself.
- Enrollment: optional, from profile.html, **only shown to verified users** (Firebase requires verified email for MFA enrollment). QR + manual secret.
- **Recovery codes**: at enrollment, backend `POST /2fa/recovery-codes` generates 10 codes, **26-char base32 (~130 bits) each**, returns plaintext once, stores SHA-256 hashes in Firestore. Profile shows remaining count and prompts regeneration when ≤ 3 remain.
- **Recovery flow (redesigned — the v1 flow was unimplementable)**: a TOTP-locked-out user can never mint an ID token, so recovery is an **unauthenticated** endpoint with server-side password proof:
  1. Client: `POST /2fa/recover` `{email, password, recoveryCode}`.
  2. Backend calls Identity Toolkit REST `accounts:signInWithPassword` itself (with the web API key). Correct password on an MFA-enrolled user returns `mfaPendingCredential` (never an ID token) — that response IS the server-verified password proof. Wrong password → generic failure.
  3. Backend verifies the recovery-code hash for that uid, consumes it, then unenrolls ALL TOTP factors via Identity Toolkit REST `accounts:update` `{"localId": uid, "mfa": {"enrollments": []}}` using the service account's OAuth token (**firebase-admin Python has NO MFA API — Node-only; the REST call is the only path**).
  4. Client signs in cleanly and is nudged to re-enroll 2FA.
  - Brute-force hardening: per-account attempt counter in Firestore — 5 failed attempts → 1h lockout (independent of IP; attackers rotate IPs). Plus IP rate limit 5/h. Constant generic error for wrong email/password/code.
- Last resort (lost phone AND codes): documented manual path — Arda unenrolls via Firebase console after the user replies from the account's verified email address. Recovery screen copy mentions this exists (contact form).

### Backend enforcement
- All 16 paid POSTs require `Authorization: Bearer <Firebase ID token>`. New file `auth.py`: `verify_id_token` (offline JWT verification), require `email_verified` or Google provider. `check_revoked=True` on the four most expensive endpoints (/generate_ai_case, /generate_ai_casewriter, /tech, /transcribe) — accepts one network lookup there.
- `firebase_admin.initialize_app` gets **explicit `projectId="publicforumai"`** (the SA situation makes inference dangerous — see Ops).
- Error contract (frontend maps these): `401 {"error":"auth_required"}`, `403 {"error":"email_unverified"}`, `429 {"error":"rate_limited","retry_after":<s>,"scope":"user"|"global"}` + `Retry-After` header, `400 {"error":"invalid_input","detail":...}`.

### Cost control (two layers — per-user limits alone are defeatable)
- **Layer 1, global daily spend ceiling (primary)**: Firestore counter of estimated cost per call (table in `limits.py`: case/casewriter $0.045, speech gen $0.005, tech $0.02, transcribe $0.01, tts $0.015, etc.), checked before every paid call. Over the ceiling (env `DAILY_BUDGET_USD`, default 20) → `429 scope:"global"`, `Retry-After` = seconds to midnight UTC. Frontend shows a "daily capacity reached" notice.
- **Layer 2, per-user limits keyed by NORMALIZED email** (gmail: strip dots, strip +suffix; others: strip +suffix) — alias-farmed accounts share one bucket. IP-keyed only where no auth exists (recovery, and nothing else). slowapi, per-endpoint buckets:
  - each of the 7 speech-generation endpoints: 8/h; /generate_ai_casewriter 10/h; /get_sources 10/h
  - /transcribe 40/h + 25 MB body cap; /tts **60/h** + 6,000-char cap (see /tts note below)
  - /tech 6/h; /lay 6/h; /processC-F 20/h each
  - accounts younger than 24h: half budgets (floor 2/h) — blunts throwaway farms under the global ceiling.
- **Worker pinning**: Heroku exports `WEB_CONCURRENCY=2` on Eco/Basic and uvicorn honors it silently → in-memory counters would double. Procfile becomes `web: uvicorn main:app --host=0.0.0.0 --port=${PORT} --workers 1`. Document: scaling workers/dynos later requires Redis-backed slowapi storage; counters reset on daily dyno cycling (acceptable; the Firestore global ceiling is durable).
- /tts frontend change: script.js currently fires **10 chunked /tts calls per Speak click** (generateDynamicChunks(text,10)); change to one call per speech (chunk only above the 6k cap), and on 429 mid-playback queue + retry after Retry-After instead of silently dropping chunks (today nulls just truncate the audio).

### Account data moves server-side
- Firestore (create database, native mode — console step) via firebase-admin only; **client Firestore access denied by rules** (deny-all).
- `users/{uid}` {gems, createdAt, emailNormalized, modulesState}, `users/{uid}/rounds/{id}`, `users/{uid}/recovery/{codeHash}`, `meta/budget/{yyyy-mm-dd}`, `users/{uid}/security` (recovery attempts/lockout).
- Endpoints: `GET /me`; `POST /rounds` / `GET /rounds` / `GET /rounds/{id}`; `POST /modules/complete` (idempotent, awards gems server-side); gems for a round awarded server-side on first successful /tech-or-/lay per roundId; `POST /profile/import` — one-time per uid migration of the localStorage `pfai_profile::<uid>` blob, validated + capped (gems ≤ 3000, rounds ≤ 50), accepted once, ever.

### Login gating + state preservation
Shared `gate.js` + `api.js` on every page:
- `api.js` `pfFetch(path, body)`: attaches `getIdToken()`, maps 401/403 → gate flow, 429 → cooldown UI (toast + disable trigger button with countdown; `scope:"global"` gets the capacity notice).
- `gate.js` `requireAuth({page, saveState})`: signed out or unverified → stash `{id: nonce, page, ts, fields}` to `localStorage["pfai_pending::<nonce>"]` (nonce in the next URL → no cross-tab collisions; stashes expire 24h, never cleared on restore), redirect to `login.html?next=<encodeURIComponent(full path+query+pending nonce)>`.
- **`next` validation algorithm** (fixes the live open redirect at login.html:59-67): `new URL(decoded, location.origin)`; require resolved origin === location.origin AND pathname ∈ page whitelist; reject values starting with `//` or `/\` or containing `\`. Query strings preserved (round params ride inside `next`). Gate-flow test must round-trip a topic containing `&` and `#`.
- Gate points (audit-verified hooks): setup.html:666 `goToLink`; Flow.html entry (script.js:62) — and the entry check validates the four round params for EVERYONE, bouncing invalid arrivals to setup.html with a message (today script.js:86 throws on missing params); every in-round paid button (gate before `getUserMedia` — audio can't survive redirect); casewriter generate (stash topic/side/skillLevel/contentions); flower record (stash topic/side/speech radio); modules keeps its existing whole-page gate (deliberate prior owner choice — flagged in Arda list) with `next` extended to carry module id + page index.
- `savedRound` gets scoped: `savedRound::<uid>::<hash(topic|side|turn)>`, restored only when it matches current query params, and captureState includes the turn-progress flags (today's single global key restores yesterday's round into a new topic and cross-tab clobbers).
- Client gates are UX; backend 401s are enforcement. Site stays browsable logged out; only actions are gated.

## 2. UI polish
### Toolbar (root cause, from audit)
(A) `#authSlot` cycles three geometries after first paint (static pill → 260×44 hydration reservation → signed-in button) because auth.js loads end-of-body; (B) every page ships its own diverged toolbar CSS copy (padding/logo/font/body-offset all differ) and styles.css's toolbar rules are loaded only by login.html, which has no toolbar.
Fix: new `toolbar.css` in `<head>` everywhere — fixed 64px bar, fixed-geometry auth slot (identical box both auth states), single `body{padding-top:64px}`, accent `#6FCBFF`, one font @700; tiny inline head script pre-renders the slot from `pfai_auth_snapshot` so the correct state paints first frame; auth.js reconciles content only, never geometry; delete all inline toolbar CSS + "FINAL OVERRIDE" stacks; relative hrefs; fix modules.html's dead `new2debate.html` link; login.html gets the toolbar too.
### Per-page fixes
All ~170 audit findings (index click-blocking `::before` overlay, 500px button phone overflow, double-scroll chevron, silent feedback form, negative-margin collisions, dueling hero rulesets, per-page dead CSS, alert()/confirm() replaced with inline UI, …). **In-round look preserved** (Flow.html/oldstyles.css computed styles kept; only functional bugs fixed there). Copy pass: no em dashes, no AI-slop phrasing.

## 3. Security hardening
- **Secrets**: keys move to env vars; `git rm --cached .env tts_key.json .vscode/launch.json` + `.gitignore` (`.gitignore` alone does NOT untrack). History stays dirty — **rotation is the real fix**; old Google SA key must be **deleted in GCP**, not just replaced. Rotation happens with Arda at deploy.
- **CORS**: `https://publicforumai.com`, `https://www.publicforumai.com`, localhost dev origins. No wildcard.
- **Input validation**: topic ≤ 500 chars, transcripts ≤ 60k, contentions int 1–4, tts ≤ 6k chars, JSON body cap 200 KB (middleware), transcribe 25 MB, graceful 400s.
- **Confirmed backend bugs fixed**: /get_sources UnboundLocalError on non-200; /tts `app.logger` AttributeError; format_debate_case impact duplication under every subpoint; `None` interpolation from missing fields; duplicate handler names; /transcribe model/language client-override pinned server-side.
- **XSS**: ~20 innerHTML sinks rendering LLM/user content (script.js, casewriter, flower, round, profile). Local sanitizer module (escape-then-format; only our own markup — `<strong>`, breaks, luna citation anchors per PROMPTS_LUNA_UPGRADE.md) routed through every sink.
- **Headers, honestly scoped**: meta CSP (first tag in `<head>`) with `script-src 'self' www.gstatic.com apis.google.com`, `connect-src` self + Heroku origin + `identitytoolkit.googleapis.com` + `securetoken.googleapis.com`, `frame-src *.firebaseapp.com apis.google.com`, `object-src 'none'`, `base-uri 'self'`; `<meta name="referrer" content="strict-origin-when-cross-origin">`. `frame-ancestors`/XFO/XCTO are NOT meta-expressible — JS framebuster on login.html is the only clickjacking mitigation available on Pages (noted for Arda: real headers need a CDN in front).
- **Misc**: dicebear external avatars → local initials avatar; deny-all Firestore rules; EmailJS stays (contact form only; public-key abuse inherent, noted for Arda); no tokens in URLs; browserLocalPersistence kept (personal-device audience) but sign-out is prominent in the toolbar menu — shared-machine caveat noted for Arda.

## 4. Ops / deploy correctness
- `runtime.txt` (python-3.10.12) **will fail the next build** — Heroku only installs the latest patch (3.10.19) and deprecated runtime.txt. Replace with `.python-version` → `3.10`. Note: 3.10 EOLs on Heroku 2026-10-31; schedule 3.11 bump.
- `requirements.txt`: prune the dead freegpt-era stack (g4f, selenium, streamlit, Js2Py, pywebview, undetected-chromedriver, browser-cookie3, etc. — Js2Py alone blocks Python 3.12); add `firebase-admin`, `slowapi`. Keep everything main.py actually imports.
- **Service account**: `tts_key.json` belongs to project `serious-app-453820-b1`, NOT `publicforumai`. Create ONE new SA in `publicforumai` (Firebase Auth admin + Firestore roles), enable the Cloud TTS API on `publicforumai`, point both TTS and firebase-admin at it (`GOOGLE_CREDENTIALS_JSON` env). Explicit projectId regardless. Delete the old SA key in GCP.
- Env vars: `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_CREDENTIALS_JSON`, `FIREBASE_WEB_API_KEY` (for the recovery signInWithPassword call), `DAILY_BUDGET_USD`, `ALLOWED_ORIGINS`.

## 5. Testing
- Backend pytest: middleware (valid/expired/unverified/absent/revoked tokens — mocked admin SDK), per-endpoint limits + young-account halving + normalized-email keying, global budget trip, recovery (happy path, wrong code, lockout after 5, code consumption, constant-error shape), input caps, bug regressions, `--workers 1` present in Procfile (guard test).
- Frontend via Chrome: toolbar height measured stable across all 9 pages × load × auth states; gate flows restore every stashed field (incl. `&`/`#` topics); signup→verify→unstick; legacy alias login + migration; 2FA enroll/challenge/recovery (needs Arda-side console setup first); responsive sweep; console-error sweep.
- Live smoke after deploy + rotation.

## Coordination
- Backend work: worktree `~/repos/DebatePF-AI-auth`, branch `feat/auth-hardening` (off main). Luna branch keeps prompt/model ownership of main.py's LLM call internals; this branch owns env vars, auth, limits, validation, bug fixes. /get_sources: gate only (retired on paid tier). /tts: caps compose with luna's tag-stripping. Merge order agreed before landing.
- Frontend: branch `feat/overhaul` in `publicforumai-web`.

## Needs Arda (none block coding)
1. Firebase console: re-enable Google provider; add publicforumai.com + www to authorized domains; upgrade to Identity Platform; enable TOTP (may require REST PATCH `admin/v2/projects/publicforumai/config?updateMask=mfa` — curl scripted in repo); **create Firestore database (native mode)**.
2. GCP: new SA in `publicforumai` (Auth admin + Firestore), enable Cloud TTS API there, download key → Heroku `GOOGLE_CREDENTIALS_JSON`; **delete** the old `serious-app-453820-b1` key.
3. Heroku: set all env vars; rotate OpenAI/Deepgram/Perplexity keys; deploy; `heroku apps:info` stack check.
4. Sign-offs: modules stay fully login-gated (your prior choice — confirm); legacy users who forgot passwords are unrecoverable (honest error shown); EmailJS contact form abuse accepted; shared-machine persistent sessions accepted.
