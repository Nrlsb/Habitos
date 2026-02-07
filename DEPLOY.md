# Guia de Despliegue a Produccion

Esta guia te ayudara a subir tu aplicacion a Render (Backend) y Vercel (Frontend) paso a paso.

## 1. Backend (Render)

1.  Crea una cuenta en [Render.com](https://render.com).
2.  Haz clic en **New +** -> **Web Service**.
3.  Conecta tu repositorio de GitHub.
4.  Selecciona el repositorio `Habitos` (o como lo hayas llamado).
5.  Configura lo siguiente:
    *   **Name**: `habitos-backend`
    *   **Root Directory**: `server`
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
6.  Ve a la seccion **Environment Variables** y agrega las siguientes claves y valores (copiados de tu `.env` local):

| Clave (Key) | Valor (Value) |
| :--- | :--- |
| `SUPABASE_URL` | `https://ljfwybbzxtqvtzjixjwl.supabase.co` |
| `SUPABASE_KEY` | *(Tu Service Role Key - empieza con `py`...)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Tu Service Role Key - empieza con `py`...)* |
| `NODE_ENV` | `production` |

7.  Haz clic en **Create Web Service**.
8.  Espera a que termine. Copia la URL que te da Render (ej: `https://habitos-backend.onrender.com`).

---

## 2. Frontend (Vercel)

1.  Crea una cuenta en [Vercel.com](https://vercel.com).
2.  Haz clic en **Add New...** -> **Project**.
3.  Importa tu repositorio de GitHub.
4.  Configuracion del Proyecto:
    *   **Root Directory**: Edita y selecciona `client`.
    *   **Framework Preset**: Vite.
5.  Ve a **Environment Variables** y agrega:

| Clave (Key) | Valor (Value) |
| :--- | :--- |
| `VITE_API_URL` | *(La URL de Render que copiaste antes)* |
| `VITE_SUPABASE_URL` | `https://ljfwybbzxtqvtzjixjwl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZnd5YmJ6eHRxdnR6aml4andsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU5NzU5NTQsImV4cCI6MjA4MTkxNTk1NH0.5-ZgMOca0TUKMIooBTFolwabj8h9fLguwtP5l1bR-I8c` |

6.  Haz clic en **Deploy**.

---

## 3. Actualizar App Android (Para que funcione con 4G)

Una vez que el backend este en Render:

1.  Edita `client/.env` en tu computadora.
2.  Cambia `VITE_API_URL` por la URL de Render (`https://habitos-backend.onrender.com`).
3.  Ejecuta:
    ```bash
    cd client
    npm run build
    npx cap sync android
    ```
4.  Instala la app en tu celular desde Android Studio. ¡Ahora se conectara a la nube!
