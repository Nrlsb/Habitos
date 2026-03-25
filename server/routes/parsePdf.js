const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Solo se aceptan archivos PDF'));
    }
});

// Normalize Argentine amount string to float
// Handles: "1.234,56" → 1234.56  |  "1234.56" → 1234.56  |  "1234" → 1234
function parseArgAmount(str) {
    if (!str) return null;
    const s = str.trim().replace(/\$/g, '').replace(/\s/g, '');
    // Argentine format: 1.234,56
    if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    // Standard float
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
}

// Try to detect the bank from the PDF text
function detectBank(text) {
    const t = text.toLowerCase();
    if (t.includes('galicia')) return 'galicia';
    if (t.includes('bbva') || t.includes('francés')) return 'bbva';
    if (t.includes('santander')) return 'santander';
    if (t.includes('hsbc')) return 'hsbc';
    if (t.includes('icbc')) return 'icbc';
    if (t.includes('naranja')) return 'naranja';
    if (t.includes('mercado pago') || t.includes('mercadopago')) return 'mercadopago';
    if (t.includes('uala') || t.includes('ualá')) return 'uala';
    if (t.includes('brubank')) return 'brubank';
    if (t.includes('macro')) return 'macro';
    if (t.includes('nación') || t.includes('bna') || t.includes('banco de la nacion')) return 'bna';
    if (t.includes('provincia') || t.includes('bapro')) return 'bapro';
    return 'generic';
}

// Convert DD/MM/YYYY or DD/MM to ISO date string
function parseDateArg(dateStr, yearHint) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length < 2) return null;
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2] ? parseInt(parts[2]) : null;
    if (!year) year = yearHint || new Date().getFullYear();
    if (year < 100) year += 2000;
    // Validate
    if (parseInt(month) < 1 || parseInt(month) > 12) return null;
    if (parseInt(day) < 1 || parseInt(day) > 31) return null;
    return `${year}-${month}-${day}`;
}

// Extract year hint from text (look for 4-digit years between 2020-2030)
function extractYearHint(text) {
    const match = text.match(/20(2[0-9]|3[0-0])/);
    return match ? parseInt(match[0]) : new Date().getFullYear();
}

// Words/phrases to skip when they appear as the full description (header/footer rows)
const SKIP_KEYWORDS = [
    'fecha', 'descripcion', 'descripción', 'comercio', 'importe', 'monto',
    'total', 'subtotal', 'saldo', 'cuotas', 'cuota', 'pago mínimo', 'pago minimo',
    'vencimiento', 'resumen', 'período', 'periodo', 'número de cuenta',
    'titular', 'limite', 'límite', 'disponible', 'deuda', 'pesos', 'dolares',
    'dólares', 'moneda', 'tipo', 'código', 'codigo', 'referencia', 'nro',
    'apertura', 'cierre', 'débitos', 'creditos', 'créditos', 'debitos',
    'anterior', 'nuevos', 'ajustes', 'bonificaciones', 'intereses', 'cargos',
    'extrafinanciero', 'financiero', 'tel.', 'teléfono', 'tel', 'whatsapp',
    'atención al cliente', 'atencion al cliente', 'página', 'pagina', 'de '
];

function shouldSkipLine(desc) {
    if (!desc || desc.length < 2) return true;
    const d = desc.toLowerCase().trim();
    if (SKIP_KEYWORDS.some(kw => d === kw || d.startsWith(kw + ' ') || d.endsWith(' ' + kw))) return true;
    // Skip if purely numeric
    if (/^\d+$/.test(d)) return true;
    // Skip very short lines (single char/digit)
    if (d.length < 3) return true;
    return false;
}

/**
 * Generic line-by-line parser that looks for patterns:
 *   DD/MM[/YYYY]  description...  amount
 * or
 *   description...  DD/MM[/YYYY]  amount
 */
function parseGeneric(text) {
    const yearHint = extractYearHint(text);
    const transactions = [];

    // Pattern 1: line starts with date DD/MM or DD/MM/YYYY
    // e.g.: "15/03/2026  MERCADO PAGO *TIENDA  12.345,67"
    const dateFirstPattern = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+([\d.,]+)\s*$/;

    // Pattern 2: date anywhere in line + amount at end
    const dateAnyPattern = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+([\d.,]+)\s*$/;

    // Pattern 3: description then date then amount (some banks)
    const descDateAmtPattern = /^(.+?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+([\d.,]+)\s*$/;

    const lines = text.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        let date = null, description = null, amount = null;

        // Try pattern 1 first
        let m = line.match(dateFirstPattern);
        if (m) {
            date = parseDateArg(m[1], yearHint);
            description = m[2].trim();
            amount = parseArgAmount(m[3]);
        }

        // Try pattern 3 (desc + date + amount)
        if (!date) {
            m = line.match(descDateAmtPattern);
            if (m) {
                description = m[1].trim();
                date = parseDateArg(m[2], yearHint);
                amount = parseArgAmount(m[3]);
            }
        }

        // Try pattern 2 as fallback
        if (!date) {
            m = line.match(dateAnyPattern);
            if (m) {
                date = parseDateArg(m[1], yearHint);
                description = m[2].trim();
                amount = parseArgAmount(m[3]);
            }
        }

        if (date && description && amount && amount > 0) {
            if (shouldSkipLine(description)) continue;
            // Avoid duplicates with exact same date+description+amount
            const isDup = transactions.some(t =>
                t.date === date && t.description === description && t.amount === amount
            );
            if (!isDup) {
                transactions.push({ date, description, amount, currency: 'ARS' });
            }
        }
    }

    return transactions;
}

module.exports = (authenticateUser) => {
    router.post('/', authenticateUser, upload.single('pdf'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No se recibió ningún PDF' });

            // Debug: Log the imported module to identify the correct export pattern
            console.log('pdf-parse module type:', typeof pdfParse);
            if (typeof pdfParse !== 'function') {
                console.log('pdf-parse keys:', Object.keys(pdfParse || {}));
            }

            // Fallback strategy to find the function in the imported module
            const parseFn = (typeof pdfParse === 'function') ? pdfParse : (pdfParse?.default || pdfParse?.pdfParse);

            if (typeof parseFn !== 'function') {
                throw new Error('No se pudo encontrar la función de parseo en el módulo pdf-parse. El tipo detectado es: ' + typeof pdfParse);
            }

            const data = await parseFn(req.file.buffer);
            const text = data.text;

            if (!text || text.trim().length < 10) {
                return res.status(422).json({ error: 'No se pudo extraer texto del PDF. Es posible que esté escaneado como imagen.' });
            }

            const bank = detectBank(text);
            const transactions = parseGeneric(text);

            res.json({
                bank,
                totalPages: data.numpages,
                rawTextPreview: text.slice(0, 500),
                transactions
            });
        } catch (err) {
            console.error('PDF parse error:', err);
            res.status(500).json({ error: 'Error al procesar el PDF: ' + err.message });
        }
    });

    return router;
};
