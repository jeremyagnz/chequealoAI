const queryInput = document.getElementById("newsQuery");
const button = document.getElementById("validateBtn");
const resultCard = document.getElementById("resultCard");
const badge = document.getElementById("badge");
const summary = document.getElementById("summary");
const reasons = document.getElementById("reasons");
const sources = document.getElementById("sources");
const errorBox = document.getElementById("error");
const API_TIMEOUT_MS = 20000;

button.addEventListener("click", async () => {
  hideError();

  const query = queryInput.value.trim();

  if (!query) {
    showError("Escribe una noticia o titular para validar.");
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
      body: JSON.stringify({
        query,
      }),
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
    const data = await response.json().catch(() => ({}));
    const msg = typeof data.error === "string"
      ? data.error
      : "No se pudo validar la noticia.";
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

  reasons.innerHTML = "";
  result.razones.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    reasons.appendChild(li);
  });

  sources.innerHTML = "";
  result.fuentes.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    sources.appendChild(li);
  });
}

function toggleLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Validando..." : "Validar noticia";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
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
  };
}
