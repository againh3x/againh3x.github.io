// auth.js: toolbar auth state + per-user profile storage (Firebase v9 modular).
// Geometry lives in toolbar.css. This file only swaps #authSlot content; the
// inline head snippet on each page pre-paints the slot from the same snapshot
// (see REDESIGN_SNIPPETS.md; snippet markup and renderSignedIn must stay
// byte-for-byte identical in classes and structure).

// 1) Firebase config (or set window.FIREBASE_CONFIG in HTML before this <script>)
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBe3XWeTbZ0QRiG2EJsgKfLoekloSADp3o",
  authDomain: "publicforumai.com",
  projectId: "publicforumai",
  storageBucket: "publicforumai.appspot.com",
  messagingSenderId: "1077321088730",
  appId: "1:1077321088730:web:4d79890a069b28472f2fe3"
};

// 2) Utilities
const SNAP_KEY = "pfai_auth_snapshot";
const slotEl = () => document.querySelector("#authSlot, #toolbarAuth");

function readSnap(){ try{ const s=localStorage.getItem(SNAP_KEY); return s?JSON.parse(s):null; }catch{ return null; } }

// The snapshot carries plan ("free" | "premium" | "") so the first paint can
// show the right avatar ring. Firebase user objects know nothing about plans,
// so a rewrite from onAuthStateChanged preserves the stored plan for the same
// uid; api.js updates it whenever /me resolves (via pfaiUpdatePlan below).
function writeSnap(u){
  try{
    if(!u) return;
    const prev = readSnap();
    const plan = (prev && prev.uid === u.uid && prev.plan) ? prev.plan : "";
    localStorage.setItem(SNAP_KEY, JSON.stringify({
      displayName: u.displayName || "",
      email: u.email || "",
      photoURL: u.photoURL || "",
      uid: u.uid || "",
      plan: plan
    }));
  }catch{}
}
function clearSnap(){ try{ localStorage.removeItem(SNAP_KEY); }catch{} }

// Sign-out must not leave another user's cached /me behind on a shared machine.
function clearMeCache(){
  try {
    const dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("pfai_me::") === 0) dead.push(k);
    }
    dead.forEach(k => localStorage.removeItem(k));
  } catch {}
  try { document.dispatchEvent(new CustomEvent("pfai:signedout")); } catch {}
}

function usernameOf(userLike){
  return (userLike.displayName || (userLike.email ? userLike.email.split("@")[0] : "User")).trim();
}

// Design rule: initials are the first two characters of the username,
// uppercased. The head pre-paint snippet uses the identical expression.
function initialsOf(name){
  return (name || "").trim().slice(0, 2).toUpperCase() || "?";
}

// Local initials avatar: inline SVG data URI, no external requests. Kept for
// pages that show a profile tile (profile.html), not used in the toolbar.
function initialsAvatar(name){
  const text = initialsOf(name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52">' +
    '<rect width="52" height="52" rx="26" fill="#123a5e"/>' +
    '<text x="26" y="26" dy=".36em" text-anchor="middle" font-family="Archivo, Segoe UI, sans-serif" ' +
    'font-size="20" font-weight="700" fill="#6FCBFF">' + text + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
window.pfaiInitialsAvatar = initialsAvatar;

// 3) Firebase helpers (dynamic import, lightweight)
async function ensureFirebase(){
  if(!window.FIREBASE_CONFIG) return null;
  const appMod  = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
  if(!window._fb)   window._fb   = appMod.initializeApp(window.FIREBASE_CONFIG);
  if(!window._auth) window._auth = authMod.getAuth(window._fb);
  await authMod.setPersistence(window._auth, authMod.browserLocalPersistence);
  return { authMod };
}
// Waits for the app before watching it. Importing the module is not enough:
// window._auth is set by ensureFirebase, so a caller that runs before that
// finishes used to hand onAuthStateChanged an undefined auth and reject. Pages
// that call onAuth early and often, modules.html most of all, hit it every
// load, and the callback they were counting on never ran.
async function onAuth(cb){
  let fb = null;
  try { fb = await ensureFirebase(); } catch (e) { return null; }
  // No FIREBASE_CONFIG, or the SDK could not be fetched: there is no auth to
  // watch and the caller's "signed out" default is the right one.
  if (!fb || !window._auth) return null;
  return fb.authMod.onAuthStateChanged(window._auth, cb);
}

// 4) Nav helper: My Rounds always shows; signed out it points at sign-in.
function setMyRoundsLinks(signedIn){
  try {
    document.querySelectorAll('a[data-nav="myrounds"]').forEach(function (a) {
      a.setAttribute("href", signedIn ? "rounds.html" : "login.html?next=%2Frounds.html");
    });
  } catch {}
}

// 5) Renderers (content-only: both states share the fixed slot geometry)
function renderSignedOut(){
  const el = slotEl(); if(!el) return;
  document.documentElement.classList.remove("pfai-signed-in");
  setMyRoundsLinks(false);
  const next = encodeURIComponent(location.pathname + location.search);
  el.innerHTML = '<a href="login.html?next=' + next + '"><div class="button signin"><span class="title">SIGN IN</span></div></a>';
}

function renderSignedIn(userLike){
  const el = slotEl(); if(!el) return;
  document.documentElement.classList.add("pfai-signed-in");
  setMyRoundsLinks(true);

  const name = usernameOf(userLike);
  const snap = readSnap();
  const plan = userLike.plan || (snap && snap.uid === userLike.uid && snap.plan) || "free";
  const premium = plan === "premium";
  const planLabel = premium ? "Premium" : "Free plan";

  el.innerHTML =
    '<div class="user-menu-wrap">' +
      '<button id="userMenuBtn" class="pf-avatar-btn' + (premium ? " premium" : "") + '" type="button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="pf-avatar-initials"></span>' +
        (premium ? '<span class="pf-avatar-star">★</span>' : "") +
      '</button>' +
      '<div id="userMenu" class="user-menu" role="menu" aria-hidden="true">' +
        '<div class="menu-head">' +
          '<div class="menu-username"></div>' +
          '<a class="menu-plan' + (premium ? " premium" : "") + '" href="pricing.html">' +
            '<span class="plan-label"></span>' +
            '<span class="plan-action"></span>' +
          '</a>' +
        '</div>' +
        '<div class="menu-body">' +
          '<a class="menu-item" role="menuitem" href="profile.html">Profile<span class="chev">›</span></a>' +
          '<a class="menu-item" role="menuitem" href="rounds.html">My rounds<span class="chev">›</span></a>' +
          '<a class="menu-item" role="menuitem" href="modules.html">Training modules<span class="chev">›</span></a>' +
        '</div>' +
        '<div class="menu-foot">' +
          '<button id="logoutBtn" class="menu-signout" role="menuitem" type="button">Sign out</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Untrusted values (name) go in through textContent and attributes only.
  el.querySelector(".pf-avatar-initials").textContent = initialsOf(name);
  el.querySelector(".menu-username").textContent = "@" + name;
  el.querySelector(".menu-plan .plan-label").textContent = planLabel;
  el.querySelector(".menu-plan .plan-action").textContent = premium ? "Manage" : "Upgrade";

  const btn    = document.getElementById("userMenuBtn");
  const menu   = document.getElementById("userMenu");
  const logout = document.getElementById("logoutBtn");
  btn.title = name + " · " + planLabel;

  const openMenu  = () => { menu.classList.add("open");  btn.setAttribute("aria-expanded","true");  menu.setAttribute("aria-hidden","false"); };
  const closeMenu = () => { menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); menu.setAttribute("aria-hidden","true"); };

  btn.addEventListener("click", (e)=>{ e.stopPropagation(); menu.classList.contains("open") ? closeMenu() : openMenu(); });

  // renderSignedIn can run more than once (snapshot paint, Firebase
  // reconcile, plan refresh), so the document-level closers register once
  // and look the current menu up at event time.
  if (!window.__pfaiMenuDocClosers) {
    window.__pfaiMenuDocClosers = true;
    const closeCurrent = () => {
      const m = document.getElementById("userMenu");
      const b = document.getElementById("userMenuBtn");
      if (!m || !m.classList.contains("open")) return;
      m.classList.remove("open");
      m.setAttribute("aria-hidden", "true");
      if (b) b.setAttribute("aria-expanded", "false");
    };
    document.addEventListener("click", (e)=>{ const s = slotEl(); if (s && !s.contains(e.target)) closeCurrent(); });
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeCurrent(); });
  }

  // Sign out is a real sign-out, never a plain link.
  logout.onclick = async () => {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
    await signOut(window._auth);
    clearSnap();
    clearMeCache();
    renderSignedOut();
  };
}

// api.js calls this when /me resolves: store the fresh plan in the snapshot
// and repaint the slot so the ring/badge and dropdown plan row are current.
// Content-only swap; the slot geometry never changes.
window.pfaiUpdatePlan = function(plan){
  try {
    const snap = readSnap();
    if (!snap || !snap.uid) return;
    if (plan !== "free" && plan !== "premium") return;
    if (snap.plan === plan) return;
    snap.plan = plan;
    localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
    renderSignedIn(snap);
  } catch {}
};

// 6) Paint from the snapshot now, then reconcile with real Firebase state.
// The auth-hydrating class must clear on every path, including import failure.
(async function reconcileAuth(){
  document.documentElement.classList.add("auth-hydrating");
  try {
    const snap = readSnap();
    if (snap && snap.uid) renderSignedIn(snap);
    else renderSignedOut();

    if (!window.FIREBASE_CONFIG) return;
    await ensureFirebase();
    onAuth((user) => {
      if (user) { writeSnap(user); renderSignedIn(user); }
      else { clearSnap(); clearMeCache(); renderSignedOut(); }
    });
  } catch (e) {
    console.error("auth init failed", e);
  } finally {
    document.documentElement.classList.remove("auth-hydrating");
  }
})();

// 7) Profile storage: gems, rounds, module progress (localStorage, per UID)
(function(){
  function profileKey(uid){ return `pfai_profile::${uid}`; }
  function readProfile(uid){
    try {
      const raw = localStorage.getItem(profileKey(uid));
      const p = raw ? JSON.parse(raw) : {};
      return Object.assign({ gems: 0, rounds: [], modulesEarned: {} }, p || {});
    } catch { return { gems: 0, rounds: [], modulesEarned: {} }; }
  }
  function writeProfile(uid, p){
    try { localStorage.setItem(profileKey(uid), JSON.stringify(p)); } catch {}
  }

  window.currentUser = function(){
    try { return (window._auth && window._auth.currentUser) || null; } catch { return null; }
  };

  window.getProfileForUser = function(uid){ return readProfile(uid); };
  window.setProfileForUser = function(uid, p){ writeProfile(uid, p); };

  window.getGemsForUser = function(uid){ return readProfile(uid).gems || 0; };
  window.addGemsToUser = function(uid, amount){
    if (!uid || !Number.isFinite(+amount) || +amount <= 0) return;
    const p = readProfile(uid);
    p.gems = (p.gems || 0) + (+amount);
    writeProfile(uid, p);
  };

  window.getRoundsForUser = function(uid){ return readProfile(uid).rounds || []; };
  window.addRoundForUser = function(uid, round){
    const p = readProfile(uid);
    const id = round.id || `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!(p.rounds || []).some(r => r.id === id)) p.rounds = [{ ...round, id }, ...(p.rounds || [])];
    writeProfile(uid, p);
    return id;
  };
  window.deleteRoundForUser = function(uid, id){
    const p = readProfile(uid);
    p.rounds = (p.rounds || []).filter(r => r.id !== id);
    writeProfile(uid, p);
  };

  window.hasEarnedModule = function(uid, moduleId){
    if (!uid || !moduleId) return false;
    return !!(readProfile(uid).modulesEarned || {})[moduleId];
  };
  window.markModuleEarned = function(uid, moduleId){
    if (!uid || !moduleId) return;
    const p = readProfile(uid);
    p.modulesEarned = p.modulesEarned || {};
    p.modulesEarned[moduleId] = true;
    writeProfile(uid, p);
  };
})();
