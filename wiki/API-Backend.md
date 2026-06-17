# API y Backend

## Endpoint

```
POST /.netlify/functions/validate-news
Content-Type: application/json
```

### Request body

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `query` | `string` | Titular o texto de la noticia a verificar |

**Ejemplo:**
```json
{ "query": "El Banco Central subió las tasas de interés en enero 2025" }
```

---

## Response body (éxito — HTTP 200)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `veredicto` | `string` | `"CONFIABLE"`, `"DUDOSA"` o `"FALSA"` |
| `puntuacion` | `number` | Puntuación de 0 a 100 |
| `resumen` | `string` | Análisis breve (máx. 2 oraciones) |
| `razones` | `string[]` | Lista de evidencias o argumentos |
| `fuentes` | `string[]` | URLs específicas de artículos relacionados |
| `metricas` | `object` | Objeto con 5 métricas (ver abajo) |
| `mediaFuentes` | `string[]` | URLs de medios dominicanos encontrados por Serper |
| `officialFuentes` | `string[]` | URLs de fuentes oficiales encontradas por Serper |

### Objeto `metricas`

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `autoridad_fuente` | `number` (0–100) | ¿La fuente original de la afirmación es reconocida y confiable? |
| `evidencia_encontrada` | `number` (0–100) | ¿Existe evidencia directa que confirme la afirmación? |
| `consenso_fuentes` | `number` (0–100) | ¿Los distintos medios coinciden en apoyar la afirmación? |
| `actualidad` | `number` (0–100) | ¿La información es reciente y el evento es real en el período indicado? |
| `sin_contradicciones` | `number` (0–100) | ¿Ninguna fuente creíble contradice la afirmación? |

**Ejemplo de respuesta exitosa:**
```json
{
  "veredicto": "CONFIABLE",
  "puntuacion": 82,
  "resumen": "El Banco Central publicó el ajuste oficial de tasas.",
  "razones": [
    "El comunicado N° 012-2025 confirma el incremento de 6.75% a 7.25%.",
    "Listín Diario y Diario Libre cubrieron el anuncio."
  ],
  "fuentes": ["https://listindiario.com/...", "https://diariolibre.com/..."],
  "metricas": {
    "autoridad_fuente": 92,
    "evidencia_encontrada": 88,
    "consenso_fuentes": 85,
    "actualidad": 79,
    "sin_contradicciones": 70
  },
  "mediaFuentes": ["https://listindiario.com/noticia-1"],
  "officialFuentes": ["https://presidencia.gob.do/nota-1"]
}
```

---

## Códigos de error

| HTTP | `error` | Causa |
|------|---------|-------|
| `400` | `"Debes enviar una noticia para validar."` | El body no contiene `query` o está vacío |
| `405` | `"Método no permitido."` | Se usó un método distinto a `POST` |
| `500` | `"Falta configurar OPENAI_API_KEY en Netlify."` | Variable de entorno ausente |
| `500` | `"No se pudo conectar con OpenAI."` | Error de red al llamar a OpenAI |
| `502` | `"OpenAI devolvió una respuesta vacía."` | Respuesta sin contenido de OpenAI |
| `502` | `"OpenAI devolvió una respuesta con formato inválido."` | JSON malformado de OpenAI |
| `502` | `"La respuesta del verificador llegó incompleta."` | Falta `veredicto` o `resumen` en la respuesta |
| `504` | `"La validación tardó demasiado. Intenta otra vez."` | Timeout de 20 s alcanzado |

---

## Constantes configurables (`validate-news.js`)

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `API_TIMEOUT_MS` | `20000` | Timeout para la llamada a OpenAI (ms) |
| `SERPER_TIMEOUT_MS` | `5000` | Timeout para la llamada a Serper (ms) |
| `SERPER_MAX_RESULTS` | `20` | Máximo de resultados pedidos a Serper |
| `SERPER_CONTEXT_RESULTS` | `10` | Resultados de Serper enviados como contexto a OpenAI |
| `MAX_MEDIA_SOURCES` | `6` | Máx. URLs de medios devueltas en `mediaFuentes` |
| `MAX_OFFICIAL_SOURCES` | `4` | Máx. URLs oficiales devueltas en `officialFuentes` |

---

## Modelo de OpenAI

- **Modelo:** `gpt-4o-mini`
- **Temperatura:** `0.2`
- **Formato de respuesta:** `json_object`
- El sistema recibe el `promptRules` (criterios de veredicto, métricas y coherencia) más el contexto de resultados de Serper.
- El usuario envía: `"Noticia a validar: <query>"`
