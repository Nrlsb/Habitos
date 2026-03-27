import { useEffect, useRef } from 'react';

const WalkingMap = ({ path, height = '300px' }) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        if (!window.L || !mapRef.current) return;

        // Initialize map if not already done
        if (!mapInstance.current) {
            mapInstance.current = window.L.map(mapRef.current, {
                zoomControl: false,
                attributionControl: false
            });

            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
            }).addTo(mapInstance.current);
        }

        const L = window.L;
        const map = mapInstance.current;

        // Clear existing layers (markers/polylines)
        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        if (path && path.length > 0) {
            const latLngs = path.map(p => [p.lat, p.lng]);

            // Draw route
            const polyline = L.polyline(latLngs, {
                color: '#2ecc70',
                weight: 5,
                opacity: 0.8,
                lineJoin: 'round'
            }).addTo(map);

            // Add start/end markers
            L.circleMarker(latLngs[0], {
                radius: 6,
                fillColor: '#60a5fa',
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            L.circleMarker(latLngs[latLngs.length - 1], {
                radius: 8,
                fillColor: '#ef4444',
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            // Fit bounds
            map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
        } else {
            // Default view if no path
            map.setView([-34.6037, -58.3816], 13); // Buenos Aires default
        }

        // Cleanup on unmount
        return () => {
            // We keep the instance alive but could destroy it if needed
        };
    }, [path]);

    return (
        <div
            ref={mapRef}
            className="w-full rounded-[24px] overflow-hidden border border-white/5 shadow-glass"
            style={{ height }}
        />
    );
};

export default WalkingMap;
