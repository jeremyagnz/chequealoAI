# chequealoAI

Página web simple para validar noticias de República Dominicana usando OpenAI (ChatGPT).

## Cómo usar

1. Abre el sitio desplegado o ejecuta localmente un servidor estático.
2. Escribe tu **OpenAI API Key** en el campo indicado.
3. Pega un titular o texto de noticia en el buscador.
4. Pulsa **Validar noticia**.

La app devuelve:
- **Veredicto**: Real, Dudosa o Falsa
- **Resumen** de la validación
- **Razones**
- **Fuentes sugeridas** para confirmar

## Archivos principales

- `/index.html`: estructura de la página
- `/styles.css`: estilos de la interfaz
- `/script.js`: lógica del buscador y llamada a OpenAI API

## Conexión con Netlify

Este repositorio ya incluye configuración base para desplegar en Netlify.

### 1) Conectar el repo

1. Entra a Netlify y selecciona **Add new site → Import an existing project**.
2. Autoriza GitHub y elige `jeremyagnz/chequealoAI`.
3. Netlify detectará el archivo `netlify.toml` automáticamente.

### 2) Variables de entorno (si aplica)

En **Site configuration → Environment variables**, agrega las variables que use tu app.

### 3) Deploy

- Cada push a la rama principal desplegará el sitio en producción.
- Los pull requests generarán deploy previews automáticamente.
