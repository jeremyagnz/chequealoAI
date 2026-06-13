const apiKeyInput = document.getElementById("apiKey");
const queryInput = document.getElementById("newsQuery");
const button = document.getElementById("validateBtn");
const resultCard = document.getElementById("resultCard");
const badge = document.getElementById("badge");
const summary = document.getElementById("summary");
const reasons = document.getElementById("reasons");
const sources = document.getElementById("sources");
const errorBox = document.getElementById("error");

const promptRules = `
Eres un verificador de noticias de República Dominicana.
Analiza la consulta del usuario y responde SOLO en JSON con esta forma exacta:
{
  "veredicto": "REAL|DUDOSA|FALSA",
  "resumen": "texto breve en español",
  "razones": ["razón 1", "razón 2"],
  "fuentes": ["medio o entidad oficial 1", "medio o entidad oficial 2"]
}
Criterios:
- Evalúa si la noticia parece existir y si es verídica según conocimiento disponible.
- Si no hay evidencia suficiente, usa DUDOSA.
- Prioriza fuentes confiables de RD (Listín Diario, Diario Libre, El Caribe, Presidencia, JCE, Banco Central, etc.).
- Nunca salgas del formato JSON.
`;

button.addEventListener("click", async () => {
  hideError();

  const apiKey = apiKeyInput.value.trim();
  const query = queryInput.value.trim();

  if (!apiKey) {
    showError("Debes ingresar tu OpenAI API Key.");
    return;
  }

  if (!query) {
    showError("Escribe una noticia o titular para validar.");
    return;
  }

  toggleLoading(true);

  try {
    const aiResult = await fetchValidation(apiKey, query);
    renderResult(aiResult);
  } catch (error) {
    showError(error.message || "No se pudo validar la noticia.");
  } finally {
    toggleLoading(false);
  }
});

async function fetchValidation(apiKey, query) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: promptRules },
        { role: "user", content: `Noticia a validar: ${query}` },
      ],
    }),
  });

  if (!response.ok) {
    const msg = response.status === 401
      ? "API Key inválida o sin permisos."
      : "Error de conexión con OpenAI.";
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("Respuesta vacía del modelo.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("La respuesta no vino en formato JSON válido.");
  }

  if (!parsed.veredicto || !parsed.resumen) {
    throw new Error("La respuesta del modelo está incompleta.");
  }

  return {
    veredicto: String(parsed.veredicto).toUpperCase(),
    resumen: parsed.resumen,
    razones: Array.isArray(parsed.razones) ? parsed.razones : [],
    fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [],
  };
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
