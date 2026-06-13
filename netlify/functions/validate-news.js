const API_TIMEOUT_MS = 20000;

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
- Evalúa si la noticia parece verosímil y potencialmente verídica según conocimiento general disponible.
- Si no hay evidencia suficiente, usa DUDOSA.
- Prioriza fuentes confiables de RD (Listín Diario, Diario Libre, El Caribe, Presidencia, JCE, Banco Central, etc.).
- Aclara de forma breve si hay limitación por falta de verificación en tiempo real.
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
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

    return jsonResponse(200, {
      veredicto: String(parsed.veredicto).toUpperCase(),
      resumen: parsed.resumen,
      razones: Array.isArray(parsed.razones) ? parsed.razones : [],
      fuentes: Array.isArray(parsed.fuentes) ? parsed.fuentes : [],
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
