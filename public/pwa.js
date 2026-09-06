let deferredInstall = null;
const button = document.getElementById("installApp");
const SW_VER = "5.20.0";
const SHEET_KEY = "s2p-install-sheet-v1";
const APK_HREF = "/apk/stats2pitch.apk";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (button) button.hidden = false;
});

;(function setupSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
})();

const root = document.documentElement;
let scrollNavTimer = null;
const markScrolling = () => {
  root.classList.add("is-scrolling");
  clearTimeout(scrollNavTimer);
  scrollNavTimer = setTimeout(() => root.classList.remove("is-scrolling"), 450);
};
window.addEventListener("scroll", markScrolling, { passive: true });
window.addEventListener("touchmove", markScrolling, { passive: true });
window.addEventListener(
  "touchend",
  () => {
    if (!root.classList.contains("is-scrolling")) return;
    clearTimeout(scrollNavTimer);
    scrollNavTimer = setTimeout(() => root.classList.remove("is-scrolling"), 450);
  },
  { passive: true }
);

;(function addComboLinks() {
  const comboSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="M7 7h4l2 3h4M7 17h4l2-3h4"/></svg>';
  const desktop = document.querySelector(".page-tabs");
  if (desktop && !desktop.querySelector('a[href="/combo.html"]')) {
    const a = document.createElement("a");
    a.className = "page-tab";
    a.href = "/combo.html";
    a.textContent = "Combo";
    desktop.insertBefore(a, desktop.querySelector('a[href="/daily-bankers.html"]'));
  }
  const mobile = document.querySelector(".mobile-nav");
  if (!mobile) return;
  let link = mobile.querySelector('a[href="/combo.html"]');
  if (!link) {
    link = document.createElement("a");
    link.href = "/combo.html";
    link.setAttribute("aria-label", "Combo");
    link.innerHTML = comboSvg + "<span>Combo</span>";
    mobile.insertBefore(link, mobile.querySelector('a[href="/daily-bankers.html"]'));
  } else if (!link.querySelector("svg")) {
    link.insertAdjacentHTML("afterbegin", comboSvg);
  }
})();

;(function addH2HLinks() {
  const icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10M7 17h10M9 4L5 7l4 3M15 14l4 3-4 3"/></svg>';
  const desktop = document.querySelector(".page-tabs");
  if (desktop && !desktop.querySelector('a[href="/h2h.html"]')) {
    const a = document.createElement("a");
    a.className = "page-tab";
    a.href = "/h2h.html";
    a.textContent = "H2H";
    desktop.insertBefore(a, desktop.querySelector('a[href="/daily-bankers.html"]'));
  }
  const mobile = document.querySelector(".mobile-nav");
  if (mobile && !mobile.querySelector('a[href="/h2h.html"]')) {
    const a = document.createElement("a");
    a.href = "/h2h.html";
    a.innerHTML = icon + "<span>H2H</span>";
    mobile.insertBefore(a, mobile.querySelector('a[href="/daily-bankers.html"]'));
  }
})();

const nav = document.querySelector(".mobile-nav");
if (nav) {
  let sx = 0,
    sy = 0,
    moved = false;
  nav.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX;
      sy = t.clientY;
      moved = false;
    },
    { passive: true }
  );
  nav.addEventListener(
    "touchmove",
    (e) => {
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) {
        moved = true;
        markScrolling();
      }
    },
    { passive: true }
  );
  const blockNavNav = (e) => {
    if (moved || root.classList.contains("is-scrolling")) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  nav.addEventListener("click", blockNavNav, true);
  nav.addEventListener("touchend", blockNavNav, true);
}

;(function bootAuthGate() {
  if (document.querySelector("script[data-s2p-gate]")) return;
  if (!document.querySelector('link[href*="auth.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/auth.css?v=5.15.0";
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[src*="gate.js"]')) {
    const s = document.createElement("script");
    s.type = "module";
    s.src = "/gate.js?v=5.18.0";
    s.dataset.s2pGate = "1";
    document.head.appendChild(s);
  }
})();

;(function installSheet() {
  const ua = navigator.userAgent || "";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean(navigator.standalone) ||
    /Stats2PitchApp/i.test(ua);
  if (standalone) return;

  const css = `
#s2p-install-root{position:fixed;inset:0;z-index:40000;display:flex;align-items:flex-end;justify-content:center;font-family:inherit}
#s2p-install-dim{position:absolute;inset:0;background:rgba(0,0,0,.55);border:0;padding:0;cursor:pointer}
#s2p-install-sheet{position:relative;width:min(100%,430px);background:#161618;color:#f4f4f5;border-radius:28px 28px 0 0;padding:22px 20px 26px;box-shadow:0 -18px 48px rgba(0,0,0,.55);animation:s2pSheetUp .34s cubic-bezier(.2,.8,.2,1)}
#s2p-install-close{position:absolute;top:14px;right:12px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;color:#a1a1aa;display:grid;place-items:center;cursor:pointer}
#s2p-install-close:hover{background:rgba(255,255,255,.06);color:#f4f4f5}
#s2p-install-close svg{width:18px;height:18px}
.s2p-install-row{display:flex;gap:14px;align-items:flex-start;padding-right:36px}
.s2p-install-logo{width:56px;height:56px;border-radius:14px;flex:none;object-fit:cover;background:#070d0a;outline:1px solid rgba(255,255,255,.1);outline-offset:-1px}
.s2p-install-copy h2{margin:0;font-size:1.32rem;line-height:1.15;letter-spacing:-.03em;font-weight:800;color:#f4f4f5}
.s2p-install-copy p{margin:8px 0 0;font-size:.95rem;line-height:1.35;color:#a1a1aa}
.s2p-install-hint{margin:14px 0 0;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);font-size:.9rem;line-height:1.4;color:#f4f4f5}
.s2p-install-actions{display:grid;gap:10px;margin-top:18px}
.s2p-install-primary,.s2p-install-apk,.s2p-install-later{width:100%;min-height:48px;border-radius:12px;font-size:1.02rem;font-weight:800;cursor:pointer;font-family:inherit}
.s2p-install-primary{border:0;background:#c8f542;color:#0a0a0b;box-shadow:0 8px 20px rgba(200,245,66,.16)}
.s2p-install-apk{display:grid;place-items:center;text-decoration:none;border:2px solid #c8f542;background:transparent;color:#c8f542}
.s2p-install-later{border:0;background:transparent;color:#a1a1aa;font-weight:600}
@keyframes s2pSheetUp{from{transform:translateY(110%);opacity:.4}to{transform:translateY(0);opacity:1}}
@media (prefers-reduced-motion:reduce){#s2p-install-sheet{animation:none}}
`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  let rootEl = null;
  let hintEl = null;

  function dismissed() {
    try {
      return localStorage.getItem(SHEET_KEY) === "dismissed";
    } catch {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(SHEET_KEY, "dismissed");
    } catch {}
    if (button) button.hidden = false;
  }

  function closeSheet() {
    markDismissed();
    rootEl?.remove();
    rootEl = null;
  }

  async function nativeInstall() {
    if (deferredInstall) {
      deferredInstall.prompt();
      const choice = await deferredInstall.userChoice;
      deferredInstall = null;
      if (choice.outcome === "accepted") closeSheet();
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(ua);
    if (ios && hintEl) {
      hintEl.hidden = false;
      hintEl.textContent = "On iPhone: tap Share, then Add to Home Screen.";
      return;
    }
    window.location.assign(APK_HREF);
  }

  function openSheet() {
    if (rootEl) return;
    rootEl = document.createElement("div");
    rootEl.id = "s2p-install-root";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.setAttribute("aria-labelledby", "s2p-install-title");
    rootEl.innerHTML = `
      <button type="button" id="s2p-install-dim" aria-label="Dismiss install prompt"></button>
      <div id="s2p-install-sheet">
        <button type="button" id="s2p-install-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div class="s2p-install-row">
          <img class="s2p-install-logo" src="/assets/s2p-pitch-mark.png" width="56" height="56" alt="">
          <div class="s2p-install-copy">
            <h2 id="s2p-install-title">Add Stats2Pitch to Home Screen</h2>
            <p>Install Stats2Pitch as an app for quick access to smart football picks and live results.</p>
          </div>
        </div>
        <p class="s2p-install-hint" hidden></p>
        <div class="s2p-install-actions">
          <button type="button" class="s2p-install-primary">Install App</button>
          <a class="s2p-install-apk" href="${APK_HREF}" download="stats2pitch.apk">Download Android App (.apk)</a>
          <button type="button" class="s2p-install-later">Not now</button>
        </div>
      </div>`;
    document.body.appendChild(rootEl);
    hintEl = rootEl.querySelector(".s2p-install-hint");
    rootEl.querySelector("#s2p-install-dim").addEventListener("click", closeSheet);
    rootEl.querySelector("#s2p-install-close").addEventListener("click", closeSheet);
    rootEl.querySelector(".s2p-install-later").addEventListener("click", closeSheet);
    rootEl.querySelector(".s2p-install-primary").addEventListener("click", () => void nativeInstall());
  }

  function whenBooted(fn) {
    const run = () => setTimeout(fn, 360);
    if (!document.documentElement.classList.contains("s2p-booting")) {
      run();
      return;
    }
    const obs = new MutationObserver(() => {
      if (!document.documentElement.classList.contains("s2p-booting")) {
        obs.disconnect();
        run();
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    setTimeout(() => {
      obs.disconnect();
      run();
    }, 4500);
  }

  button?.addEventListener("click", async () => {
    openSheet();
  });

  whenBooted(() => {
    if (!dismissed()) openSheet();
    else if (button) button.hidden = false;
  });
})();
