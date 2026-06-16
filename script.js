const queryInput = document.getElementById("newsQuery");
const validateBtn = document.getElementById("validateBtn");
const resultSection = document.getElementById("resultSection");
const resultCard = document.getElementById("resultCard");
const errorMsg = document.getElementById("error");
const API_TIMEOUT_MS = 20000;

// ---- Validation trigger ----

validateBtn.addEventListener("click", runValidation);
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runValidation();
});

async function runValidation() {
  if (validateBtn.disabled) return;
  hideError();
  const query = queryInput.value.trim();
  if (!query) {
    showError("Escribe una noticia o titular para validar.");
    return;
  }
  setLoading(true);
  try {
    const result = await fetchValidation(query);
    renderResult(result, query);
  } catch (err) {
    showError(err.message || "No se pudo validar la noticia.");
  } finally {
    setLoading(false);
  }
}

// ---- API ----

async function fetchValidation(query) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch("/.netlify/functions/validate-news", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La validación tardó demasiado. Intenta de nuevo.");
    }
    if (!navigator.onLine) throw new Error("No hay conexión de red.");
    throw new Error("No se pudo conectar con el verificador.");
  } finally {
    clearTimeout(tid);
  }

  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch { /* ignore */ }
    const msg = typeof data.error === "string" ? data.error : "No se pudo validar la noticia.";
    throw new Error(msg);
  }

  return parseResult(await response.json());
}

function parseResult(data) {
  if (!data?.veredicto || !data?.resumen) {
    throw new Error("La respuesta del verificador está incompleta.");
  }
  const veredicto = String(data.veredicto).toUpperCase();
  const puntuacion = typeof data.puntuacion === "number"
    ? data.puntuacion
    : estimateScore(veredicto);
  const metricas = data.metricas && typeof data.metricas === "object"
    ? data.metricas
    : estimateMetricas(puntuacion);
  return {
    veredicto,
    puntuacion,
    resumen: data.resumen,
    razones: Array.isArray(data.razones) ? data.razones : [],
    fuentes: Array.isArray(data.fuentes) ? data.fuentes : [],
    metricas,
  };
}

function estimateScore(veredicto) {
  // "REAL" kept as fallback for any cached/older API responses
  if (veredicto === "CONFIABLE" || veredicto === "REAL") return 78;
  if (veredicto === "DUDOSA") return 48;
  return 18;
}

function estimateMetricas(score) {
  return {
    autoridad_fuente: Math.min(100, score + 12),
    evidencia_encontrada: Math.min(100, score + 8),
    consenso_fuentes: Math.min(100, score + 5),
    actualidad: Math.max(0, score - 2),
    sin_contradicciones: Math.max(0, score - 10),
  };
}

// ---- Render live result ----

function renderResult(result, query) {
  resultCard.innerHTML = buildAnalysisCard({
    claim: query,
    score: result.puntuacion,
    veredicto: result.veredicto,
    metricas: result.metricas,
    razones: result.razones,
    fuentes: result.fuentes,
  });
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setLoading(on) {
  validateBtn.disabled = on;
  const span = validateBtn.querySelector(".btn-text");
  if (span) span.textContent = on ? "Verificando..." : "Verificar";
}

function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove("hidden"); }
function hideError() { errorMsg.textContent = ""; errorMsg.classList.add("hidden"); }

// ---- Analysis card builder (shared by live result and demo) ----

const METRIC_LABELS = {
  autoridad_fuente: "Autoridad de fuente",
  evidencia_encontrada: "Evidencia encontrada",
  consenso_fuentes: "Consenso de fuentes",
  actualidad: "Actualidad",
  sin_contradicciones: "Sin contradicciones",
};

const METRIC_ORDER = [
  "autoridad_fuente",
  "evidencia_encontrada",
  "consenso_fuentes",
  "actualidad",
  "sin_contradicciones",
];

const TRUSTED_MEDIA_SOURCES = [
  { label: "Listín Diario", domain: "listindiario.com" },
  { label: "Diario Libre", domain: "diariolibre.com" },
  { label: "Noticias SIN", domain: "noticiassin.com" },
  { label: "CDN 37", domain: "cdn.com.do" },
  { label: "Acento", domain: "acento.com.do" },
  { label: "El Caribe", domain: "elcaribe.com.do" },
  { label: "Hoy Digital", domain: "hoy.com.do" },
  { label: "El Nuevo Diario", domain: "elnuevodiario.com.do" },
  { label: "RNN Noticias", domain: "rnn.com.do" },
  { label: "N Digital", domain: "ndigital.com.do" },
  { label: "RC Noticias", domain: "rcnoticias.com.do" },
  { label: "Z101 Digital", domain: "z101digital.com" },
];

const TRUSTED_OFFICIAL_SOURCES = [
  { label: "Presidencia RD", domain: "presidencia.gob.do" },
  { label: "Policía Nacional RD", domain: "policia.gob.do" },
  { label: "Ministerio Público RD", domain: "ministeriopublico.gob.do" },
  { label: "COE", domain: "coe.gob.do" },
  { label: "Migración RD", domain: "migracion.gob.do" },
  { label: "JCE", domain: "jce.gob.do" },
];

const TRUSTED_SOURCE_LOOKUP = [...TRUSTED_MEDIA_SOURCES, ...TRUSTED_OFFICIAL_SOURCES];
const TRUSTED_SEARCH_SOURCES = [...TRUSTED_MEDIA_SOURCES, ...TRUSTED_OFFICIAL_SOURCES];

function scoreColor(n) {
  if (n >= 65) return "var(--green)";
  if (n >= 35) return "var(--orange)";
  return "var(--red)";
}

function verdictInfo(veredicto) {
  const v = veredicto.toUpperCase();
  if (v === "CONFIABLE" || v === "REAL") return { label: "Confiable", cls: "confiable", icon: "✓" };
  if (v === "DUDOSA") return { label: "Dudosa", cls: "dudosa", icon: "⚠" };
  return { label: "Falsa", cls: "falsa", icon: "✕" };
}

function buildGaugeSvg(score) {
  const r = 40;
  const circ = +(2 * Math.PI * r).toFixed(1);
  const offset = +(circ * (1 - score / 100)).toFixed(1);
  const color = scoreColor(score);
  return `<svg class="gauge-svg" viewBox="0 0 100 100" role="img" aria-label="Puntuación ${score}">
    <circle class="gauge-bg" cx="50" cy="50" r="${r}" />
    <circle class="gauge-arc" cx="50" cy="50" r="${r}"
      stroke="${color}"
      stroke-dasharray="${circ} ${circ}"
      stroke-dashoffset="${offset}"
      transform="rotate(-90 50 50)" />
    <text class="gauge-num" x="50" y="50">${score}</text>
  </svg>`;
}

function buildMetricBars(metricas) {
  return METRIC_ORDER.map((key) => {
    const val = typeof metricas[key] === "number" ? metricas[key] : 50;
    const color = scoreColor(val);
    return `<div class="metric-item">
      <div class="metric-header">
        <span>${METRIC_LABELS[key] || key}</span>
        <span class="metric-score">${val}</span>
      </div>
      <div class="metric-bar-bg">
        <div class="metric-bar-fill" style="width:${val}%;background:${color}"></div>
      </div>
    </div>`;
  }).join("");
}

function buildSourceChips(fuentes, claim) {
  const exactMatches = buildExactSourceLinks(fuentes, claim);
  const trustedOfficials = buildTrustedSearchLinks(TRUSTED_SEARCH_SOURCES, claim);
  const sections = [
    buildSourceGroup("Coincidencias encontradas", exactMatches),
    buildSourceGroup("Buscar en fuentes oficiales", trustedOfficials),
  ].filter(Boolean);

  if (!sections.length) return "";
  return `<div class="sources-wrap">${sections.join("")}</div>`;
}

function normalizeSourceUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "#";
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "#";
    if (url.protocol === "http:") url.protocol = "https:";
    return url.href;
  } catch {
    // Ignore malformed values and fall back to non-navigable link.
    return "#";
  }
}

function buildExactSourceLinks(fuentes, claim) {
  const seenHref = new Set();
  const seenLabel = new Set();
  return fuentes.flatMap((fuente) => {
    const normalizedHref = normalizeSourceUrl(fuente);
    const trustedSource = findTrustedSource(fuente) || findTrustedSource(normalizedHref);
    const href = (!isSpecificSourceUrl(normalizedHref) && trustedSource)
      ? createSourceSearchUrl(trustedSource.domain, claim)
      : normalizedHref;
    if (href === "#" || seenHref.has(href)) return [];
    const label = getSourceLabel(fuente, normalizedHref);
    const labelKey = label.toLowerCase();
    if (seenLabel.has(labelKey)) return [];
    seenHref.add(href);
    seenLabel.add(labelKey);
    return [{
      href,
      label,
    }];
  });
}

function buildTrustedSearchLinks(sources, claim) {
  const seen = new Set();
  return sources.flatMap((source) => {
    const href = createSourceSearchUrl(source.domain, claim);
    if (seen.has(href)) return [];
    seen.add(href);
    return [{ href, label: source.label }];
  });
}

function buildSourceGroup(title, links) {
  if (!links.length) return "";
  const chips = links.map(({ href, label }) => (
    `<a class="source-chip source-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  )).join("");
  return `
    <div class="source-group">
      <p class="source-group-label">${escapeHtml(title)}</p>
      <div class="source-chips">${chips}</div>
    </div>
  `;
}

function createSourceSearchUrl(domain, claim) {
  const query = String(claim || "").trim();
  const terms = query ? `site:${domain} "${query}"` : `site:${domain}`;
  return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
}

function isSpecificSourceUrl(raw) {
  try {
    const url = new URL(raw);
    return url.pathname && url.pathname !== "/";
  } catch {
    return false;
  }
}

function getSourceLabel(raw, normalizedHref) {
  const trustedSource = findTrustedSource(raw) || findTrustedSource(normalizedHref);
  if (trustedSource) return trustedSource.label;

  try {
    const url = new URL(normalizedHref);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return String(raw || "").trim() || "Fuente";
  }
}

function findTrustedSource(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;

  const hostname = extractHostname(text);
  return TRUSTED_SOURCE_LOOKUP.find(({ label, domain }) => {
    const matchesLabel = label.toLowerCase() === text;
    const matchesDomain = hostname
      ? hostname === domain || hostname.endsWith(`.${domain}`)
      : text === domain;
    return matchesLabel || matchesDomain;
  }) || null;
}

function extractHostname(value) {
  const normalized = normalizeSourceUrl(value);
  if (normalized === "#") return "";
  try {
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

function buildAnalysisCard({ claim, score, veredicto, metricas, razones, fuentes }) {
  const vInfo = verdictInfo(veredicto);
  const evidenceHtml = razones.length
    ? `<div class="evidence-section">
        <p class="evidence-label">Evidencia clave</p>
        <ul class="evidence-list">${razones.map((r) => `<li>${escapeHtml(String(r))}</li>`).join("")}</ul>
      </div>`
    : "";
  return `
    <p class="claim-label">Afirmación verificada</p>
    <p class="claim-text">"${escapeHtml(String(claim))}"</p>
    <div class="scores-row">
      <div class="gauge-wrap">
        ${buildGaugeSvg(score)}
        <span class="verdict-chip ${vInfo.cls}">${vInfo.icon} ${vInfo.label}</span>
      </div>
      <div class="metrics-list">${buildMetricBars(metricas)}</div>
    </div>
    ${evidenceHtml}
    ${buildSourceChips(fuentes, claim)}
  `;
}

// ---- Demo section ----

const DEMO_DATA = {
  confiable: {
    claim: "El Banco Central de la República Dominicana aumentó las tasas de interés en 50 puntos base en enero 2025.",
    score: 82,
    veredicto: "CONFIABLE",
    metricas: { autoridad_fuente: 92, evidencia_encontrada: 88, consenso_fuentes: 85, actualidad: 79, sin_contradicciones: 70 },
    razones: [
      "El Banco Central publicó el comunicado N° 012-2025 confirmando el ajuste de la tasa de política monetaria de 6.75% a 7.25%, efectivo al 31 de enero de 2025.",
      "Listín Diario y Diario Libre cubrieron el anuncio con declaraciones directas del gobernador Héctor Valdez Albizu.",
    ],
    fuentes: ["bancentral.gov.do", "listindiario.com", "diariolibre.com", "elcaribe.com.do", "acento.com.do", "elnacional.com.do"],
  },
  dudosa: {
    claim: "El gobierno dominicano eliminó completamente el impuesto a las importaciones de alimentos de la canasta básica en 2024.",
    score: 51,
    veredicto: "DUDOSA",
    metricas: { autoridad_fuente: 68, evidencia_encontrada: 55, consenso_fuentes: 48, actualidad: 60, sin_contradicciones: 45 },
    razones: [
      "El gobierno anunció reducciones temporales de algunos aranceles en 2024, pero no una eliminación completa del impuesto según la DGII.",
      "Múltiples medios reportaron exenciones parciales, sin confirmar eliminación total. La afirmación mezcla hechos reales con una conclusión exagerada.",
    ],
    fuentes: ["bancentral.gov.do", "listindiario.com", "diariolibre.com", "elcaribe.com.do", "elnacional.com.do", "acento.com.do"],
  },
  falsa: {
    claim: "El Congreso Nacional dominicano aprobó una ley que permite jubilarse a los 45 años para todos los empleados públicos a partir de enero 2025.",
    score: 21,
    veredicto: "FALSA",
    metricas: { autoridad_fuente: 15, evidencia_encontrada: 22, consenso_fuentes: 18, actualidad: 30, sin_contradicciones: 10 },
    razones: [
      "No existe ningún decreto ni ley aprobada en el Congreso Nacional que establezca jubilación a los 45 años para empleados públicos dominicanos.",
      "El sistema de pensiones dominicano (SIPEN) mantiene la edad de retiro en 60 años, sin modificaciones legislativas registradas.",
    ],
    fuentes: ["sipen.gov.do", "congreso.gob.do", "listindiario.com", "diariolibre.com"],
  },
};

function renderDemoCard(key) {
  document.getElementById("demoCard").innerHTML = buildAnalysisCard(DEMO_DATA[key]);
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", String(isActive));
      b.tabIndex = isActive ? 0 : -1;
    });
    document.getElementById("demoCard").setAttribute("aria-labelledby", btn.id);
    renderDemoCard(btn.dataset.demo);
  });
});

// Render initial demo
renderDemoCard("confiable");
