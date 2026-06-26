# chequealoAI

ChequealoAI es una app web para verificar titulares o afirmaciones sobre República Dominicana usando:

- búsqueda contextual en Serper (Google Search API),
- análisis de IA con OpenAI,
- y una interfaz simple que muestra puntaje, veredicto, evidencia y fuentes.

## Release

- 📦 **Primer release:** [v1.0.0 - Release Notes](./RELEASE_NOTES.md)

---

## ¿Cómo funciona todo?

### 1) Flujo completo (de extremo a extremo)

1. El usuario escribe una noticia o afirmación en el input (`index.html`).
2. El frontend (`script.js`) envía un `POST` a `/.netlify/functions/validate-news`.
3. La Netlify Function (`netlify/functions/validate-news.js`):
   - valida el request,
   - consulta Serper (si hay `SERPER_API_KEY`),
   - filtra fuentes dominicanas de medios y oficiales,
   - arma contexto para la IA,
   - consulta OpenAI,
   - normaliza/limpia respuesta y devuelve JSON al frontend.
4. El frontend renderiza:
   - veredicto (`CONFIABLE`, `DUDOSA`, `FALSA`),
   - puntuación,
   - métricas,
   - evidencia,
   - enlaces de fuentes.
5. El resultado se guarda en historial local (`localStorage`) y se puede reabrir con filtros.

---

## Arquitectura del proyecto

Proyecto estático + función serverless:

- `/index.html` → estructura de UI (hero, buscador, resultado, historial, demo).
- `/styles.css` → estilos visuales.
- `/script.js` → lógica del cliente (llamada API, manejo de errores, render, historial).
- `/netlify/functions/validate-news.js` → backend serverless (Serper + OpenAI).
- `/netlify.toml` → configuración de deploy y carpeta de funciones.

---

## Backend (Netlify Function) en detalle

Ruta: `/.netlify/functions/validate-news`

### Responsabilidades

- Acepta solo método `POST`.
- Exige `OPENAI_API_KEY` configurada.
- Lee `query` del body JSON.
- Hace búsqueda en Serper (soft-fail: si falla, continúa).
- Filtra resultados por listas de dominios confiables:
  - medios dominicanos (`MEDIA_DOMAINS`),
  - fuentes oficiales (`OFFICIAL_DOMAINS`).
- Construye contexto de búsqueda (top resultados).
- Llama OpenAI (`chat/completions`) con formato de respuesta JSON.
- Valida y sanea campos antes de responder al frontend.

### Salida JSON esperada por frontend

- `veredicto`
- `puntuacion`
- `resumen`
- `razones[]`
- `fuentes[]`
- `metricas`
- `mediaFuentes[]`
- `officialFuentes[]`

---

## Frontend en detalle

`script.js` maneja tres bloques principales:

1. **Validación**
   - click en botón / Enter,
   - timeout de petición,
   - manejo de errores de red/API.

2. **Render de resultados**
   - tarjeta de análisis con score y veredicto,
   - barras de métricas,
   - razones/evidencias,
   - fuentes clicables sanitizadas (forzando `https` y escapando texto).

3. **Historial**
   - persiste en `localStorage` (`chequealoai_history`),
   - máximo 20 entradas,
   - filtros por veredicto y recarga de resultados previos.

---

## Variables de entorno

Configura estas variables en Netlify:

- `OPENAI_API_KEY` (obligatoria): clave para llamar OpenAI.
- `SERPER_API_KEY` (opcional): habilita contexto de búsqueda web para mejorar evidencia.

Para activar Google Analytics (GA4), antes de desplegar define tu Measurement ID en `theme.js` asignando la constante `GA_MEASUREMENT_ID` (por ejemplo: `G-ABC123XYZ9`).

> Nunca expongas estas claves en el frontend ni en commits.

---

## Ejecución y despliegue

### Deploy en Netlify

El repo ya incluye `netlify.toml`:

- `publish = "."`
- `functions.directory = "netlify/functions"`

Pasos:

1. Importa el repo en Netlify.
2. Configura variables de entorno.
3. Haz deploy.

### Desarrollo local

Puedes servir el sitio estático con cualquier servidor local y usar Netlify Functions en entorno Netlify/CLI según tu flujo.

---

## Consideraciones importantes

- Si Serper no está disponible, la validación sigue funcionando con OpenAI.
- La calidad del veredicto mejora cuando hay contexto de búsqueda y fuentes relevantes.
- El historial se guarda en el navegador del usuario (no en base de datos).
- La app orienta a verificación rápida, no reemplaza investigación periodística formal.
