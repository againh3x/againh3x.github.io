
// ─────────────────────────────────────────────────────────────────────────────
// auth.js — toolbar auth state + per-user profile storage (Firebase v9 modular)
// Geometry lives in toolbar.css. This file only swaps #authSlot content; the
// inline head snippet on each page pre-paints the slot from the same snapshot.
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

// 2) Utilities
const SNAP_KEY = "pfai_auth_snapshot";
const slotEl = () => document.querySelector("#authSlot, #toolbarAuth");

function readSnap(){ try{ const s=localStorage.getItem(SNAP_KEY); return s?JSON.parse(s):null; }catch{ return null; } }
function writeSnap(u){ try{ if(u) localStorage.setItem(SNAP_KEY, JSON.stringify({displayName:u.displayName||"", email:u.email||"", photoURL:u.photoURL||"", uid:u.uid||""})); }catch{} }
function clearSnap(){ try{ localStorage.removeItem(SNAP_KEY); }catch{} }

function initialsOf(name){
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return initials || "?";
}

// Local initials avatar: inline SVG data URI, no external requests.
function initialsAvatar(name){
  const text = initialsOf(name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52">' +
    '<rect width="52" height="52" rx="26" fill="#123a5e"/>' +
    '<text x="26" y="26" dy=".36em" text-anchor="middle" font-family="Segoe UI, sans-serif" ' +
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
function onAuth(cb){
  return import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js")
    .then(({ onAuthStateChanged }) => onAuthStateChanged(window._auth, cb));
}

// 4) Renderers (content-only: both states share the fixed slot geometry)
function renderSignedOut(){
  const el = slotEl(); if(!el) return;
  document.documentElement.classList.remove("pfai-signed-in");
  const next = encodeURIComponent(location.pathname + location.search);
  el.innerHTML = '<a href="login.html?next=' + next + '"><div class="button signin"><span class="title">SIGN IN</span></div></a>';
}

function renderSignedIn(userLike){
  const el = slotEl(); if(!el) return;
  document.documentElement.classList.add("pfai-signed-in");
  const name = (userLike.displayName || (userLike.email ? userLike.email.split("@")[0] : "User")).trim();
  const pic  = userLike.photoURL || initialsAvatar(name);

  el.innerHTML = `
    <div class="user-menu-wrap">
      <button id="userMenuBtn" class="user-btn" type="button" aria-haspopup="true" aria-expanded="false">
        <img class="user-avatar" alt="" />
        <span class="user-name"></span>
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div id="userMenu" class="user-menu" role="menu" aria-hidden="true">
        <a class="menu-item" role="menuitem" href="profile.html">View profile</a>
        <button id="logoutBtn" class="menu-item" role="menuitem" type="button">Log out</button>
      </div>
    </div>
  `;
  // A blocked or dead photo URL (CSP, deleted Google avatar) falls back to the
  // locally drawn initials rather than a broken-image icon.
  const avatarEl = el.querySelector(".user-avatar");
  avatarEl.onerror = function () { avatarEl.onerror = null; avatarEl.src = initialsAvatar(name); };
  avatarEl.src = pic;
  el.querySelector(".user-name").textContent = "@" + name;

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
}

// 5) Paint from the snapshot now, then reconcile with real Firebase state.
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
      else { clearSnap(); renderSignedOut(); }
    });
  } catch (e) {
    console.error("auth init failed", e);
  } finally {
    document.documentElement.classList.remove("auth-hydrating");
  }
})();

// 6) Profile storage: gems, rounds, module progress (localStorage, per UID)
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
