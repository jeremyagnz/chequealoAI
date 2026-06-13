const API_TIMEOUT_MS = 20000;

const promptRules = `
Eres un verificador de noticias especializado en República Dominicana.
Analiza la consulta del usuario y responde SOLO en JSON con esta estructura exacta:
{
  "veredicto": "REAL|DUDOSA|FALSA",
  "resumen": "Resumen explicativo de 2-3 oraciones en español.",
  "razones": ["razón 1", "razón 2", "razón 3"],
  "fuentes": [
    {"nombre": "Nombre del medio o entidad", "url": "https://url-oficial.com"}
  ],
  "confiabilidad_fuente": "Alta | Media | Baja — breve explicación de por qué.",
  "autoridad_fuente": "Breve descripción de la autoridad de las fuentes más relevantes para esta noticia.",
  "consenso_fuentes": "Descripción de si hay consenso o divergencia entre las fuentes consultadas.",
  "actualidad": "Descripción de qué tan actualizada o vigente es la información analizada.",
  "evidencia": "Descripción de la evidencia disponible que apoya o refuta la noticia.",
  "contradicciones": "Descripción de contradicciones detectadas, o 'Ninguna detectada' si no las hay."
}

INSTRUCCIONES DE BÚSQUEDA SEMÁNTICA (MUY IMPORTANTE):
- NO busques coincidencias exactas de palabras o títulos. Extrae el CONCEPTO y los HECHOS clave.
- Relaciona sinónimos y palabras equivalentes al buscar y evaluar. Ejemplos:
    mueren / fallecen / fallecidos / muertos / víctimas mortales / decesos → todos describen muertes.
    heridos / lesionados / sobrevivientes → personas afectadas no mortalmente.
    incidente / accidente / suceso / hecho / tragedia → evento negativo ocurrido.
    torre / edificio / residencial / inmueble → tipo de estructura.
    Piantini / sector Piantini / barrio Piantini → misma zona geográfica.
- Identifica las entidades clave: ¿Qué ocurrió? ¿Dónde? ¿Cuándo? ¿Quiénes? ¿Cuántos?
- Busca eventos que coincidan en CONCEPTO aunque usen vocabulario distinto al de la consulta.
- Si encuentras noticias sobre el mismo HECHO con distintas palabras, tratar eso como evidencia a favor.
- NO marques como DUDOSA una noticia solo porque no encuentras el titular exacto. Busca el hecho descrito.
- Sé inclusivo: una búsqueda sobre "dos personas que mueren en Piantini" debe cubrir cualquier noticia sobre fallecidos, decesos o víctimas en esa zona.

Criterios de veredicto:
- REAL: El hecho descrito es verosímil y existe evidencia (directa o conceptualmente equivalente) que lo respalda, sin contradicciones significativas.
- DUDOSA: No se encontró evidencia suficiente del hecho concreto, o existen indicios contradictorios que impiden confirmar o descartar.
- FALSA: Hay evidencia clara de que los hechos descritos son incorrectos o engañosos.

URLs de referencia de fuentes dominicanas (úsalas SOLO si el medio cubrió directamente el hecho):
Medios: Diario Libre (https://diariolibre.com), Listín Diario (https://listindiario.com), Noticias SIN (https://noticiassin.com), El Caribe (https://elcaribe.com.do), Hoy (https://hoy.com.do), Acento (https://acento.com.do), El Nuevo Diario (https://elnuevodiario.com.do)
Oficiales: Presidencia (https://presidencia.gob.do), DGII (https://dgii.gov.do), Banco Central (https://bancentral.gov.do), Ministerios (https://gobiernord.gob.do), JCE (https://jce.gob.do)

REGLA CRÍTICA SOBRE FUENTES:
- Prioriza en el campo "fuentes" medios o entidades con cobertura directa y específica del hecho descrito.
- NO listes un medio solo porque es conocido; intenta primero fuentes con relación clara al evento.
- Si no puedes confirmar cobertura directa, incluye de 1 a 3 fuentes dominicanas RELACIONADAS al tema (o entidad oficial competente) como referencia para ampliar, en vez de dejar "fuentes" vacío.
- Nunca devuelvas el arreglo "fuentes" vacío salvo que sea absolutamente imposible.
- Es mejor devolver pocas fuentes relevantes que muchas fuentes genéricas sin relación.

Prioriza siempre la transparencia, la explicabilidad y la credibilidad.
Si no tienes información en tiempo real, indícalo claramente en el resumen.
Nunca salgas del formato JSON.
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
        Authorization: ["Bearer", process.env.OPENAI_API_KEY].join(" "),
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
      fuentes: sanitizeSources(parsed.fuentes),
      confiabilidad_fuente: parsed.confiabilidad_fuente || "",
      autoridad_fuente: parsed.autoridad_fuente || "",
      consenso_fuentes: parsed.consenso_fuentes || "",
      actualidad: parsed.actualidad || "",
      evidencia: parsed.evidencia || "",
      contradicciones: parsed.contradicciones || "",
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

function sanitizeSources(rawSources) {
  if (!Array.isArray(rawSources)) {
    return defaultSources();
  }

  const sanitized = rawSources
    .map((source) => {
      if (source && typeof source === "object") {
        const url = normalizeHttpUrl(source.url);
        const nombre = typeof source.nombre === "string" ? source.nombre.trim() : "";

        if (url) {
          return {
            nombre: nombre || url,
            url,
          };
        }
      }

      if (typeof source === "string") {
        const value = normalizeHttpUrl(source);
        if (value) {
          return { nombre: value, url: value };
        }
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 5);

  return sanitized.length ? sanitized : defaultSources();
}

function defaultSources() {
  return [
    { nombre: "Diario Libre (referencia general)", url: "https://diariolibre.com" },
    { nombre: "Listín Diario (referencia general)", url: "https://listindiario.com" },
  ];
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
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
