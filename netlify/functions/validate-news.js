const API_TIMEOUT_MS = 20000;
const SERPER_TIMEOUT_MS = 5000;
const SERPER_MAX_RESULTS = 20;
const SERPER_CONTEXT_RESULTS = 10;
const MAX_MEDIA_SOURCES = 6;
const MAX_OFFICIAL_SOURCES = 4;

const MEDIA_DOMAINS = [
  "listindiario.com", "diariolibre.com", "noticiassin.com", "cdn.com.do",
  "acento.com.do", "elcaribe.com.do", "hoy.com.do", "elnuevodiario.com.do",
  "rnn.com.do", "ndigital.com.do", "rcnoticias.com.do", "z101digital.com",
];

const OFFICIAL_DOMAINS = [
  "presidencia.gob.do", "policia.gob.do", "ministeriopublico.gob.do",
  "pgr.gob.do", "coe.gob.do", "migracion.gob.do", "jce.gob.do",
];

const promptRules = `
Eres un verificador de noticias de República Dominicana.
Analiza la consulta del usuario y responde SOLO en JSON con esta forma exacta:
{
  "veredicto": "CONFIABLE|DUDOSA|FALSA",
  "puntuacion": 82,
  "resumen": "texto explicativo en español (máx. 15 oraciones) describiendo la evidencia encontrada, las fuentes consultadas y el razonamiento detrás del veredicto",
  "razones": ["evidencia o argumento 1", "evidencia o argumento 2"],
  "fuentes": ["https://listindiario.com/noticia-ejemplo", "https://www.diariolibre.com/noticia-ejemplo"],
  "metricas": {
    "autoridad_fuente": 92,
    "evidencia_encontrada": 88,
    "consenso_fuentes": 85,
    "actualidad": 79,
    "sin_contradicciones": 70
  }
}
Criterios de veredicto:
- CONFIABLE (puntuacion >= 65): la noticia tiene evidencia sólida y fuentes confiables de RD.
- DUDOSA (puntuacion 35-64): hay evidencia parcial, contradictoria o insuficiente.
- FALSA (puntuacion < 35): la información es incorrecta o carece de respaldo verificable.

Definición de métricas (cada una mide el RESPALDO de la afirmación, no la existencia de información sobre el tema):
- autoridad_fuente: ¿la fuente original de la afirmación es reconocida y confiable? (alto = fuente creíble respalda la noticia; bajo = fuente dudosa o la afirmación contradice fuentes confiables)
- evidencia_encontrada: ¿existe evidencia directa que CONFIRME la afirmación? (alto = múltiples fuentes la confirman; bajo = no hay evidencia o la refutan)
- consenso_fuentes: ¿los distintos medios y fuentes oficiales coinciden en apoyar la afirmación? (alto = amplio consenso a favor; bajo = las fuentes la niegan o la contradicen)
- actualidad: ¿la información es reciente y el evento es real en el período indicado? (alto = evento verificado y actual; bajo = desactualizado, sin fecha o inexistente)
- sin_contradicciones: ¿ninguna fuente creíble contradice la afirmación? (alto = sin contradicciones; bajo = múltiples fuentes la desmienten)

Reglas de coherencia (OBLIGATORIO):
- Todos los valores en "metricas" son enteros de 0 a 100.
- La "puntuacion" DEBE ser aproximadamente el promedio ponderado de las métricas.
- Las métricas DEBEN ser coherentes con el veredicto:
  * CONFIABLE: promedio de métricas >= 65 (la mayoría >= 60)
  * DUDOSA: promedio de métricas entre 35 y 64 (mezcla de valores altos y bajos)
  * FALSA: promedio de métricas < 35 (la mayoría <= 35, reflejando falta de respaldo o contradicción)
- Nunca asignes métricas altas a una noticia FALSA ni métricas bajas a una CONFIABLE.
- Para validar noticias nacionales, consulta y cruza estas fuentes confiables de RD (medios y oficiales):
  Medios: listindiario.com, diariolibre.com, noticiassin.com, cdn.com.do, acento.com.do, elcaribe.com.do, hoy.com.do, elnuevodiario.com.do, rnn.com.do, ndigital.com.do, rcnoticias.com.do, z101digital.com
  Oficiales: presidencia.gob.do, policia.gob.do, ministeriopublico.gob.do, pgr.gob.do, coe.gob.do, migracion.gob.do, jce.gob.do
- Usa tantas de estas fuentes como sea posible para confirmar o desmentir la afirmación, priorizando coincidencia entre varios medios y fuentes oficiales cuando aplique.
- En "fuentes" devuelve solo URLs clicables que apunten directamente a artículos, comunicados o páginas específicas claramente relacionadas con la consulta.
- No inventes enlaces ni devuelvas portadas genéricas/homepages si no tienes una URL específica y pertinente para esa fuente; en ese caso omite esa fuente del arreglo.
- Si se te proveen resultados de búsqueda en el contexto, úsalos como evidencia directa para el análisis.
- Nunca salgas del formato JSON.
`;

async function searchSerper(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, gl: "do", hl: "es", num: SERPER_MAX_RESULTS }),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.organic) ? data.organic : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function matchesDomain(link, domain) {
  try {
    const hostname = new URL(link).hostname.replace(/^www\./i, "");
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function filterByDomains(results, domains) {
  return results
    .filter((r) => r.link && domains.some((d) => matchesDomain(r.link, d)))
    .map((r) => r.link);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método no permitido." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(500, {
      error: "Falta configurar OPENAI_API_KEY en Netlify.",
    });
  }

  const body = parseRequestBody(event.body);
  const query = body?.query?.trim();

  if (!query) {
    return jsonResponse(400, { error: "Debes enviar una noticia para validar." });
  }

  // Search Serper (soft fail — does not block if unavailable or slow)
  const serperResults = await searchSerper(query);
  const mediaFuentes = filterByDomains(serperResults, MEDIA_DOMAINS).slice(0, MAX_MEDIA_SOURCES);
  const officialFuentes = filterByDomains(serperResults, OFFICIAL_DOMAINS).slice(0, MAX_OFFICIAL_SOURCES);

  // Build search context snippet for OpenAI
  const serperContext = serperResults.length > 0
    ? "\n\nResultados de búsqueda encontrados para esta consulta:\n" +
      serperResults.slice(0, SERPER_CONTEXT_RESULTS)
        .map((r) => `- ${r.title || "Sin título"}: ${r.link || ""}`)
        .join("\n")
    : "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", process.env.OPENAI_API_KEY].join(" "),
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: promptRules + serperContext },
          { role: "user", content: `Noticia a validar: ${query}` },
        ],
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const remoteMessage = data?.error?.message;
      return jsonResponse(response.status, {
        error: remoteMessage || "OpenAI no pudo procesar la validación.",
      });
    }

    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return jsonResponse(502, {
        error: "OpenAI devolvió una respuesta vacía.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse(502, {
        error: "OpenAI devolvió una respuesta con formato inválido.",
      });
    }

    if (!parsed?.veredicto || !parsed?.resumen) {
      return jsonResponse(502, {
        error: "La respuesta del verificador llegó incompleta.",
      });
    }

    const clampScore = (n) => typeof n === "number" ? Math.round(Math.max(0, Math.min(100, n))) : null;
    const metricas = parsed.metricas && typeof parsed.metricas === "object"
      ? {
          autoridad_fuente: clampScore(parsed.metricas.autoridad_fuente),
          evidencia_encontrada: clampScore(parsed.metricas.evidencia_encontrada),
          consenso_fuentes: clampScore(parsed.metricas.consenso_fuentes),
          actualidad: clampScore(parsed.metricas.actualidad),
          sin_contradicciones: clampScore(parsed.metricas.sin_contradicciones),
        }
      : null;

    return jsonResponse(200, {
      veredicto: String(parsed.veredicto).toUpperCase(),
      puntuacion: typeof parsed.puntuacion === "number"
        ? Math.round(Math.max(0, Math.min(100, parsed.puntuacion)))
        : null,
      resumen: parsed.resumen,
      razones: Array.isArray(parsed.razones) ? parsed.razones : [],
      fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [],
      metricas,
      mediaFuentes,
      officialFuentes,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return jsonResponse(504, {
        error: "La validación tardó demasiado. Intenta otra vez.",
      });
    }

    return jsonResponse(500, {
      error: "No se pudo conectar con OpenAI.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

function parseRequestBody(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    return null;
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}
