# arbitraje-usdt-ars (Deploy automático con GitHub Pages)

**No necesitás instalar nada**. Subí estos archivos a tu repo y GitHub Actions construye y publica.

## Pasos
1. Creá un repo vacío en GitHub (por ejemplo `arbitraje-usdt-ars`).
2. Subí todos los archivos de este ZIP a la raíz del repo (podés usar “Upload files”).
3. Editá `vite.config.ts` y asegurate que `base` quede en `/arbitraje-usdt-ars/` o el nombre exacto de tu repo.
4. En **Settings → Pages**: elegí **Source: GitHub Actions**.
5. Hacé un commit/push (o tocá un archivo y guardá). El workflow `Deploy to GitHub Pages` va a correr y publicar.
6. Tu sitio quedará en `https://<TU_USUARIO>.github.io/<NOMBRE_REPO>/`.

Si querés cambiar el nombre del repo, acordate de actualizar `base` en `vite.config.ts`.
