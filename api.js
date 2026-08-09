// api.js — single fetch path to the PublicForumAI backend.
// Attaches the Firebase ID token when signed in and maps the backend error
// contract to UI: 401/403 -> gate flow or verify notice, 429 -> cooldown or
// daily-capacity notice, network failure -> retryable toast. pfFetch resolves
// with the Response only on 2xx; every handled error throws a PfApiError.
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
      if (!opts.quiet) pfToast("Connection problem. Check your internet and try again.", { kind: "error" });
      throw PfApiError("network", 0);
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

    if (!opts.quiet) pfToast("Something went wrong on our end. Please try again.", { kind: "error" });
    throw PfApiError("http_error", response.status);
  }

  window.pfFetch = pfFetch;
  window.pfToast = pfToast;
  window.pfCooldown = pfCooldown;
})();
