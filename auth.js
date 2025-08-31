
// ─────────────────────────────────────────────────────────────────────────────
// auth.js — Flicker-free toolbar auth + styled dropdown (Firebase v9 modular)
// - Works with #authSlot or #toolbarAuth (first one found)
// - Pre-renders from localStorage (instant) and then reconciles with Firebase
// - Reserves space while hydrating to prevent layout jump
// ─────────────────────────────────────────────────────────────────────────────

// 1) Firebase config (or set window.FIREBASE_CONFIG in HTML before this <script>)
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBe3XWeTbZ0QRiG2EJsgKfLoekloSADp3o",
  authDomain: "publicforumai.firebaseapp.com",
  projectId: "publicforumai",
  storageBucket: "publicforumai.appspot.com",
  messagingSenderId: "1077321088730",
  appId: "1:1077321088730:web:4d79890a069b28472f2fe3"
};

// 2) Tiny CSS injection: dropdown styles + no-flicker reservation (does NOT alter your .button.signin)
(function injectAuthStyles() {
  if (document.getElementById("authjs-styles")) return;
  const css = `
  .user-menu-wrap{position:relative;display:inline-block}
  .user-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:2px solid var(--toolbar-accent,#7dd3fc);background:transparent;color:var(--toolbar-accent,#7dd3fc);font-weight:700;cursor:pointer;line-height:1}
  .user-btn:hover{background:rgba(125,211,252,.12)}
  .user-avatar{width:26px;height:26px;border-radius:50%;border:1px solid rgba(125,211,252,.5)}
  .user-name{white-space:nowrap}
  .user-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:190px;padding:6px;background:rgba(2,17,33,.92);border:1px solid rgba(125,211,252,.25);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:none;z-index:9999;backdrop-filter:blur(6px)}
  .user-menu.open{display:block}
  .user-menu .menu-item{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:8px;background:transparent;color:#eaffff;border:none;font-weight:700;text-decoration:none;cursor:pointer}
  .user-menu .menu-item:hover{background:rgba(125,211,252,.12);color:#7df9ff}

  /* Prevent layout shift during hydration while keeping the toolbar aligned */
  .auth-hydrating #authSlot, .auth-hydrating #toolbarAuth{
    visibility:hidden;            /* hide the transient SIGN IN or empty state */
    min-width:260px;              /* reserve width similar to @username button */
    min-height:44px;              /* reserve height similar to your buttons */
    display:inline-flex; align-items:center; justify-content:flex-end;
  }
  `;
  const tag = document.createElement("style");
  tag.id = "authjs-styles";
  tag.textContent = css;
  document.head.appendChild(tag);
})();

// 3) Utilities
const SNAP_KEY = "pfai_auth_snapshot";
const $ = (sel) => document.querySelector(sel);
const slotEl = () => document.querySelector("#authSlot, #toolbarAuth");
const avatar = (name) =>
  "https://api.dicebear.com/7.x/thumbs/svg?seed=" + encodeURIComponent(name || "User");

function readSnap(){ try{ const s=localStorage.getItem(SNAP_KEY); return s?JSON.parse(s):null; }catch{ return null; } }
function writeSnap(u){ try{ if(u) localStorage.setItem(SNAP_KEY, JSON.stringify({displayName:u.displayName||"", email:u.email||"", photoURL:u.photoURL||"", uid:u.uid||""})); }catch{} }
function clearSnap(){ try{ localStorage.removeItem(SNAP_KEY); }catch{} }

// 4) Firebase helpers (dynamic import, lightweight)
async function ensureFirebase(){
  if(!window.FIREBASE_CONFIG) return null;
  const appMod  = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
  if(!window._fb)   window._fb   = appMod.initializeApp(window.FIREBASE_CONFIG);
  if(!window._auth) window._auth = authMod.getAuth(window._fb);
  await authMod.setPersistence(window._auth, authMod.browserLocalPersistence);
  return { authMod };
}
function onAuth(cb){
  return import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js")
    .then(({ onAuthStateChanged }) => onAuthStateChanged(window._auth, cb));
}

// 5) Renderers (keeps your existing SIGN IN button styling)
function renderSignedOut(){
  const el = slotEl(); if(!el) return;
  el.innerHTML = '<a href="login.html"><div class="button signin"><span class="title">SIGN IN</span></div></a>';
  // Ensure it’s clickable even if some parent applied pointer-events accidentally
  el.style.pointerEvents = "auto";
}
function renderSignedIn(userLike){
  const el = slotEl(); if(!el) return;
  const name = (userLike.displayName || (userLike.email ? userLike.email.split("@")[0] : "User")).trim();
  const pic  = userLike.photoURL || avatar(name);

  el.innerHTML = `
    <div class="user-menu-wrap">
      <button id="userMenuBtn" class="user-btn" aria-haspopup="true" aria-expanded="false">
        <img class="user-avatar" src="${pic}" alt="${name}" />
        <span class="user-name">@${name}</span>
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div id="userMenu" class="user-menu" role="menu" aria-hidden="true">
        <a class="menu-item" role="menuitem" href="profile.html">View profile</a>
        <button id="logoutBtn" class="menu-item" role="menuitem">Log out</button>
      </div>
    </div>
  `;

  const btn    = document.getElementById("userMenuBtn");
  const menu   = document.getElementById("userMenu");
  const logout = document.getElementById("logoutBtn");

  const openMenu  = () => { menu.classList.add("open");  btn.setAttribute("aria-expanded","true");  menu.setAttribute("aria-hidden","false"); };
  const closeMenu = () => { menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); menu.setAttribute("aria-hidden","true"); };

  btn.addEventListener("click", (e)=>{ e.stopPropagation(); menu.classList.contains("open") ? closeMenu() : openMenu(); });
  document.addEventListener("click", (e)=>{ if (!el.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(); });

  logout.onclick = async () => {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
    await signOut(window._auth);
    clearSnap();
    renderSignedOut();
  };

  // Ensure interactive
  el.style.pointerEvents = "auto";
}

// 6) Hydration control: prevent flash, then remove as soon as we render something real
(function startHydration() {
  // Add the class immediately so the server/default markup doesn't flash
  document.documentElement.classList.add("auth-hydrating");

  const el = slotEl(); if (!el) { document.documentElement.classList.remove("auth-hydrating"); return; }

  // If we have a snapshot, render it NOW (no flicker), then unlock interactivity
  const snap = readSnap();
  if (snap && (snap.displayName || snap.email) && snap.uid) {
    renderSignedIn(snap);
    document.documentElement.classList.remove("auth-hydrating");
  }
})();

// 7) Reconcile with real Firebase state ASAP
document.addEventListener("DOMContentLoaded", async () => {
  // If Firebase config is missing, show SIGN IN and stop hydrating
  if (!window.FIREBASE_CONFIG) {
    if (!readSnap()) renderSignedOut();
    document.documentElement.classList.remove("auth-hydrating");
    return;
  }

  await ensureFirebase();
  onAuth((user) => {
    if (user) { writeSnap(user); renderSignedIn(user); }
    else { clearSnap(); renderSignedOut(); }
    // Whatever we showed is now final; reveal if still hidden
    document.documentElement.classList.remove("auth-hydrating");
  });
});


// ── 8) Profile storage: gems + saved rounds (localStorage, per-UID) ─────────────────
(function () {
  // Public helpers (attached to window)
  window.currentUser = function () {
    return (window._auth && window._auth.currentUser) || null;
  };

  function k(uid) { return `pfai_profile::${uid}`; }
  function read(uid) {
    try { return JSON.parse(localStorage.getItem(k(uid))) || { gems: 0, rounds: [] }; }
    catch { return { gems: 0, rounds: [] }; }
  }
  function write(uid, data) {
    try { localStorage.setItem(k(uid), JSON.stringify(data)); } catch {}
  }

  // Gems
  window.getGemsForUser = function (uid) { return read(uid).gems || 0; };
  window.addGemsToUser  = function (uid, n) {
    const p = read(uid);
    p.gems = (p.gems || 0) + (n || 0);
    write(uid, p);
    return p.gems;
  };

  // Rounds
  window.getRoundsForUser = function (uid) { return read(uid).rounds || []; };
  window.addRoundForUser  = function (uid, round) {
    const p = read(uid);
    const id = round.id || `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = { ...round, id };
    // Avoid duplicates if already saved in this session/id
    if (!(p.rounds || []).some(r => r.id === id)) p.rounds = [payload, ...(p.rounds || [])];
    write(uid, p);
    return id;
  };
  window.deleteRoundForUser = function (uid, id) {
    const p = read(uid);
    p.rounds = (p.rounds || []).filter(r => r.id !== id);
    write(uid, p);
  };
})();





// === PublicForumAI profile helpers (localStorage-based) ===
(function(){
  if (typeof window === 'undefined') return;
  function _profileKey(uid){ return `pfai_profile::${uid}`; }
  function _readProfile(uid){
    try {
      const raw = localStorage.getItem(_profileKey(uid));
      const p = raw ? JSON.parse(raw) : {};
      return Object.assign({ gems: 0, rounds: [], modulesEarned: {} }, p || {});
    } catch(_) { return { gems: 0, rounds: [], modulesEarned: {} }; }
  }
  function _writeProfile(uid, p){
    try { localStorage.setItem(_profileKey(uid), JSON.stringify(p)); } catch(_){}
  }
  window.getProfileForUser = function(uid){ return _readProfile(uid); };
  window.setProfileForUser = function(uid, p){ _writeProfile(uid, p); };
  window.addGemsToUser = function(uid, amount){
    if (!uid || !Number.isFinite(+amount) || +amount <= 0) return;
    const p = _readProfile(uid);
    p.gems = (p.gems||0) + (+amount);
    _writeProfile(uid, p);
  };
  window.hasEarnedModule = function(uid, moduleId){
    if (!uid || !moduleId) return false;
    const p = _readProfile(uid);
    const me = p.modulesEarned || {};
    return !!me[moduleId];
  };
  window.markModuleEarned = function(uid, moduleId){
    if (!uid || !moduleId) return;
    const p = _readProfile(uid);
    p.modulesEarned = p.modulesEarned || {};
    p.modulesEarned[moduleId] = true;
    _writeProfile(uid, p);
  };
  // lightweight current user accessor if auth.js has onAuth
  window.currentUser = function(){ try { return (window._auth && window._auth.currentUser) || null; } catch(_){ return null; } };
})();
