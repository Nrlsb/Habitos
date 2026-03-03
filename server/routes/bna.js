const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

const URL_BNA = 'https://www.bna.com.ar/Personas';

let bnaCache = { data: null, timestamp: null };
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutos

const limpiarTexto = (texto) => {
    if (!texto) return null;
    return texto.replace(/\n/g, '').trim();
};

const parsearFormatoBillete = (valor) => {
    if (!valor) return null;
    return parseFloat(valor.replace(/\./g, '').replace(',', '.'));
};

const parsearFormatoDivisa = (valor) => {
    if (!valor) return null;
    return parseFloat(valor.replace(/,/g, ''));
};

router.get('/', async (req, res) => {
    const now = Date.now();

    if (bnaCache.data && (now - bnaCache.timestamp < CACHE_DURATION_MS)) {
        res.setHeader('X-Cache-Hit', 'true');
        return res.json(bnaCache.data);
    }

    try {
        const { data: html } = await axios.get(URL_BNA, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(html);

        const tablaBilletes = $('#billetes');
        const filaDolarBillete = tablaBilletes.find('tbody tr').first();
        const billeteVenta = limpiarTexto(filaDolarBillete.find('td').eq(2).text());

        const tablaDivisas = $('#divisas');
        const filaDolarDivisa = tablaDivisas.find('tbody tr').first();
        const divisaVenta = limpiarTexto(filaDolarDivisa.find('td').eq(2).text());

        const respuesta = {
            status: 'ok',
            fecha_actualizacion: new Date(now).toISOString(),
            banco: 'Banco de la Nación Argentina',
            venta_billete: parsearFormatoBillete(billeteVenta),
            venta_divisa: parsearFormatoDivisa(divisaVenta)
        };

        bnaCache.data = respuesta;
        bnaCache.timestamp = now;

        res.setHeader('X-Cache-Hit', 'false');
        res.json(respuesta);
    } catch (error) {
        console.error('Error al obtener cotizaciones BNA:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'No se pudo obtener la cotización del BNA',
            details: error.message
        });
    }
});

module.exports = () => router;
