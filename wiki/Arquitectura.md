# Arquitectura

## Visión general

ChequealoAI es una aplicación **JAMstack**: el frontend es completamente estático (HTML/CSS/JS) y toda la lógica sensible vive en una **Netlify Function** del lado del servidor.

```
Usuario
  │
  │  GET /
  ▼
index.html + styles.css + script.js   (frontend estático)
  │
  │  POST /.netlify/functions/validate-news
  ▼
validate-news.js (Netlify Function — Node.js)
  │         │
  │         ▼
  │    Serper API  ──→  resultados de búsqueda en Google (geo: DO)
  │
  ▼
OpenAI API (gpt-4o-mini)  ──→  JSON con veredicto, puntuación, razones y fuentes
  │
  ▼
Respuesta JSON al frontend  →  renderizado en tarjeta de análisis
```

---

## Estructura de archivos

```
chequealoAI/
├── index.html                      # Estructura de la página
├── styles.css                      # Estilos globales (variables CSS, layouts, tarjetas)
├── script.js                       # Lógica frontend: validación, render, historial, demo
├── netlify.toml                    # Config de publicación y functions
└── netlify/
    └── functions/
        └── validate-news.js        # Function: proxy seguro hacia Serper + OpenAI
```

---

## Flujo de datos detallado

### 1. Entrada del usuario

El usuario escribe un titular o texto en `#newsQuery` y presiona **Verificar** (o `Enter`).

### 2. Llamada al backend (`script.js`)

```js
POST /.netlify/functions/validate-news
Content-Type: application/json

{ "query": "texto de la noticia" }
```

Hay un timeout de **20 segundos** en el frontend.

### 3. Backend: búsqueda en Serper (`validate-news.js`)

- Se buscan hasta **20 resultados** en Google con parámetros `gl: "do"` y `hl: "es"`.
- Timeout de **5 segundos** (fallo suave: si Serper no responde, el flujo continúa sin resultados de búsqueda).
- Los resultados se filtran por `MEDIA_DOMAINS` y `OFFICIAL_DOMAINS` para extraer `mediaFuentes` y `officialFuentes`.

### 4. Backend: análisis con OpenAI

- Se envían las reglas del sistema (`promptRules`) junto con los resultados de búsqueda como contexto.
- Modelo: `gpt-4o-mini`, temperatura `0.2`, formato de respuesta `json_object`.
- Timeout de **20 segundos**.

### 5. Respuesta JSON

```json
{
  "veredicto": "CONFIABLE | DUDOSA | FALSA",
  "puntuacion": 82,
  "resumen": "Texto breve del análisis.",
  "razones": ["razón 1", "razón 2"],
  "fuentes": ["https://..."],
  "metricas": {
    "autoridad_fuente": 92,
    "evidencia_encontrada": 88,
    "consenso_fuentes": 85,
    "actualidad": 79,
    "sin_contradicciones": 70
  },
  "mediaFuentes": ["https://listindiario.com/..."],
  "officialFuentes": ["https://presidencia.gob.do/..."]
}
```

### 6. Renderizado en el frontend

- Se construye una tarjeta con un **gauge SVG** de puntuación, **barras de métricas** y **chips de fuentes** clicables.
- El resultado se guarda en `localStorage` bajo la clave `chequealoai_history` (máx. 20 entradas).

---

## Seguridad

| Riesgo | Mitigación |
|--------|-----------|
| Exposición de API keys | Las claves viven únicamente en variables de entorno del servidor |
| XSS | Toda salida al DOM pasa por `escapeHtml()` |
| URLs maliciosas | `normalizeSourceUrl()` valida y fuerza HTTPS antes de renderizar |
| Timeout | Ambas llamadas (Serper y OpenAI) tienen timeouts con `AbortController` |
