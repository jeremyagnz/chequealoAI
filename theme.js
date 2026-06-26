(() => {
  const STORAGE_KEY = "chequealoai_theme";
  const BTN_ID = "themeToggleBtn";

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

  function updateToggleBtn(theme) {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    if (theme === "light") {
      btn.textContent = "🌙";
      btn.setAttribute("aria-label", "Cambiar a tema oscuro");
      btn.setAttribute("title", "Cambiar a tema oscuro");
    } else {
      btn.textContent = "☀️";
      btn.setAttribute("aria-label", "Cambiar a tema claro");
      btn.setAttribute("title", "Cambiar a tema claro");
    }
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  // Apply saved/preferred theme immediately (runs before DOM paint)
  applyTheme(getPreferredTheme());

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
