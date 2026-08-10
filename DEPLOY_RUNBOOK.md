# PublicForumAI Deploy Runbook

Everything in this file needs you (Arda) at a console. Nothing here can be done from the code side. Work top to bottom: the order matters, because rotating keys before Heroku has the new values takes the site down.

Estimated time: 45 to 60 minutes. Do it in one sitting if you can.

---

## Before you start

Two things are true right now and both are fixed by the end of this runbook:

1. **Your API keys are public.** The OpenAI, Deepgram, and Perplexity keys plus a Google service-account private key are committed in the public `DebatePF-AI` repo, including its history. Untracking them (already done in code) does not remove them from history. Rotation is the only real fix. Assume the current keys are compromised.
2. **The backend is currently open to the world.** Anyone can call your paid endpoints. That stops the moment the new backend deploys.

---

## Step 1: Firebase console (about 15 min)

Project: `publicforumai` (console.firebase.google.com)

1. **Authentication → Sign-in method → Google**: enable it. Set the support email to your own. (Google sign-in was removed at some point; the new login page needs it back.)
2. **Authentication → Settings → Authorized domains**: confirm both `publicforumai.com` and `www.publicforumai.com` are listed. Add them if not, or Google sign-in fails on the live site.
3. **Upgrade to Firebase Authentication with Identity Platform**: prompted in the Authentication section. This is required for TOTP two-factor. It is free at your scale (3,000 daily active users on the free plan) and does **not** require a billing account.
4. **Enable TOTP**: after the upgrade, look under Authentication → Sign-in method → Advanced (or Multi-factor). If the console has no TOTP toggle, run this instead (needs `gcloud auth login` first):

   ```
   curl -X PATCH \
     "https://identitytoolkit.googleapis.com/admin/v2/projects/publicforumai/config?updateMask=mfa" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "Content-Type: application/json" \
     -d '{"mfa":{"state":"ENABLED","enabledProviders":["TOTP"]}}'
   ```
5. **Firestore → Create database → Native mode**, pick a region near your users (`us-east1` is fine). This stores accounts, saved rounds, gems, recovery codes, and the daily spend counter. Without it the new account features fail.
6. **Firestore → Rules**: replace with deny-all. All access is server-side through the backend; browsers never touch Firestore directly.

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
7. **Project settings → General**: copy the **Web API key**. You need it in Step 3 as `FIREBASE_WEB_API_KEY` (this is the public web key, safe to use server-side; it is what the 2FA recovery flow calls).

---

## Step 2: Google Cloud service account (about 10 min)

The existing `tts_key.json` belongs to a **different project** (`serious-app-453820-b1`), which is why it cannot be reused: the backend needs one identity that can verify Firebase tokens, write Firestore, and call Text-to-Speech.

1. In **console.cloud.google.com**, select project **publicforumai**.
2. **APIs & Services → Enable APIs**: enable **Cloud Text-to-Speech API**.
3. **IAM & Admin → Service Accounts → Create**: name it `pfai-backend`. Grant roles:
   - Firebase Authentication Admin
   - Cloud Datastore User (this covers Firestore)
   - Cloud Text-to-Speech scopes come from the enabled API; no extra role needed.
4. **Keys → Add key → JSON**: download it. This one file is the value of `GOOGLE_CREDENTIALS_JSON` in Step 3. Keep it out of the repo.
5. **Do not delete the old key yet.** That happens in Step 5, after the new backend is confirmed working.

---

## Step 3: Heroku config (about 10 min)

App: `pf-ai-debater-24c5902c1a88`

Set every variable before deploying. The new code reads all of these:

```
heroku config:set -a pf-ai-debater-24c5902c1a88 \
  OPENAI_API_KEY="<new key from step 4>" \
  DEEPGRAM_API_KEY="<new key from step 4>" \
  PERPLEXITY_API_KEY="<new key from step 4>" \
  FIREBASE_WEB_API_KEY="<web API key from step 1.7>" \
  DAILY_BUDGET_USD="20" \
  ALLOWED_ORIGINS="https://publicforumai.com,https://www.publicforumai.com"
```

The service account JSON is one long value, so set it from the file:

```
heroku config:set -a pf-ai-debater-24c5902c1a88 \
  GOOGLE_CREDENTIALS_JSON="$(cat ~/Downloads/pfai-backend-*.json)"
```

Also run `heroku apps:info -a pf-ai-debater-24c5902c1a88` and note the stack. The old `runtime.txt` pinned a Python version Heroku can no longer install, which would have failed the next build; it is replaced with `.python-version` (3.10). Python 3.10 reaches end of life on Heroku on **2026-10-31**, so a bump to 3.11 should be scheduled before then.

`DAILY_BUDGET_USD` is the hard ceiling on all AI spending per day across every user. At 20 dollars the site serves roughly 400 case generations daily. Raise or lower it to whatever you are comfortable paying if something goes wrong.

---

## Step 4: Rotate the three API keys (about 10 min)

Do this **after** Step 3 is filled in with the new values, so there is no downtime window. For each provider: create a new key, put it in Heroku, then delete the old one.

- **OpenAI** (platform.openai.com/api-keys): the exposed key starts `sk-proj-e1re`. Create a new secret key, set it in Heroku, then revoke the old one. Check the usage dashboard for charges you do not recognize while you are there.
- **Deepgram** (console.deepgram.com): the exposed key starts `2fd6fb60`. Same sequence.
- **Perplexity** (perplexity.ai/settings/api): the exposed key starts `pplx-4b71`. Same sequence. Note this one may be retired entirely once the model-upgrade branch lands, since that work replaces Perplexity sourcing.

---

## Step 5: Deploy and verify

**Read this before you merge anything.** There is no staging environment. Merging `feat/overhaul` into the default branch of `againh3x.github.io` publishes it to publicforumai.com within about a minute, for everyone, immediately. The merge *is* the release.

The order below is not a preference. The new frontend requires the new backend and the Firebase console work from Steps 1 and 2. If it goes live first, then for every student on the site:

- Sign-in fails, because the Google provider is not enabled yet and the account system has no Firestore to write to.
- The profile page calls `/me`, which does not exist on the old backend, so it errors.
- Every gated action (starting a round, generating a speech, recording a flow) sends them to a login they cannot complete, which means the site is not degraded, it is unusable.

So: Firebase console and service account first, then Heroku config and keys, then the backend, then the frontend last.

**If something goes wrong after the frontend is live**, revert the merge commit on the default branch and push. GitHub Pages redeploys the previous site in about a minute. That is the rollback, and it is worth knowing before you need it. Note it does not undo Firebase console changes or key rotation, which are the steps to be careful with rather than the merge.

1. Deploy the backend branch `feat/auth-hardening` (after merging with the model-upgrade branch, coordinating merge order as agreed between the two sessions).
2. Watch `heroku logs -a pf-ai-debater-24c5902c1a88 --tail` through boot. You want a clean uvicorn start with no credential warnings.
3. Sanity check that auth is actually enforced. This should return 401, **not** a generated case:

   ```
   curl -s -X POST https://pf-ai-debater-24c5902c1a88.herokuapp.com/generate_ai_case \
     -H "Content-Type: application/json" \
     -d '{"debateTopic":"test","nonselectedSide":"Aff"}'
   ```
   Expected: `{"error":"auth_required"}`. If you get a debate case back, stop and tell me.
4. Deploy the frontend branch `feat/overhaul` to GitHub Pages (merge into the default branch of `againh3x.github.io`).
5. **Now delete the old service-account key** in the `serious-app-453820-b1` project, and confirm TTS still works on the live site afterward.

---

## Step 6: Live smoke test (with me)

Tell me when Steps 1 to 5 are done and I will drive your browser through the full set: Google sign-up, email sign-up with real verification, the gate flow preserving a round setup through login, 2FA enrollment, a recovery-code login, a full practice round, and rate-limit behavior. Some of this needs you to receive a real verification email and scan a real QR code, so plan to be at the keyboard.

---

## Decisions I need from you

These are judgment calls I made defaults for. Say the word if any is wrong:

1. **Training modules stay fully login-gated.** That was the existing behavior and I kept it, but it means a curious student cannot read a single lesson without an account. Making modules browsable and gating only progress-saving would lower the barrier.
2. **Legacy accounts with fake `@pf.local` emails**: users who still know their password get walked through attaching a real email. Users who forgot their password cannot be recovered (the reset email would go to an address that does not exist) and are shown an honest message telling them to make a new account.
3. **Two-factor is optional**, not forced. Students who enable it and lose both their phone and their recovery codes need you to unenroll them manually in the Firebase console after they email you from their account address.
4. **The contact form still uses EmailJS** with a public key visible in the page. That is inherent to client-side EmailJS and is abusable for spam through your form. Acceptable for now; moving it to the backend would close it.
5. **Sessions persist on shared computers.** Sign-in survives closing the browser, which is right for personal devices and wrong for school lab machines. The sign-out control is prominent in the toolbar menu.
