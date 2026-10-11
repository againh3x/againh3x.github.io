// api.js: single fetch path to the PublicForumAI backend.
// Attaches the Firebase ID token when signed in and maps the backend error
// contract to UI: 401/403 -> gate flow or verify notice, 402 -> plan upsell
// or quota notice, 429 -> cooldown or daily-capacity notice, network failure
// -> retryable toast. pfFetch resolves with the Response only on 2xx; every
// handled error throws a PfApiError. Also exports pfMe (cached /me), the
// draft-round helpers, and the shared pfUpsell modal.
(function () {
  var DEFAULT_BASE = "https://pf-ai-debater-24c5902c1a88.herokuapp.com";

  // Every pfFetch carries the caller's Firebase ID token, so the base URL is
  // not something a stray localStorage write gets to choose: the dev override
  // is honoured only when the page itself is running on a loopback host, and
  // only when it points at a loopback host.
  function isLoopback(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" ||
      hostname === "::1" || /\.localhost$/.test(hostname);
  }

  function apiBase() {
    try {
      if (!isLoopback(location.hostname)) return DEFAULT_BASE;
      var override = localStorage.getItem("pfai_api_base");
      if (!override) return DEFAULT_BASE;
      var url = new URL(override);
      if (!isLoopback(url.hostname)) return DEFAULT_BASE;
      return url.origin;
    } catch (e) { return DEFAULT_BASE; }
  }

  function PfApiError(code, status, extra) {
    var err = new Error(code);
    err.name = "PfApiError";
    err.code = code;
    err.status = status;
    if (extra) Object.assign(err, extra);
    return err;
  }

  // ---- toast UI -------------------------------------------------------------
  function toastHost() {
    var host = document.getElementById("pfai-toasts");
    if (host) return host;
    var style = document.createElement("style");
    style.textContent =
      "#pfai-toasts{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}" +
      ".pfai-toast{max-width:min(480px,90vw);padding:12px 18px;border-radius:10px;" +
      "background:#0d2438;color:#eaffff;border:1px solid rgba(111,203,255,.5);" +
      "box-shadow:0 6px 20px rgba(0,0,0,.4);font:600 14px/1.4 'Segoe UI',sans-serif;" +
      "pointer-events:auto;opacity:0;transition:opacity .2s}" +
      ".pfai-toast.show{opacity:1}" +
      ".pfai-toast.error{border-color:rgba(255,120,120,.6)}";
    document.head.appendChild(style);
    host = document.createElement("div");
    host.id = "pfai-toasts";
    document.body.appendChild(host);
    return host;
  }

  function pfToast(message, opts) {
    opts = opts || {};
    try {
      var el = document.createElement("div");
      el.className = "pfai-toast" + (opts.kind === "error" ? " error" : "");
      el.textContent = message;
      toastHost().appendChild(el);
      requestAnimationFrame(function () { el.classList.add("show"); });
      var ms = opts.duration || 6000;
      setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { el.remove(); }, 300);
      }, ms);
    } catch (e) {}
  }

  // ---- cooldown -------------------------------------------------------------
  function fmtSeconds(total) {
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function pfCooldown(button, seconds, restoreLabel) {
    if (!button || button.dataset.pfCooldown) return;
    var label = restoreLabel || button.textContent;
    button.dataset.pfCooldown = "1";
    button.disabled = true;
    var end = Date.now() + seconds * 1000;
    (function tick() {
      var left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) {
        button.disabled = false;
        button.textContent = label;
        delete button.dataset.pfCooldown;
        return;
      }
      button.textContent = fmtSeconds(left);
      setTimeout(tick, 1000);
    })();
  }

  // ---- auth token -----------------------------------------------------------
  async function getAuthToken() {
    try {
      var user = null;
      if (window.pfGate && typeof pfGate.authUser === "function") {
        user = await pfGate.authUser();
      } else if (window._auth) {
        user = window._auth.currentUser;
      }
      return user ? await user.getIdToken() : null;
    } catch (e) { return null; }
  }

  // ---- pfFetch --------------------------------------------------------------
  // pfFetch(path, {json: obj} | {formData: fd}, opts)
  //   opts.method    HTTP method, default POST (profile/round use GET reads)
  //   opts.page      page name passed to the gate on 401/403
  //   opts.saveState state stasher passed to the gate on 401/403
  //   opts.button    button to disable with a countdown on 429
  //   opts.label     label to restore on that button after the countdown
  //   opts.retry429  throw a silent rate_limited error (scope user) so the
  //                  caller can wait retryAfter seconds and retry itself
  //   opts.quiet     skip the generic server-error toast. For background work
  //                  the user did not ask for, where the page already has a
  //                  local copy of whatever failed to send. Auth, verification
  //                  and rate-limit toasts still fire: those need answering.
  async function pfFetch(path, body, opts) {
    opts = opts || {};
    var headers = {};
    var fetchBody;
    if (body && body.formData) {
      fetchBody = body.formData;
    } else if (body && body.json !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body.json);
    }

    var token = await getAuthToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    var response;
    try {
      response = await fetch(apiBase() + path, { method: opts.method || "POST", headers: headers, body: fetchBody });
    } catch (e) {
      if (!opts.quiet && !opts.recoverable) pfToast("Connection problem. Check your internet and try again.", { kind: "error" });
      throw PfApiError("network", 0);
    }

    // Streamed routes (the Luna speech, flow and judge calls) send a 200 at
    // once and keep the connection open with spaces until the JSON is ready,
    // because a sourced speech outlasts Heroku's 30 second first-byte cutoff.
    // A failure after that 200 can only travel in the body, as
    // {"error": ..., "status": n}, so it is unpacked here into the response it
    // stands for and goes through the same handling as any other error. The
    // request is over either way: streamedFailure keeps it out of the timeout
    // recovery, which would otherwise wait minutes for a result that is not
    // coming. A body that does not parse means the connection dropped
    // mid-stream, and that one may still finish on the server.
    var streamedFailure = false;
    if (response.ok && response.headers.get("X-PF-Stream") === "1") {
      var streamedText;
      try { streamedText = await response.text(); } catch (e) { streamedText = null; }
      var streamed = null;
      try { streamed = JSON.parse(streamedText); } catch (e) {}
      if (!streamed || typeof streamed !== "object") {
        if (!opts.quiet && !opts.recoverable) pfToast("Connection problem. Check your internet and try again.", { kind: "error" });
        throw PfApiError("network", 0);
      }
      var jsonHeaders = { "Content-Type": "application/json" };
      if (typeof streamed.error === "string") {
        var inBandStatus = Number(streamed.status);
        if (!(inBandStatus >= 400 && inBandStatus <= 599)) inBandStatus = 502;
        response = new Response(streamedText, { status: inBandStatus, headers: jsonHeaders });
        streamedFailure = true;
      } else {
        return new Response(streamedText, { status: 200, headers: jsonHeaders });
      }
    }

    if (response.ok) return response;

    var payload = null;
    try { payload = await response.clone().json(); } catch (e) {}
    var code = payload && payload.error;

    if (response.status === 401 || (response.status === 403 && code === "auth_required")) {
      if (window.pfGate) pfGate.requireAuth({ page: opts.page, saveState: opts.saveState });
      throw PfApiError("auth_required", response.status);
    }

    if (response.status === 403 && code === "email_unverified") {
      pfToast("Please verify your email first. Open the link we sent you, then try again.", { kind: "error", duration: 9000 });
      throw PfApiError("email_unverified", 403);
    }

    // Plan gates. The backend uses 402 so the existing 403 auth branches stay
    // untouched; the plan_required check also accepts 403 defensively.
    if ((response.status === 402 || response.status === 403) && code === "plan_required") {
      if (!opts.noUpsell) pfUpsell(payload && payload.feature);
      throw PfApiError("plan_required", response.status, { feature: payload && payload.feature });
    }

    if (response.status === 402 && code === "quota_exhausted") {
      var scope402 = (payload && payload.scope) === "cases" ? "cases" : "rounds";
      if (!opts.noUpsell) pfUpsell("quota_" + scope402, { resetAt: payload && payload.resetAt });
      throw PfApiError("quota_exhausted", 402, { scope: scope402, resetAt: payload && payload.resetAt });
    }

    if (response.status === 429) {
      var retryAfter = Number(payload && payload.retry_after);
      if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
        retryAfter = Number(response.headers.get("Retry-After")) || 60;
      }
      retryAfter = Math.ceil(retryAfter);
      var scope = (payload && payload.scope) || "user";
      if (scope === "global") {
        pfToast("Daily capacity reached. The site has used its AI budget for today, so this will work again tomorrow.", { kind: "error", duration: 10000 });
        throw PfApiError("rate_limited", 429, { retryAfter: retryAfter, scope: scope });
      }
      if (opts.retry429) {
        throw PfApiError("rate_limited", 429, { retryAfter: retryAfter, scope: scope, silent: true });
      }
      pfToast("You are going a bit fast. Try again in " + fmtSeconds(retryAfter) + ".", { kind: "error", duration: 8000 });
      pfCooldown(opts.button, retryAfter, opts.label);
      throw PfApiError("rate_limited", 429, { retryAfter: retryAfter, scope: scope });
    }

    // opts.recoverable: the caller handles gateway failures itself, by going
    // and fetching the result the dyno finished after the router hung up. Only
    // those statuses are silenced here; a 500 or a 4xx still toasts, because
    // there is nothing on the server to go and collect.
    var gatewayGaveUp = !streamedFailure &&
      (response.status === 502 || response.status === 503 || response.status === 504);
    if (!opts.quiet && !(opts.recoverable && gatewayGaveUp)) {
      pfToast("Something went wrong on our end. Please try again.", { kind: "error" });
    }
    throw PfApiError("http_error", response.status, streamedFailure ? { final: true } : null);
  }

  // ---- upsell modal ---------------------------------------------------------
  // pfUpsell(feature) shows the shared Premium modal (styles in pf-theme.css,
  // shell copied from the Practice Round design). Copy titles and bodies for
  // speak/redo come verbatim from the design; the rest follow the README's
  // gated-feature list. All dynamic values go in through textContent.
  var UPSELL_COPY = {
    speak: {
      title: "Hearing the AI speak is Premium",
      body: "Premium reads every AI speech aloud so you can flow it in real time, the way you would in a real round."
    },
    redo: {
      title: "Redoing a speech is Premium",
      body: "On the free plan each speech is flowed once, the way a real round works. Premium lets you re-record and regenerate any speech as many times as you want."
    },
    contentions: {
      title: "Choosing the contention count is Premium",
      body: "Free plan cases use 2 contentions. Premium lets you change this."
    },
    real_evidence: {
      title: "Real sources are Premium",
      body: "Evidence in free rounds is simulated: the citations look realistic, but they are made up. Premium can use real linked sources you can check."
    },
    rounds: {
      title: "Unlimited rounds are Premium",
      body: "The free plan includes 3 practice rounds a month. Premium removes the cap."
    },
    cases: {
      title: "Unlimited cases are Premium",
      body: "The free plan includes 5 cases a month. Premium removes the cap."
    },
    quota_rounds: {
      title: "You have used your 3 free rounds this month",
      body: "Rounds you start count toward this, finished or not. Premium removes the cap."
    },
    quota_cases: {
      title: "You have used your 5 free cases this month",
      body: "Premium removes the cap and lets you generate as many cases as you want."
    }
  };

  function fmtResetDate(resetAt) {
    var secs = Number(resetAt);
    if (!Number.isFinite(secs) || secs <= 0) return "";
    try {
      return new Date(secs * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return ""; }
  }

  function pfUpsell(feature, opts) {
    opts = opts || {};
    try {
      var existing = document.getElementById("pfai-upsell");
      if (existing) existing.remove();

      var copy = UPSELL_COPY[feature] || {
        title: "This is a Premium feature",
        body: "Premium removes the free plan's limits."
      };

      var backdrop = document.createElement("div");
      backdrop.id = "pfai-upsell";
      backdrop.className = "pf-modal-backdrop";

      var modal = document.createElement("div");
      modal.className = "pf-modal pf-upsell";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "pfai-upsell-title");

      var icon = document.createElement("div");
      icon.className = "pf-upsell-icon";
      // Static padlock SVG, no dynamic content.
      icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

      var title = document.createElement("h2");
      title.className = "pf-upsell-title";
      title.id = "pfai-upsell-title";
      title.textContent = copy.title;

      var body = document.createElement("p");
      body.className = "pf-upsell-body";
      var bodyText = copy.body;
      var resetDate = fmtResetDate(opts.resetAt);
      if (resetDate) bodyText += " Your free quota resets on " + resetDate + ".";
      body.textContent = bodyText;

      var actions = document.createElement("div");
      actions.className = "pf-upsell-actions";

      var dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "pf-btn-ghost";
      dismiss.textContent = "Not now";

      var cta = document.createElement("a");
      cta.className = "pf-btn-primary";
      cta.href = "pricing.html";
      cta.textContent = "See Premium";

      actions.appendChild(dismiss);
      actions.appendChild(cta);
      modal.appendChild(icon);
      modal.appendChild(title);
      modal.appendChild(body);
      modal.appendChild(actions);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      function close() {
        backdrop.remove();
        document.removeEventListener("keydown", onKey);
      }
      function onKey(e) { if (e.key === "Escape") close(); }
      dismiss.addEventListener("click", close);
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      document.addEventListener("keydown", onKey);
      dismiss.focus();
    } catch (e) {}
  }

  // ---- /me cache --------------------------------------------------------------
  // pfMe() resolves the current user's /me JSON (plan, usage, limits, gems...).
  // Cached in memory and localStorage (pfai_me::<uid>) for 5 minutes; cleared
  // on sign-out by auth.js (which removes pfai_me:: keys and fires
  // pfai:signedout). pfMe({fresh:true}) bypasses the cache. Resolves null when
  // signed out. On success the plan lands in the auth snapshot via
  // pfaiUpdatePlan, which repaints the header slot, and a pfai:me event fires
  // for quota meters.
  var ME_TTL_MS = 5 * 60 * 1000;
  var mePromise = null, meAt = 0, meUid = null;

  function currentUid() {
    try {
      if (window._auth && window._auth.currentUser) return window._auth.currentUser.uid;
    } catch (e) {}
    try {
      var snap = JSON.parse(localStorage.getItem("pfai_auth_snapshot"));
      return (snap && snap.uid) || null;
    } catch (e) { return null; }
  }

  function meStorageKey(uid) { return "pfai_me::" + uid; }

  function meInvalidate() {
    // The localStorage copy must go too: in-memory state does not survive the
    // navigation that usually follows an invalidation (start round -> Flow).
    try { if (meUid) localStorage.removeItem(meStorageKey(meUid)); } catch (e) {}
    mePromise = null; meAt = 0; meUid = null;
  }
  document.addEventListener("pfai:signedout", meInvalidate);

  function announceMe(me) {
    try { if (me && window.pfaiUpdatePlan) pfaiUpdatePlan(me.plan === "premium" ? "premium" : "free"); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent("pfai:me", { detail: me })); } catch (e) {}
  }

  async function pfMe(opts) {
    opts = opts || {};
    var uid = currentUid();
    if (!uid) return null;

    var now = Date.now();
    if (!opts.fresh) {
      if (mePromise && meUid === uid && now - meAt < ME_TTL_MS) return mePromise;
      try {
        var cached = JSON.parse(localStorage.getItem(meStorageKey(uid)));
        if (cached && cached.at && now - cached.at < ME_TTL_MS && cached.me) {
          meUid = uid; meAt = cached.at; mePromise = Promise.resolve(cached.me);
          return mePromise;
        }
      } catch (e) {}
    }

    meUid = uid;
    meAt = now;
    mePromise = (async function () {
      var response = await pfFetch("/me", null, { method: "GET", quiet: true });
      var me = await response.json();
      try { localStorage.setItem(meStorageKey(uid), JSON.stringify({ at: Date.now(), me: me })); } catch (e) {}
      announceMe(me);
      return me;
    })();
    mePromise.catch(function () { if (meUid === uid) meInvalidate(); });
    return mePromise;
  }

  // ---- draft rounds -------------------------------------------------------------
  // Thin wrappers over the contract endpoints. pfFetch defaults to POST, so
  // every read/update passes an explicit method. Callers may pass pfFetch opts
  // (page, saveState, quiet, button, label) as the last argument.
  function pfRoundStart(data, opts) {
    return pfFetch("/rounds/start", { json: data }, opts).then(function (r) {
      meInvalidate(); // the monthly round quota just moved
      return r.json();
    });
  }
  function pfRoundPatch(id, patch, opts) {
    return pfFetch("/rounds/" + encodeURIComponent(id), { json: patch }, Object.assign({ method: "PATCH" }, opts))
      .then(function (r) { return r.json(); });
  }
  function pfRoundDelete(id, opts) {
    return pfFetch("/rounds/" + encodeURIComponent(id), null, Object.assign({ method: "DELETE" }, opts));
  }
  function pfRounds(opts) {
    return pfFetch("/rounds", null, Object.assign({ method: "GET" }, opts)).then(function (r) { return r.json(); });
  }
  function pfRound(id, opts) {
    return pfFetch("/rounds/" + encodeURIComponent(id), null, Object.assign({ method: "GET" }, opts))
      .then(function (r) { return r.json(); });
  }

  // ---- recovering a speech the gateway timed out on -------------------------
  // Heroku's router abandons a request after 30 seconds, but the dyno does not:
  // it runs the generation to completion and still writes the result into the
  // draft round. So a timeout is not lost work, it is an answer this browser
  // was never handed. Measured on the real stack (uvicorn 0.29 / starlette
  // 0.35, body-cap middleware and CORS in place): a client hangup mid-request
  // does not cancel the handler, and the write lands on schedule.
  //
  // Each poll doubles as the wait. The dyno makes one blocking provider call at
  // a time, so GET /rounds/{id} queues behind the generation still running and
  // answers the instant it finishes; a poll that times out has simply spent 30
  // seconds waiting. Hence a short pause between attempts rather than a long
  // one, and a wall-clock deadline rather than an attempt count.
  //
  // pfRecoverRound(id, isReady) resolves with the round once isReady(doc) holds,
  // or null if the deadline passes, the round is gone, or the session ended.
  function pfSleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Errors that mean "the server may still be working on it". A 500 is excluded
  // on purpose: our handler raised, so it never reached the line that persists.
  function pfMayStillBeRunning(err) {
    if (!err || err.final) return false;
    if (err.code === "network") return true;
    return err.code === "http_error" && (err.status === 502 || err.status === 503 || err.status === 504);
  }

  async function pfRecoverRound(id, isReady, opts) {
    opts = opts || {};
    var deadline = Date.now() + (opts.timeoutMs || 150000);
    var attempt = 0;
    while (Date.now() < deadline) {
      if (opts.onWait) { try { opts.onWait(attempt); } catch (e) {} }
      attempt++;
      try {
        var doc = await pfRound(id, { quiet: true, noUpsell: true, page: opts.page });
        if (doc && isReady(doc)) return doc;
      } catch (e) {
        // A dead session or a round that no longer exists will not improve by
        // asking again. Anything else is the gateway, so keep waiting.
        if (e && (e.code === "auth_required" || e.code === "email_unverified")) return null;
        if (e && e.status === 404) return null;
      }
      await pfSleep(2500);
    }
    return null;
  }

  // ---- billing ---------------------------------------------------------------
  // Both calls hand back a Stripe-hosted URL and the page navigates there. The
  // plan never changes here: only the server's webhook writes it, and the
  // pricing page polls /me after Checkout returns.
  var BILLING_ERRORS = {
    billing_unconfigured: "Checkout is not open yet. Email support@publicforumai.com and we will set you up.",
    billing_unavailable: "Stripe did not answer just now. Please try again in a minute.",
    no_billing_account: "There is no billing account on file for this login yet."
  };

  async function pfBillingRedirect(path, json, button) {
    var label = button ? button.textContent : "";
    if (button) { button.disabled = true; button.textContent = "Loading..."; }
    try {
      var response = await pfFetch(path, json ? { json: json } : { json: {} },
        { page: "Pricing", quiet: true, button: button, label: label });
      var body = await response.json();
      if (!body || typeof body.url !== "string" || body.url.indexOf("https://") !== 0) {
        throw PfApiError("http_error", 500);
      }
      location.assign(body.url);
      return true;
    } catch (e) {
      if (button) { button.disabled = false; button.textContent = label; }
      var code = e && e.code;
      if (code === "auth_required" || code === "email_unverified" || code === "rate_limited") throw e;
      if (e && e.status === 409) {
        // Already premium: the caller refreshes /me and repaints.
        throw e;
      }
      // pfFetch reports the status, not the body, so the status picks the copy.
      var message = e && e.status === 503 ? BILLING_ERRORS.billing_unconfigured
        : e && e.status === 404 ? BILLING_ERRORS.no_billing_account
        : e && e.code === "network" ? "Connection problem. Check your internet and try again."
        : BILLING_ERRORS.billing_unavailable;
      pfToast(message, { kind: "error", duration: 9000 });
      throw e;
    }
  }

  function pfBillingCheckout(interval, button) {
    return pfBillingRedirect("/billing/checkout", { interval: interval === "year" ? "year" : "month" }, button);
  }

  function pfBillingPortal(button) {
    return pfBillingRedirect("/billing/portal", null, button);
  }

  window.pfFetch = pfFetch;
  window.pfToast = pfToast;
  window.pfCooldown = pfCooldown;
  window.pfUpsell = pfUpsell;
  window.pfMe = pfMe;
  window.pfMeInvalidate = meInvalidate;
  window.pfRoundStart = pfRoundStart;
  window.pfRoundPatch = pfRoundPatch;
  window.pfRoundDelete = pfRoundDelete;
  window.pfRounds = pfRounds;
  window.pfRound = pfRound;
  window.pfBillingCheckout = pfBillingCheckout;
  window.pfBillingPortal = pfBillingPortal;
  window.pfRecoverRound = pfRecoverRound;
  window.pfMayStillBeRunning = pfMayStillBeRunning;
})();
