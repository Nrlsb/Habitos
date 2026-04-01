import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';

const StepService = registerPlugin('StepService');
const LocationTracking = registerPlugin('LocationTracking');

// Solo para fallback web — en Android nativo el servicio maneja el timeout
const INACTIVITY_TIMEOUT_MS = 5 * 60_000;

export const useActivityDetection = (session, API_URL) => {
    const [isTracking, setIsTracking] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [lastPosition, setLastPosition] = useState(null);

    // Refs compartidos
    const startStepsRef = useRef(0);
    const sessionEndedRef = useRef(false); // guard contra doble ejecución

    // Refs para listeners nativos
    const locationListenerRef = useRef(null);
    const stoppedListenerRef = useRef(null);

    // Refs para fallback web
    const watchId = useRef(null);
    const pathRef = useRef([]);
    const inactivityTimer = useRef(null);
    const isTrackingRef = useRef(false);

    // ─── Nativo (Android Foreground Service) ─────────────────────────────────

    const startTrackingNative = async () => {
        sessionEndedRef.current = false;
        pathRef.current = [];
        setCurrentPath([]);

        // Capturar baseline de pasos al inicio
        try {
            const { steps: s } = await StepService.getStepCount();
            startStepsRef.current = s || 0;
        } catch {
            startStepsRef.current = 0;
        }

        // Listener de actualizaciones en tiempo real (para mostrar mapa mientras camina)
        locationListenerRef.current = await LocationTracking.addListener('locationUpdate', (data) => {
            const point = { lat: data.lat, lng: data.lng, timestamp: data.timestamp, speed: data.speed };
            pathRef.current = [...pathRef.current, point];
            setCurrentPath([...pathRef.current]);
            setLastPosition(point);
        });

        // Listener de auto-stop por inactividad (5 min sin movimiento)
        stoppedListenerRef.current = await LocationTracking.addListener('trackingStopped', async (data) => {
            toast.info('Caminata guardada automáticamente (5 min sin movimiento)');
            await handleSessionEnd(data.path || []);
        });

        try {
            await LocationTracking.startTracking();
            setIsTracking(true);
            isTrackingRef.current = true;
            toast.success('Seguimiento de actividad iniciado');
        } catch (e) {
            // Limpiar listeners si el arranque falla
            await removeNativeListeners();
            console.error('Error starting native tracking:', e);
            toast.error(`Error GPS: ${e?.message || JSON.stringify(e)}`);
        }
    };

    const stopTrackingNative = async () => {
        try {
            const result = await LocationTracking.stopTracking();
            await removeNativeListeners();
            await handleSessionEnd(result?.path || []);
        } catch (e) {
            console.error('Error stopping native tracking:', e);
            await removeNativeListeners();
            setIsTracking(false);
            isTrackingRef.current = false;
        }
    };

    const handleSessionEnd = async (path) => {
        // Guard: evitar que inactivity + stopTracking manual ejecuten esto dos veces
        if (sessionEndedRef.current) return;
        sessionEndedRef.current = true;

        setIsTracking(false);
        isTrackingRef.current = false;
        setCurrentPath([]);
        setLastPosition(null);
        pathRef.current = [];

        if (path && path.length > 5) {
            await saveWalkSession(path);
        }
    };

    const removeNativeListeners = async () => {
        if (locationListenerRef.current) {
            try { await locationListenerRef.current.remove(); } catch {}
            locationListenerRef.current = null;
        }
        if (stoppedListenerRef.current) {
            try { await stoppedListenerRef.current.remove(); } catch {}
            stoppedListenerRef.current = null;
        }
    };

    // ─── Fallback Web (Capacitor Geolocation) ─────────────────────────────────

    const resetInactivityTimer = (stopFn) => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            if (isTrackingRef.current) {
                toast.info('Caminata guardada automáticamente (5 min sin movimiento)');
                stopFn();
            }
        }, INACTIVITY_TIMEOUT_MS);
    };

    const startTrackingWeb = async () => {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const permissions = await Geolocation.requestPermissions();
            if (permissions.location !== 'granted') {
                toast.error('Permiso de ubicación denegado');
                return;
            }

            setIsTracking(true);
            isTrackingRef.current = true;
            pathRef.current = [];
            setCurrentPath([]);

            watchId.current = await Geolocation.watchPosition({
                enableHighAccuracy: true, timeout: 10000, maximumAge: 5000
            }, (position, err) => {
                if (err || !position) return;
                const newPoint = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: position.timestamp,
                    speed: position.coords.speed
                };
                if (pathRef.current.length === 0 ||
                    calculateDistance(pathRef.current[pathRef.current.length - 1], newPoint) > 5) {
                    pathRef.current = [...pathRef.current, newPoint];
                    setCurrentPath(pathRef.current);
                    setLastPosition(newPoint);
                    resetInactivityTimer(stopTrackingRef.current);
                }
            });

            resetInactivityTimer(stopTrackingRef.current);
            toast.success('Seguimiento de actividad iniciado');
        } catch (e) {
            console.error('Error starting web tracking:', e);
            toast.error(`Error GPS: ${e?.message || e?.code || JSON.stringify(e)}`);
        }
    };

    const stopTrackingWeb = async () => {
        if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); inactivityTimer.current = null; }
        if (watchId.current) {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.clearWatch({ id: watchId.current });
            watchId.current = null;
        }
        isTrackingRef.current = false;
        if (pathRef.current.length > 5) await saveWalkSession(pathRef.current);
        setIsTracking(false);
        setLastPosition(null);
    };

    // ─── API pública ──────────────────────────────────────────────────────────

    const startTracking = async () => {
        if (!Capacitor.isNativePlatform()) {
            console.warn('Seguimiento de ubicación solo disponible en dispositivos nativos');
            return;
        }
        await startTrackingNative();
    };

    const stopTracking = async () => {
        if (Capacitor.isNativePlatform()) {
            await stopTrackingNative();
        } else {
            await stopTrackingWeb();
        }
    };

    // Ref estable para que el timeout web pueda llamar stopTracking sin closure vieja
    const stopTrackingRef = useRef(stopTracking);
    useEffect(() => { stopTrackingRef.current = stopTracking; });

    // ─── Guardar sesión ───────────────────────────────────────────────────────

    const saveWalkSession = async (path) => {
        if (!session?.access_token || !API_URL) return;

        const startTime = new Date(path[0].timestamp).toISOString();
        const endTime = new Date(path[path.length - 1].timestamp).toISOString();
        const distance = calculateTotalDistance(path);

        let steps = 0;
        if (Capacitor.isNativePlatform()) {
            try {
                const { steps: s } = await StepService.getStepCount();
                steps = Math.max(0, (s || 0) - startStepsRef.current);
            } catch {
                console.warn('No se pudo obtener pasos del pedómetro');
            }
        }

        try {
            const response = await fetch(`${API_URL}/api/activities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ start_time: startTime, end_time: endTime, distance, path, steps })
            });
            if (response.ok) {
                toast.success('Caminata guardada correctamente');
            } else {
                toast.error('Error al guardar la caminata');
            }
        } catch (e) {
            console.error('Error saving walk session:', e);
            toast.error('Error al guardar la caminata');
        }
    };

    // ─── Helpers de distancia ─────────────────────────────────────────────────

    const calculateDistance = (p1, p2) => {
        const R = 6371e3;
        const phi1 = p1.lat * Math.PI / 180;
        const phi2 = p2.lat * Math.PI / 180;
        const dPhi = (p2.lat - p1.lat) * Math.PI / 180;
        const dLambda = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const calculateTotalDistance = (path) => {
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) total += calculateDistance(path[i], path[i + 1]);
        return total;
    };

    return { isTracking, currentPath, lastPosition, startTracking, stopTracking };
};
