# Instalación y Configuración

## Requisitos previos

- Cuenta en [Netlify](https://netlify.com)
- Clave de API de [OpenAI](https://platform.openai.com)
- Clave de API de [Serper](https://serper.dev) _(opcional pero recomendada — mejora la búsqueda de fuentes)_

---

## Despliegue en Netlify (recomendado)

### 1. Conectar el repositorio

1. Inicia sesión en [Netlify](https://app.netlify.com).
2. Haz clic en **Add new site → Import an existing project**.
3. Autoriza GitHub y selecciona el repositorio `jeremyagnz/chequealoAI`.
4. Netlify detectará automáticamente el archivo `netlify.toml`.
5. Haz clic en **Deploy site**.

### 2. Variables de entorno

En **Site configuration → Environment variables**, agrega las siguientes variables:

| Variable | Descripción | Obligatoria |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | Clave secreta de OpenAI | ✅ Sí |
| `SERPER_API_KEY` | Clave de Serper (búsqueda web) | Recomendada |

> ⚠️ **Nunca** pongas estas claves en el frontend ni en el código fuente. Deben vivir **solo** como variables de entorno del servidor.

### 3. Redeploy

Después de agregar las variables de entorno, haz clic en **Trigger deploy → Deploy site** para que los cambios surtan efecto.

---

## Ejecución local con Netlify CLI

### 1. Instalar Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. Clonar el repositorio

```bash
git clone https://github.com/jeremyagnz/chequealoAI.git
cd chequealoAI
```

### 3. Configurar variables de entorno locales

Crea un archivo `.env` en la raíz del proyecto (o usa `netlify.toml` local):

```
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
```

> ⚠️ Agrega `.env` a tu `.gitignore` para no exponer las claves.

### 4. Iniciar el servidor de desarrollo

```bash
netlify dev
```

Esto levanta la aplicación en `http://localhost:8888` con las Netlify Functions disponibles en `/.netlify/functions/`.

---

## Flujo de despliegue continuo

| Evento | Resultado |
|--------|-----------|
| Push a `main` | Deploy automático a producción |
| Pull Request | Deploy preview automático |

---

## Configuración de `netlify.toml`

```toml
[build]
  publish = "."          # Publica el contenido estático desde la raíz

[functions]
  directory = "netlify/functions"   # Directorio de las Netlify Functions
```
