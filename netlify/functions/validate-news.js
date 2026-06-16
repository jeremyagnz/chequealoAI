const API_TIMEOUT_MS = 25000;

const promptRules = `
Eres un verificador de noticias de República Dominicana especializado en búsqueda multi-fuente.

Para validar la noticia del usuario, sigue EXACTAMENTE este proceso:

1. VARIACIONES: Genera 3-4 variaciones de búsqueda de la afirmación (palabras clave distintas pero equivalentes).
2. BÚSQUEDA: Busca cada variación enfocándote en fuentes dominicanas confiables:
   Medios: listindiario.com, diariolibre.com, noticiassin.com, cdn.com.do, acento.com.do, elcaribe.com.do, hoy.com.do, elnuevodiario.com.do, rnn.com.do, ndigital.com.do, rcnoticias.com.do, z101digital.com
   Oficiales: presidencia.gob.do, policia.gob.do, ministeriopublico.gob.do, pgr.gob.do, coe.gob.do, migracion.gob.do, jce.gob.do
3. COMPARACIÓN: Cruza los resultados comparando fecha, lugar, víctimas, nombres y declaraciones oficiales.
4. CONFIANZA basada en cuántas fuentes confiables confirman la noticia:
   - 0-1 fuentes confiables → nivel "baja"
   - 2 fuentes confiables → nivel "media"
   - 3 o más fuentes confiables coinciden → nivel "alta"
   - Confirmación de fuente oficial además → nivel "muy alta"

Responde SOLO en JSON con esta forma exacta:
{
  "veredicto": "CONFIABLE|DUDOSA|FALSA",
  "puntuacion": 82,
  "resumen": "texto breve en español (máx. 2 oraciones)",
  "razones": ["evidencia o argumento 1", "evidencia o argumento 2"],
  "fuentes": ["https://listindiario.com/noticia-especifica", "https://diariolibre.com/noticia-especifica"],
  "metricas": {
    "autoridad_fuente": 92,
    "evidencia_encontrada": 88,
    "consenso_fuentes": 85,
    "actualidad": 79,
    "sin_contradicciones": 70
  },
  "variaciones_busqueda": ["variación 1", "variación 2", "variación 3"],
  "fuentes_confirmadoras": 3,
  "confirmacion_oficial": false,
  "nivel_confianza": "alta"
}

Criterios adicionales:
- CONFIABLE (puntuacion >= 65): evidencia sólida y múltiples fuentes confiables de RD.
- DUDOSA (puntuacion 35-64): evidencia parcial, contradictoria o insuficiente.
- FALSA (puntuacion < 35): información incorrecta o sin respaldo verificable.
- Todos los valores en "metricas" son enteros de 0 a 100.
- "puntuacion" debe ser coherente con el promedio ponderado de las métricas y el veredicto.
- En "fuentes" incluye SOLO URLs de artículos específicos encontrados. No incluyas homepages ni inventes enlaces.
- "fuentes_confirmadoras": número entero de medios o fuentes confiables que confirmaron la noticia.
- "confirmacion_oficial": true únicamente si una fuente gubernamental, policial o institucional oficial confirmó la noticia.
- "nivel_confianza": "baja" | "media" | "alta" | "muy alta" según los criterios de confianza anteriores.
- "variaciones_busqueda": arreglo con las variaciones de búsqueda que usaste.
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

  const body = parseRequestBody(event.body);
  const query = body?.query?.trim();

  if (!query) {
    return jsonResponse(400, { error: "Debes enviar una noticia para validar." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", process.env.OPENAI_API_KEY].join(" "),
      },
      body: JSON.stringify({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: promptRules },
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

    // Responses API returns output as an array; find the assistant message item.
    const outputItems = Array.isArray(data?.output) ? data.output : [];
    const messageItem = outputItems.find((item) => item.type === "message");
    const text = messageItem?.content
      ?.find((c) => c.type === "output_text")
      ?.text
      ?.trim();

    if (!text) {
      return jsonResponse(502, {
        error: "OpenAI devolvió una respuesta vacía.",
      });
    }

    let parsed;
    try {
      // The model may wrap JSON in markdown code fences; strip them if present.
      const jsonText = (text.startsWith("```")
        ? text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
        : text
      ).trim();
      parsed = JSON.parse(jsonText);
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
      variaciones_busqueda: Array.isArray(parsed.variaciones_busqueda)
        ? parsed.variaciones_busqueda.map(String)
        : [],
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
