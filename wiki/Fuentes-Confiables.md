# Fuentes Confiables

ChequealoAI filtra y prioriza resultados de fuentes reconocidas de República Dominicana para garantizar análisis fundamentados.

---

## Medios de comunicación dominicanos

| Medio | Dominio |
|-------|---------|
| Listín Diario | `listindiario.com` |
| Diario Libre | `diariolibre.com` |
| Noticias SIN | `noticiassin.com` |
| CDN 37 | `cdn.com.do` |
| Acento | `acento.com.do` |
| El Caribe | `elcaribe.com.do` |
| Hoy Digital | `hoy.com.do` |
| El Nuevo Diario | `elnuevodiario.com.do` |
| RNN Noticias | `rnn.com.do` |
| N Digital | `ndigital.com.do` |
| RC Noticias | `rcnoticias.com.do` |
| Z101 Digital | `z101digital.com` |

---

## Fuentes oficiales del gobierno

| Entidad | Dominio |
|---------|---------|
| Presidencia de la República | `presidencia.gob.do` |
| Policía Nacional | `policia.gob.do` |
| Ministerio Público | `ministeriopublico.gob.do` |
| Procuraduría General | `pgr.gob.do` |
| Centro de Operaciones de Emergencias | `coe.gob.do` |
| Dirección General de Migración | `migracion.gob.do` |
| Junta Central Electoral | `jce.gob.do` |

---

## Cómo se usan estas fuentes

### En la búsqueda (Serper API)

La Netlify Function realiza una búsqueda en Google con `gl: "do"` (geolocalización República Dominicana) y `hl: "es"`. De los resultados obtenidos:

- Los que coinciden con `MEDIA_DOMAINS` se guardan en `mediaFuentes` (máx. 6 URLs).
- Los que coinciden con `OFFICIAL_DOMAINS` se guardan en `officialFuentes` (máx. 4 URLs).

### En el análisis (OpenAI)

El prompt del sistema incluye explícitamente los dominios de medios y fuentes oficiales e instruye a OpenAI a:

- Cruzar la noticia con tantas fuentes como sea posible.
- Priorizar la coincidencia entre varios medios y fuentes oficiales.
- Devolver únicamente URLs clicables que apunten a artículos específicos relacionados con la consulta.
- No inventar enlaces ni devolver páginas genéricas.

### En el frontend

- **Coincidencias encontradas:** URLs específicas devueltas por OpenAI (solo se muestran si tienen una ruta de artículo, no homepages).
- **Medios dominicanos:** URLs reales de `mediaFuentes`; si no hay ninguna, se usa el homepage del medio como fallback.
- **Fuentes oficiales:** URLs reales de `officialFuentes`; si no hay ninguna, no se muestra la sección.

---

## Agregar o modificar fuentes

Para agregar nuevas fuentes, edita el archivo `netlify/functions/validate-news.js`:

```js
const MEDIA_DOMAINS = [
  "listindiario.com",
  // Agrega aquí nuevos dominios de medios
];

const OFFICIAL_DOMAINS = [
  "presidencia.gob.do",
  // Agrega aquí nuevos dominios oficiales
];
```

También actualiza los arrays `TRUSTED_MEDIA_SOURCES` y `TRUSTED_OFFICIAL_SOURCES` en `script.js` para que el frontend muestre el nombre correcto del medio en los chips de fuentes.
