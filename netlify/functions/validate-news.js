const API_TIMEOUT_MS = 25000;

const TRUSTED_DOMAINS = [
  "listindiario.com",
  "diariolibre.com",
  "noticiassin.com",
  "cdn.com.do",
  "acento.com.do",
  "elcaribe.com.do",
  "hoy.com.do",
  "elnuevodiario.com.do",
  "rnn.com.do",
  "ndigital.com.do",
  "rcnoticias.com.do",
  "z101digital.com",
  "almomento.net",
  "eldia.com.do",
  "7dias.com.do",
  "arecoa.com",
  "diariosalud.do",
  "telemicro.com.do",
  "telemicro.com",
  "telesistema11.com.do",
  "presidencia.gob.do",
  "policia.gob.do",
  "pgr.gob.do",
  "coe.gob.do",
  "jce.gob.do",
  "msp.gob.do",
  "intrant.gob.do",
  "dgii.gov.do",
  "aduanas.gob.do",
  "911.gob.do",
  "mirex.gob.do",
  "economia.gob.do",
  "senasa.gob.do",
  "indotel.gob.do",
  "bancentral.gov.do",
];

const SYSTEM_PROMPT = `Eres un verificador de noticias de República Dominicana. Analiza la noticia utilizando EXCLUSIVAMENTE los resultados de búsqueda proporcionados. No uses conocimiento propio para verificar hechos.

Determina:
1. Si varias fuentes describen el mismo evento.
2. Si existen contradicciones.
3. Si la noticia parece verdadera.
4. Qué fuentes respaldan la información.

Responde SOLO en JSON con esta forma exacta:
{
  "veredicto": "VERDADERA|DUDOSA|FALSA",
  "confianza": 82,
  "resumen": "texto breve en español (máx. 2 oraciones)",
  "fuentes": [{"medio": "Listín Diario", "url": "https://listindiario.com/..."}],
  "razones": ["evidencia o argumento 1", "evidencia o argumento 2"],
  "metricas": {
    "autoridad_fuente": 92,
    "evidencia_encontrada": 88,
    "consenso_fuentes": 85,
    "actualidad": 79,
    "sin_contradicciones": 70
  },
  "fuentes_confirmadoras": 3,
  "confirmacion_oficial": false,
  "nivel_confianza": "alta"
}

Criterios:
- VERDADERA (confianza >= 65): evidencia sólida y múltiples fuentes confiables de RD confirman la noticia.
- DUDOSA (confianza 35-64): evidencia parcial, contradictoria o insuficiente.
- FALSA (confianza < 35): información incorrecta o sin respaldo verificable.
- nivel_confianza según fuentes_confirmadoras:
  - 0-1 fuentes → "baja"
  - 2 fuentes → "media"
  - 3 o más fuentes coinciden → "alta"
  - Fuente oficial (gob.do) confirma → "muy alta"
- confirmacion_oficial: true solo si una fuente gubernamental o institucional oficial confirmó la noticia.
- En "fuentes" incluye SOLO URLs de artículos específicos presentes en los resultados dados. No incluyas homepages ni inventes URLs.
- Si no hay resultados relevantes, responde DUDOSA con confianza <= 40.
- Todos los valores en "metricas" son enteros de 0 a 100.
- Nunca salgas del formato JSON.
`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método no permitido." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(500, {
      error: "Falta configurar OPENAI_API_KEY en Netlify.",
    });
  }

  if (!process.env.SERPER_API_KEY) {
    return jsonResponse(500, {
      error: "Falta configurar SERPER_API_KEY en Netlify.",
    });
  }

  const body = parseRequestBody(event.body);
  const query = body?.query?.trim();

  if (!query) {
    return jsonResponse(400, { error: "Debes enviar una noticia para validar." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Step 1: Search Serper with the exact user query
    const serperData = await searchSerper(query, controller.signal);

    // Step 2: Filter results to trusted Dominican domains
    const filteredResults = filterTrustedResults(serperData);

    // Step 3: Format filtered results for the OpenAI prompt
    const formattedResults = formatResultsForPrompt(filteredResults);

    // Step 4: Send news + filtered results to OpenAI for analysis
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `NOTICIA:\n${query}\n\nRESULTADOS DE BÚSQUEDA DE FUENTES CONFIABLES:\n${formattedResults}`,
          },
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
    const confianza = clampScore(parsed.confianza);
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
      confianza,
      puntuacion: confianza,
      resumen: parsed.resumen,
      razones: Array.isArray(parsed.razones) ? parsed.razones : [],
      fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [],
      metricas,
      fuentes_confirmadoras: typeof parsed.fuentes_confirmadoras === "number"
        ? Math.max(0, Math.round(parsed.fuentes_confirmadoras))
        : null,
      confirmacion_oficial: typeof parsed.confirmacion_oficial === "boolean"
        ? parsed.confirmacion_oficial
        : null,
      nivel_confianza: typeof parsed.nivel_confianza === "string"
        ? parsed.nivel_confianza
        : null,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return jsonResponse(504, {
        error: "La validación tardó demasiado. Intenta otra vez.",
      });
    }

    return jsonResponse(500, {
      error: "No se pudo conectar con el servicio de validación.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

async function searchSerper(query, signal) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal,
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 20 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || "Serper no pudo procesar la búsqueda.");
  }

  return response.json();
}

function filterTrustedResults(data) {
  const organic = Array.isArray(data?.organic) ? data.organic : [];
  return organic.filter((result) => {
    try {
      const hostname = new URL(result.link).hostname.toLowerCase();
      return TRUSTED_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith("." + domain)
      );
    } catch {
      return false;
    }
  });
}

function formatResultsForPrompt(results) {
  if (!results.length) {
    return "No se encontraron resultados en fuentes dominicanas confiables.";
  }
  return results.map((r, i) => {
    const parts = [`${i + 1}. ${r.title || "(sin título)"}`];
    parts.push(`   URL: ${r.link}`);
    if (r.snippet) parts.push(`   Extracto: ${r.snippet}`);
    if (r.date) parts.push(`   Fecha: ${r.date}`);
    return parts.join("\n");
  }).join("\n\n");
}

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
