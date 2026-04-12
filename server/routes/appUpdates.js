module.exports = () => {
  const express = require('express');
  const router = express.Router();

  // Obtener información de actualización de la app
  // GET /api/app-updates
  router.get('/', (req, res) => {
    try {
      // Lee la versión desde package.json
      const packageJson = require('../package.json');
      const currentVersion = packageJson.version || '1.0.0';

      const updateInfo = {
        version: currentVersion,
        // URLs de descarga (configura según tu servidor)
        downloadUrl: `https://github.com/tu-usuario/tu-repo/releases/download/v${currentVersion}/app-release.apk`,
        releaseNotes: `Actualización a versión ${currentVersion}\n\nRevisa el changelog en: https://github.com/tu-usuario/tu-repo/releases`,
        isRequired: false, // true para forzar actualización
        minVersionRequired: '1.0.0' // versión mínima requerida
      };

      res.json(updateInfo);
    } catch (error) {
      console.error('Error fetching update info:', error);
      res.status(500).json({ error: 'Error fetching update information' });
    }
  });

  return router;
};
