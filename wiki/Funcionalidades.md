# Funcionalidades

## Verificación de noticias

La funcionalidad principal de ChequealoAI. El usuario ingresa cualquier titular o texto y el sistema devuelve:

### Veredictos

| Veredicto | Puntuación | Significado |
|-----------|------------|-------------|
| ✓ **CONFIABLE** | ≥ 65 | Evidencia sólida y fuentes confiables respaldan la noticia |
| ⚠ **DUDOSA** | 35 – 64 | Evidencia parcial, contradictoria o insuficiente |
| ✕ **FALSA** | < 35 | La información es incorrecta o carece de respaldo verificable |

### Puntuación (0 – 100)

La puntuación es el promedio ponderado de las 5 métricas de análisis. Se muestra visualmente como un **gauge circular** con colores:

- 🟢 Verde: ≥ 65
- 🟠 Naranja: 35 – 64
- 🔴 Rojo: < 35

### Métricas de análisis

Cada métrica mide el **respaldo** de la afirmación, no la existencia de información sobre el tema:

| Métrica | Descripción |
|---------|-------------|
| **Autoridad de fuente** | ¿La fuente original de la afirmación es reconocida y confiable? |
| **Evidencia encontrada** | ¿Existe evidencia directa que confirme la afirmación? |
| **Consenso de fuentes** | ¿Los distintos medios y fuentes oficiales coinciden? |
| **Actualidad** | ¿La información es reciente y el evento es real en el período indicado? |
| **Sin contradicciones** | ¿Ninguna fuente creíble contradice la afirmación? |

### Razones

Lista de argumentos o evidencias específicas que justifican el veredicto.

### Fuentes

Se muestran en tres secciones dentro de la tarjeta:

| Sección | Descripción |
|---------|-------------|
| **Coincidencias encontradas** | URLs específicas de artículos directamente relacionados (devueltos por OpenAI) |
| **Medios dominicanos** | URLs reales encontradas por Serper en medios de RD |
| **Fuentes oficiales** | URLs reales encontradas por Serper en sitios `.gob.do` |

Todas las URLs se normalizan a **HTTPS** y se muestran como chips clicables. Las URLs genéricas (homepages) se omiten del grupo "Coincidencias encontradas".

---

## Historial de verificaciones

El historial se almacena localmente en el navegador (`localStorage`) bajo la clave `chequealoai_history`.

- Capacidad: **20 entradas** (las más antiguas se eliminan automáticamente)
- Persiste entre sesiones del mismo navegador
- Se puede filtrar por veredicto: **Todas**, **Confiable**, **Dudosa**, **Falsa**
- Al hacer clic en una entrada del historial se vuelve a mostrar el resultado completo
- Las búsquedas duplicadas reemplazan la entrada anterior con la consulta más reciente

### Estructura de cada entrada en `localStorage`

```json
{
  "id": 1700000000000,
  "timestamp": "2025-01-31T14:30:00.000Z",
  "query": "texto de la noticia",
  "veredicto": "CONFIABLE",
  "puntuacion": 82,
  "resumen": "...",
  "razones": ["..."],
  "fuentes": ["https://..."],
  "metricas": { ... },
  "mediaFuentes": ["https://..."],
  "officialFuentes": ["https://..."]
}
```

---

## Sección demo

La página incluye una sección de demostración con tres ejemplos precargados que ilustran los tres tipos de veredicto:

| Demo | Tema |
|------|------|
| **Confiable** | Banco Central de RD sube tasas de interés (enero 2025) |
| **Dudosa** | Eliminación de impuestos a importaciones de alimentos (2024) |
| **Falsa** | Ley que permite jubilarse a los 45 años para empleados públicos |

La demo usa datos estáticos (no llama a la API) y permite explorar la interfaz sin consumir créditos de OpenAI.

---

## Interacción con el teclado

| Acción | Atajo |
|--------|-------|
| Ejecutar verificación | `Enter` en el campo de texto |
| Navegar entre tabs (demo/historial) | Teclas de flecha |
| Activar item del historial | `Enter` o `Espacio` |
