const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Obtiene la cotización del dólar del BNA desde el backend.
 * @returns {Promise<number|null>} El valor de venta del dólar billete o null si hay un error.
 */
export const getDolarRate = async () => {
    try {
        const response = await fetch(`${API_URL}/api/bna`);
        if (!response.ok) {
            throw new Error(`Error en la respuesta de la API: ${response.statusText}`);
        }
        const data = await response.json();
        if (data && data.venta_billete) {
            return data.venta_billete;
        }
        return null;
    } catch (error) {
        console.error('Error al obtener la cotización del dólar:', error);
        return null;
    }
};
