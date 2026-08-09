// gate.js — login gating + pre-login state preservation.
// Depends on auth.js (ensureFirebase/onAuth). Signed-in users with a verified
// email, or any Google account, pass the gate; everyone else is sent to
// login.html with a validated-on-return "next" URL. Form state that cannot
// ride the URL is stashed under pfai_pending::<nonce> for 24 hours.
(function () {
  var PENDING_PREFIX = "pfai_pending::";
  // Long enough to sign up, receive a verification email and come back; short
  // enough that a school machine is not holding the last student's typed work
  // for the rest of the day.
  var PENDING_TTL_MS = 60 * 60 * 1000;

  function sweepPending() {
    try {
      var now = Date.now();
      var dead = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(PENDING_PREFIX) !== 0) continue;
        try {
          var entry = JSON.parse(localStorage.getItem(key));
          if (!entry || !entry.ts || now - entry.ts > PENDING_TTL_MS) dead.push(key);
        } catch (e) { dead.push(key); }
      }
      dead.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function makeNonce() {
    try {
      var bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    } catch (e) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
  }

  function isVerifiedUser(user) {
    if (!user) return false;
    if (user.emailVerified) return true;
    var providers = user.providerData || [];
    return providers.some(function (p) { return p && p.providerId === "google.com"; });
  }

  // Resolves once the initial Firebase auth state is known.
  var hydratedPromise = null;
  function hydrated() {
    if (!hydratedPromise) {
      hydratedPromise = (async function () {
        if (typeof ensureFirebase !== "function" || typeof onAuth !== "function") return;
        try { await ensureFirebase(); } catch (e) { return; }
        await new Promise(function (resolve) {
          var done = false;
          var timer = setTimeout(function () { if (!done) { done = true; resolve(); } }, 8000);
          try {
            onAuth(function () {
              if (!done) { done = true; clearTimeout(timer); resolve(); }
            });
          } catch (e) {
            if (!done) { done = true; clearTimeout(timer); resolve(); }
          }
        });
      })();
    }
    return hydratedPromise;
  }

  async function authUser() {
    await hydrated();
    try { return (window._auth && window._auth.currentUser) || null; } catch (e) { return null; }
  }

  async function isSignedInVerified() {
    return isVerifiedUser(await authUser());
  }

  // requireAuth({page, saveState, next}) -> true when the caller may proceed.
  // Otherwise stashes saveState() (if given), then redirects to login with a
  // next URL that round-trips the current page + query (plus pending nonce).
  async function requireAuth(opts) {
    opts = opts || {};
    var user = await authUser();
    if (isVerifiedUser(user)) return true;

    sweepPending();
    var target;
    try {
      target = new URL(opts.next || (location.pathname + location.search), location.href);
    } catch (e) {
      target = new URL(location.pathname, location.href);
    }

    if (opts.saveState) {
      var fields = typeof opts.saveState === "function" ? (opts.saveState() || {}) : opts.saveState;
      var nonce = makeNonce();
      try {
        localStorage.setItem(PENDING_PREFIX + nonce, JSON.stringify({
          id: nonce,
          page: opts.page || "",
          ts: Date.now(),
          fields: fields
        }));
        target.searchParams.set("pending", nonce);
      } catch (e) {}
    }

    var next = target.pathname + target.search;
    location.href = "login.html?next=" + encodeURIComponent(next);
    return false;
  }

  // Reads the pending stash named by the current URL's ?pending= nonce.
  // Returns the stashed fields, or null. Never deletes the stash; expiry
  // sweeps handle cleanup so refreshes keep working.
  function restorePending(page) {
    try {
      var nonce = new URLSearchParams(location.search).get("pending");
      if (!nonce) return null;
      var raw = localStorage.getItem(PENDING_PREFIX + nonce);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || (page && entry.page !== page)) return null;
      if (!entry.ts || Date.now() - entry.ts > PENDING_TTL_MS) return null;
      return entry.fields || null;
    } catch (e) { return null; }
  }

  sweepPending();

  window.pfGate = {
    requireAuth: requireAuth,
    restorePending: restorePending,
    isSignedInVerified: isSignedInVerified,
    isVerifiedUser: isVerifiedUser,
    authUser: authUser
  };
})();
