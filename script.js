const queryInput = document.getElementById("newsQuery");
const button = document.getElementById("validateBtn");
const resultCard = document.getElementById("resultCard");
const badge = document.getElementById("badge");
const summary = document.getElementById("summary");
const reasons = document.getElementById("reasons");
const sources = document.getElementById("sources");
const errorBox = document.getElementById("error");
const charCount = document.getElementById("charCount");
const promptButtons = document.querySelectorAll(".prompt-chip");
const themeToggle = document.getElementById("themeToggle");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const API_TIMEOUT_MS = 20000;

// ── Dark mode ──────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const isDark = theme === "dark";
  const icon = themeToggle.querySelector(".theme-toggle__icon");
  icon.innerHTML = isDark
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  themeToggle.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", isDark ? "#0a0f1e" : "#f8fafc");
  }
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

initTheme();

// ── Progress bar ────────────────────────────────────────────────────────────

const PROGRESS_FAST_THRESHOLD = 30;
const PROGRESS_SLOW_THRESHOLD = 60;
const PROGRESS_FAST_INCREMENT = 3;
const PROGRESS_MID_INCREMENT = 1.2;
const PROGRESS_SLOW_INCREMENT = 0.4;
const PROGRESS_MAX_PENDING = 85;
const PROGRESS_TICK_MS = 200;
const PROGRESS_FADE_DELAY_MS = 2500;

let _progressInterval = null;
let _progressValue = 0;

function startProgress() {
  _progressValue = 0;
  progressFill.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", "0");
  progressBar.classList.remove("hidden", "progress-bar--real", "progress-bar--dudosa", "progress-bar--falsa");

  _progressInterval = setInterval(() => {
    const increment =
      _progressValue < PROGRESS_FAST_THRESHOLD ? PROGRESS_FAST_INCREMENT :
      _progressValue < PROGRESS_SLOW_THRESHOLD ? PROGRESS_MID_INCREMENT :
      PROGRESS_SLOW_INCREMENT;
    _progressValue = Math.min(PROGRESS_MAX_PENDING, _progressValue + increment);
    progressFill.style.width = _progressValue + "%";
    progressBar.setAttribute("aria-valuenow", String(Math.round(_progressValue)));
  }, PROGRESS_TICK_MS);
}

function completeProgress(veredicto) {
  clearInterval(_progressInterval);
  _progressValue = 100;
  progressFill.style.width = "100%";
  progressBar.setAttribute("aria-valuenow", "100");

  const cls =
    veredicto === "REAL" ? "progress-bar--real" :
    veredicto === "DUDOSA" ? "progress-bar--dudosa" :
    veredicto === "FALSA" ? "progress-bar--falsa" : null;
  if (cls) progressBar.classList.add(cls);

  setTimeout(() => progressBar.classList.add("hidden"), PROGRESS_FADE_DELAY_MS);
}

function abortProgress() {
  clearInterval(_progressInterval);
  progressBar.classList.add("hidden");
}

// ── Validation ─────────────────────────────────────────────────────────────

button.addEventListener("click", async () => {
  hideError();

  const query = queryInput.value.trim();

  if (!query) {
    showError("Escribe una noticia o titular para validar.");
    queryInput.focus();
    return;
  }

  toggleLoading(true);
  startProgress();

  try {
    const aiResult = await fetchValidation(query);
    renderResult(aiResult);
  } catch (error) {
    abortProgress();
    showError(error.message || "No se pudo validar la noticia.");
  } finally {
    toggleLoading(false);
  }
});

queryInput.addEventListener("input", updateCharCount);

promptButtons.forEach((promptButton) => {
  promptButton.addEventListener("click", () => {
    queryInput.value = promptButton.dataset.prompt || "";
    updateCharCount();
    hideError();
    queryInput.focus();
  });
});

updateCharCount();

async function fetchValidation(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;

  try {
    response = await fetch("/.netlify/functions/validate-news", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La validación tardó demasiado. Intenta de nuevo.");
    }
    if (!navigator.onLine) {
      throw new Error("No hay conexión de red.");
    }
    throw new Error("No se pudo conectar con el verificador.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let data = {};

    try {
      data = await response.json();
    } catch {
      throw new Error("El verificador devolvió una respuesta inválida.");
    }

    const msg = typeof data.error === "string" ? data.error : "No se pudo validar la noticia.";
    throw new Error(msg);
  }

  return parseValidationResult(await response.json());
}

function renderResult(result) {
  completeProgress(result.veredicto);
  resultCard.classList.remove("hidden");

  const map = {
    REAL: { label: "Real", className: "real" },
    DUDOSA: { label: "Dudosa", className: "dudosa" },
    FALSA: { label: "Falsa", className: "falsa" },
  };

  const style = map[result.veredicto] || { label: "Indefinido", className: "" };

  badge.textContent = style.label;
  badge.className = `badge ${style.className}`.trim();
  summary.textContent = result.resumen;

  populateList(reasons, result.razones, "No se recibieron razones adicionales.");
  populateSources(sources, result.fuentes);

  setCredibilityField("credConfiabilidad", result.confiabilidad_fuente);
  setCredibilityField("credAutoridad", result.autoridad_fuente);
  setCredibilityField("credConsenso", result.consenso_fuentes);
  setCredibilityField("credActualidad", result.actualidad);
  setCredibilityField("credEvidencia", result.evidencia);
  setCredibilityField("credContradicciones", result.contradicciones);

  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  resultCard.focus();
}

function populateList(container, items, fallbackText) {
  container.innerHTML = "";

  const values = items.length ? items : [fallbackText];

  values.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function populateSources(container, fuentes) {
  container.innerHTML = "";

  if (!fuentes || !fuentes.length) {
    const li = document.createElement("li");
    li.textContent = "No se recibieron fuentes sugeridas.";
    container.appendChild(li);
    return;
  }

  fuentes.forEach((fuente) => {
    const li = document.createElement("li");

    if (fuente && typeof fuente === "object" && isSafeSourceUrl(fuente.url)) {
      const a = document.createElement("a");
      a.href = new URL(fuente.url).href;
      a.textContent = fuente.nombre || fuente.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "source-link";
      a.setAttribute("aria-label", `Abrir ${fuente.nombre || fuente.url} en nueva pestaña`);
      li.appendChild(a);
    } else {
      li.textContent = typeof fuente === "string" ? fuente : fuente.nombre || "";
    }

    container.appendChild(li);
  });
}

function isSafeSourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function setCredibilityField(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "Sin información disponible.";

  el.classList.remove("cred--alta", "cred--media", "cred--baja");
  const lower = (text || "").toLowerCase();
  if (/\balta\b/.test(lower)) el.classList.add("cred--alta");
  else if (/\bmedia\b/.test(lower)) el.classList.add("cred--media");
  else if (/\bbaja\b/.test(lower)) el.classList.add("cred--baja");
}

function toggleLoading(isLoading) {
  button.disabled = isLoading;
  button.setAttribute("aria-busy", isLoading);
  button.textContent = isLoading ? "Analizando noticia..." : "Validar noticia";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function updateCharCount() {
  charCount.textContent = `${queryInput.value.length} / ${queryInput.maxLength}`;
}

function parseValidationResult(parsed) {
  if (!parsed?.veredicto || !parsed?.resumen) {
    throw new Error("La respuesta del verificador está incompleta.");
  }

  return {
    veredicto: String(parsed.veredicto).toUpperCase(),
    resumen: parsed.resumen,
    razones: Array.isArray(parsed.razones) ? parsed.razones : [],
    fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [],
    confiabilidad_fuente: parsed.confiabilidad_fuente || "",
    autoridad_fuente: parsed.autoridad_fuente || "",
    consenso_fuentes: parsed.consenso_fuentes || "",
    actualidad: parsed.actualidad || "",
    evidencia: parsed.evidencia || "",
    contradicciones: parsed.contradicciones || "",
  };
}
