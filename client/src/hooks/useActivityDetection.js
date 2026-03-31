import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';

const StepService = registerPlugin('StepService');

const INACTIVITY_TIMEOUT_MS = 30_000; // 30 s sin movimiento → auto-stop

export const useActivityDetection = (session, API_URL) => {
    const [isTracking, setIsTracking] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [lastPosition, setLastPosition] = useState(null);
    const watchId = useRef(null);
    const pathRef = useRef([]);
    const inactivityTimer = useRef(null);
    const isTrackingRef = useRef(false);
    const startStepsRef = useRef(0);

    const resetInactivityTimer = (stopFn) => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            if (isTrackingRef.current) {
                toast.info('Actividad detenida automáticamente por inactividad');
                stopFn();
            }
        }, INACTIVITY_TIMEOUT_MS);
    };

    const startTracking = async () => {
        if (!Capacitor.isNativePlatform()) {
            console.warn('Seguimiento de ubicación solo disponible en dispositivos nativos');
            return;
        }

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

            // Capturar baseline de pasos al inicio de la caminata
            if (Capacitor.isNativePlatform()) {
                try {
                    const { steps: s } = await StepService.getStepCount();
                    startStepsRef.current = s || 0;
                } catch (e) {
                    startStepsRef.current = 0;
                }
            }

            watchId.current = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }, (position, err) => {
                if (err) {
                    console.error('Error in watchPosition:', err);
                    return;
                }
                if (position) {
                    const newPoint = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        timestamp: position.timestamp,
                        speed: position.coords.speed // in m/s
                    };

                    // Only add if moved > 5 meters or first point
                    if (pathRef.current.length === 0 || calculateDistance(pathRef.current[pathRef.current.length - 1], newPoint) > 5) {
                        pathRef.current = [...pathRef.current, newPoint];
                        setCurrentPath(pathRef.current);
                        setLastPosition(newPoint);
                        // Resetear timer solo cuando el usuario realmente se movió (>5m)
                        resetInactivityTimer(stopTrackingRef.current);
                    }
                }
            });

            // Arrancar el primer timer de inactividad
            resetInactivityTimer(stopTrackingRef.current);

            toast.success('Seguimiento de actividad iniciado');
        } catch (e) {
            console.error('Error starting location tracking:', e);
            toast.error(`Error GPS: ${e?.message || e?.code || JSON.stringify(e)}`);
        }
    };

    const stopTracking = async () => {
        if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
            inactivityTimer.current = null;
        }

        if (watchId.current) {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.clearWatch({ id: watchId.current });
            watchId.current = null;
        }

        isTrackingRef.current = false;

        if (pathRef.current.length > 5) {
            await saveWalkSession(pathRef.current);
        }

        setIsTracking(false);
        setLastPosition(null);
    };

    // Ref estable para que el timeout pueda llamar stopTracking sin capturar una closure vieja
    const stopTrackingRef = useRef(stopTracking);
    useEffect(() => { stopTrackingRef.current = stopTracking; });

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
            } catch (e) {
                console.warn('No se pudo obtener pasos del pedómetro:', e);
            }
        }

        try {
            const response = await fetch(`${API_URL}/api/activities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    start_time: startTime,
                    end_time: endTime,
                    distance,
                    path,
                    steps
                })
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

    const calculateDistance = (p1, p2) => {
        const R = 6371e3; // meters
        const phi1 = p1.lat * Math.PI / 180;
        const phi2 = p2.lat * Math.PI / 180;
        const dPhi = (p2.lat - p1.lat) * Math.PI / 180;
        const dLambda = (p2.lng - p1.lng) * Math.PI / 180;

        const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const calculateTotalDistance = (path) => {
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            total += calculateDistance(path[i], path[i + 1]);
        }
        return total;
    };

    return {
        isTracking,
        currentPath,
        lastPosition,
        startTracking,
        stopTracking
    };
};
