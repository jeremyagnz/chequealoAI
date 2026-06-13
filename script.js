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
const API_TIMEOUT_MS = 20000;

// ── Dark mode ──────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const icon = themeToggle.querySelector(".theme-toggle__icon");
  icon.textContent = theme === "dark" ? "☀️" : "🌙";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
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

  try {
    const aiResult = await fetchValidation(query);
    renderResult(aiResult);
  } catch (error) {
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

    if (fuente && typeof fuente === "object" && fuente.url) {
      const a = document.createElement("a");
      a.href = fuente.url;
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

function setCredibilityField(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "Sin información disponible.";

  const lower = (text || "").toLowerCase();
  el.classList.remove("cred--alta", "cred--media", "cred--baja");
  if (lower.startsWith("alta")) el.classList.add("cred--alta");
  else if (lower.startsWith("media")) el.classList.add("cred--media");
  else if (lower.startsWith("baja")) el.classList.add("cred--baja");
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
