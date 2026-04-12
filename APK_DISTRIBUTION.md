# Distribución de APK - Mis Hábitos & Gastos

## Arquitectura

- **Backend**: Endpoint `/api/app-updates` que devuelve la versión actual
- **Frontend**: Componente `UpdateChecker.jsx` que verifica actualizaciones al abrir la app
- **Distribución**: GitHub Releases (gratuito) o servidor propio
- **Descarga**: Manual dentro de la app (abre navegador para descargar)

---

## 1️⃣ Configurar versión

Cada vez que lances una actualización, actualiza la versión en:

**`client/package.json`**:
```json
{
  "version": "1.2.2"  // Incrementar versión
}
```

**`client/src/components/UpdateChecker.jsx`**:
```javascript
const APP_VERSION = '1.2.2'; // Debe coincidir con package.json
```

---

## 2️⃣ Compilar APK

### Opción A: Local
```bash
cd client
npm run build
npx cap build android --release

# La APK estará en: client/android/app/build/outputs/apk/release/
```

### Opción B: Con Android Studio
1. Abre `client/android` en Android Studio
2. Build → Build Bundle(s) / APK(s) → Build APK(s)
3. Localiza en `client/android/app/build/outputs/apk/release/app-release.apk`

---

## 3️⃣ Publicar en GitHub Releases

### Requisitos
- Cuenta GitHub con el repo
- `gh` CLI instalado (`brew install gh` o descargar de github.com/cli/cli)

### Publicar nueva versión

```bash
# 1. Crear tag de versión
git tag v1.2.2

# 2. Crear release en GitHub
gh release create v1.2.2 \
  --title "Versión 1.2.2" \
  --notes "Cambios:\n- Fix: bug X\n- Mejora: feature Y" \
  client/android/app/build/outputs/apk/release/app-release.apk

# 3. O con archivo local:
gh release upload v1.2.2 ./app-release.apk
```

---

## 4️⃣ Configurar URLs en la app

### Backend (`server/routes/appUpdates.js`)
Actualizar la URL de descarga:

```javascript
downloadUrl: `https://github.com/tu-usuario/tu-repo/releases/download/v${currentVersion}/app-release.apk`,
```

**Reemplaza:**
- `tu-usuario`: Tu usuario de GitHub
- `tu-repo`: Nombre del repositorio

### Frontend (`client/src/components/UpdateChecker.jsx`)
- `APP_VERSION`: Debe coincidir con `package.json`
- `API_URL`: Usa `VITE_API_URL` o localhost

---

## 5️⃣ Variables de entorno

### `.env` (raíz o server/)
```env
VITE_API_URL=https://tu-servidor.com
```

### `.env.production`
```env
VITE_API_URL=https://tu-servidor-produccion.com
```

---

## 6️⃣ Flujo de actualización (usuario)

1. Usuario abre la app
2. `UpdateChecker` verifica `/api/app-updates`
3. Si hay versión más reciente → modal "Nueva actualización disponible"
4. Usuario hace clic en "Descargar ahora"
5. Se abre navegador y descarga APK de GitHub Releases
6. Android sugiere instalar la APK
7. Usuario instala y actualiza

---

## 7️⃣ Testear localmente

```bash
# 1. Compilar con versión más nueva
# (Cambiar APP_VERSION en UpdateChecker.jsx a 1.2.2)

# 2. Instalar en emulador
npx cap run android

# 3. Abrir DevTools (F12) → Network
# Deberías ver solicitud a /api/app-updates

# 4. Verificar en Console que detecta actualización
```

---

## ⚠️ Notas importantes

- **APK debe estar públicamente accesible** (GitHub Releases lo es automáticamente)
- **La URL de descarga debe ser directa** (sin redirecciones)
- **Versión en package.json debe coincidir con tag de GitHub** (v1.2.2)
- **Recomendación**: Pausa 1-2 horas entre test y release para evitar falsos positivos

---

## Alternativas

### Servidor propio
Si prefieres no usar GitHub Releases:
1. Alojar APK en tu servidor (ej: Vercel, Heroku, etc.)
2. Cambiar `downloadUrl` en `appUpdates.js`
3. Asegurar que es HTTPS y accesible públicamente

### Firebase App Distribution
Para testing (closed/open beta):
```bash
firebase app-distribution:distribute app-release.apk \
  --app=1:123456789:android:abc... \
  --groups="testers" \
  --release-notes="v1.2.2"
```

---

## Checklist para cada release

- [ ] Actualizar versión en `client/package.json`
- [ ] Actualizar `APP_VERSION` en `UpdateChecker.jsx`
- [ ] Compilar APK (release)
- [ ] Crear git tag: `git tag v1.2.2`
- [ ] Crear GitHub Release con APK adjunto
- [ ] Verificar URL en `appUpdates.js` (descarga correcta)
- [ ] Testear en emulador/dispositivo
- [ ] Publicar en GitHub Releases
