import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export const useActivityDetection = (session, API_URL) => {
    const [isTracking, setIsTracking] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [lastPosition, setLastPosition] = useState(null);
    const watchId = useRef(null);
    const pathRef = useRef([]);

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
            pathRef.current = [];
            setCurrentPath([]);

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

                    // Filter out noise (only add if moved > 5 meters or first point)
                    if (pathRef.current.length === 0 || calculateDistance(pathRef.current[pathRef.current.length - 1], newPoint) > 5) {
                        pathRef.current = [...pathRef.current, newPoint];
                        setCurrentPath(pathRef.current);
                        setLastPosition(newPoint);

                        // Check if we should auto-detect "walking" (speed > 0.5 m/s)
                        if (newPoint.speed > 0.5 && !isTracking) {
                            // Already tracking if this is running, but could trigger specific UI
                        }
                    }
                }
            });

            toast.success('Seguimiento de actividad iniciado');
        } catch (e) {
            console.error('Error starting location tracking:', e);
            toast.error('Error al iniciar el GPS. Asegúrate de tener instalado @capacitor/geolocation');
        }
    };

    const stopTracking = async () => {
        if (watchId.current) {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.clearWatch({ id: watchId.current });
            watchId.current = null;
        }

        if (pathRef.current.length > 5) {
            await saveWalkSession(pathRef.current);
        }

        setIsTracking(false);
        setLastPosition(null);
        toast.info('Seguimiento finalizado');
    };

    const saveWalkSession = async (path) => {
        if (!session?.access_token || !API_URL) return;

        const startTime = new Date(path[0].timestamp).toISOString();
        const endTime = new Date(path[path.length - 1].timestamp).toISOString();
        const distance = calculateTotalDistance(path);

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
                    steps: 0 // Will be updated by pedometer if available
                })
            });

            if (response.ok) {
                toast.success('Caminata guardada correctamente');
            }
        } catch (e) {
            console.error('Error saving walk session:', e);
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
