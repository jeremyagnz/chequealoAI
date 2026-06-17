# chequealoAI

Página web simple para validar noticias de República Dominicana usando OpenAI (ChatGPT).

## Release

- 📦 **Primer release:** [v1.0.0 - Release Notes](./RELEASE_NOTES.md)

## Cómo usar

1. Configura la variable `OPENAI_API_KEY` en Netlify.
2. Abre el sitio desplegado o ejecútalo con Netlify Functions.
3. Pega un titular o texto de noticia en el buscador.
4. Pulsa **Validar noticia**.

> ⚠️ La API key no debe ponerse en el frontend ni escribirse en el navegador. Debe vivir solo como variable de entorno del servidor/Netlify Function.

La app devuelve:
- **Veredicto**: Real, Dudosa o Falsa
- **Resumen** de la validación
- **Razones**
- **Fuentes sugeridas** para confirmar

## Archivos principales

- `/index.html`: estructura de la página
- `/styles.css`: estilos de la interfaz
- `/script.js`: lógica del buscador y renderizado del resultado
- `/netlify/functions/validate-news.js`: proxy seguro hacia OpenAI

## Conexión con Netlify

Este repositorio ya incluye configuración base para desplegar en Netlify.

### 1) Conectar el repo

1. Entra a Netlify y selecciona **Add new site → Import an existing project**.
2. Autoriza GitHub y elige `jeremyagnz/chequealoAI`.
3. Netlify detectará el archivo `netlify.toml` automáticamente.

### 2) Variables de entorno

En **Site configuration → Environment variables**, agrega:

- `OPENAI_API_KEY`: tu clave de OpenAI

### 3) Functions

La app usa una Netlify Function en `/.netlify/functions/validate-news` para llamar a OpenAI desde el servidor.

### 4) Deploy

- Cada push a la rama principal desplegará el sitio en producción.
- Los pull requests generarán deploy previews automáticamente.
