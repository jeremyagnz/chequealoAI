(() => {
  const STORAGE_KEY = "chequealoai_theme";
  const BTN_ID = "themeToggleBtn";
  const GA_MEASUREMENT_ID = "";

  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  function getPreferredTheme() {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  const MOON_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const SUN_SVG  = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

  function updateToggleBtn(theme) {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    if (theme === "light") {
      btn.innerHTML = MOON_SVG;
      btn.setAttribute("aria-label", "Cambiar a tema oscuro");
      btn.setAttribute("title", "Cambiar a tema oscuro");
    } else {
      btn.innerHTML = SUN_SVG;
      btn.setAttribute("aria-label", "Cambiar a tema claro");
      btn.setAttribute("title", "Cambiar a tema claro");
    }
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function initAnalytics() {
    if (!GA_MEASUREMENT_ID) return;
    if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) return;
    if (typeof window.gtag === "function") return;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }

    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  // Apply saved/preferred theme immediately (runs before DOM paint)
  applyTheme(getPreferredTheme());
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAnalytics, { once: true });
  } else {
    initAnalytics();
  }

  // Wire up the toggle button once DOM is ready
  function wireButton() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const theme = getCurrentTheme();
    updateToggleBtn(theme);
    btn.addEventListener("click", () => {
      const next = getCurrentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      setStoredTheme(next);
      updateToggleBtn(next);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButton);
  } else {
    wireButton();
  }
})();
