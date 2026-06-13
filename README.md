# chequealoAI

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
