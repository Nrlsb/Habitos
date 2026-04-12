import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from './Modal';
import { Capacitor } from '@capacitor/core';

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');

  // IMPORTANTE: Actualiza esta versión cada vez que publiques una nueva APK
  // Debe coincidir con client/package.json
  const APP_VERSION = '1.2.1';
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      checkForUpdates();
      // Verificar cada 1 hora (3600000 ms)
      const interval = setInterval(checkForUpdates, 3600000);
      return () => clearInterval(interval);
    }
  }, [API_URL]);

  const checkForUpdates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/app-updates`);
      const data = await response.json();

      const remoteVersion = data.version;

      // Comparar versiones (simple: 1.2.1 > 1.2.0)
      if (isNewerVersion(remoteVersion, APP_VERSION)) {
        setUpdateInfo(data);
        setUpdateAvailable(true);
        setShowModal(true);
        toast.info('Nueva actualización disponible');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      // No mostrar error al usuario, es silencioso
    }
  };

  const isNewerVersion = (remoteVersion, currentVersion) => {
    const remote = remoteVersion.split('.').map(Number);
    const current = currentVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (remote[i] > (current[i] || 0)) return true;
      if (remote[i] < (current[i] || 0)) return false;
    }
    return false;
  };

  const handleDownload = async () => {
    if (!updateInfo?.downloadUrl) {
      toast.error('URL de descarga no disponible');
      return;
    }

    setIsDownloading(true);

    try {
      // Abre el navegador para descargar la APK
      // (Android lo descargará automáticamente y sugerirá instalación)
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: updateInfo.downloadUrl });

      toast.success('Descarga iniciada. Sigue las instrucciones para instalar.');
      setShowModal(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Error al descargar la actualización');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {showModal && updateInfo && (
        <Modal
          title="Actualización disponible"
          onClose={() => setShowModal(false)}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Nueva versión disponible: <strong>{updateInfo.version}</strong>
            </p>
            <p className="text-sm text-gray-400 whitespace-pre-wrap">
              {updateInfo.releaseNotes}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Más tarde
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex-1 px-4 py-2 bg-primary text-[#131f18] rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {isDownloading ? 'Descargando...' : 'Descargar ahora'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
