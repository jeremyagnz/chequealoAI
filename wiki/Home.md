# ChequealoAI — Wiki

**ChequealoAI** es una herramienta web de verificación de noticias enfocada en República Dominicana. Usa inteligencia artificial (OpenAI GPT-4o-mini) junto con búsquedas en tiempo real (Serper API) para analizar titulares o textos y entregar un veredicto fundamentado.

---

## Índice

| Página | Descripción |
|--------|-------------|
| [Instalación y Configuración](Instalacion-y-Configuracion) | Cómo desplegar el proyecto localmente y en Netlify |
| [Arquitectura](Arquitectura) | Estructura de archivos y flujo de datos |
| [API y Backend](API-Backend) | Lógica de la Netlify Function y endpoints |
| [Funcionalidades](Funcionalidades) | Veredictos, métricas, historial y demo |
| [Fuentes Confiables](Fuentes-Confiables) | Medios y fuentes oficiales utilizadas |

---

## ¿Qué hace ChequealoAI?

1. El usuario ingresa un titular o texto de noticia.
2. El backend busca resultados relevantes en Google (vía Serper API).
3. OpenAI analiza la noticia cruzando los resultados de búsqueda con las fuentes confiables de RD.
4. Se devuelve un **veredicto** (`CONFIABLE`, `DUDOSA` o `FALSA`), una **puntuación** del 0 al 100, **razones** y **fuentes**.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend | Netlify Functions (Node.js) |
| IA | OpenAI API (`gpt-4o-mini`) |
| Búsqueda web | Serper API |
| Hosting | Netlify |

## Repositorio

```
chequealoAI/
├── index.html                          # Interfaz de usuario
├── styles.css                          # Estilos
├── script.js                           # Lógica frontend
├── netlify/
│   └── functions/
│       └── validate-news.js            # Proxy seguro hacia OpenAI + Serper
├── netlify.toml                        # Configuración de Netlify
└── wiki/                               # Esta documentación
```
