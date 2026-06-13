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
const API_TIMEOUT_MS = 20000;

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
  populateList(sources, result.fuentes, "No se recibieron fuentes sugeridas.");

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

function toggleLoading(isLoading) {
  button.disabled = isLoading;
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
  };
}
