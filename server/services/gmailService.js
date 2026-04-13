const { google } = require('googleapis');
const { createOAuthClient } = require('./gmailClient');
const { callClaude } = require('./claudeClient');

/**
 * Fetches recent bank emails and parses them using AI
 */
const syncBankEmails = async (userId, supabase) => {
    try {
        // 1. Get tokens for user
        const { data: integratedUser, error: dbError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'gmail')
            .single();

        if (dbError || !integratedUser) throw new Error('No Gmail integration found');

        const oauth2Client = createOAuthClient();
        oauth2Client.setCredentials(integratedUser.tokens);

        // Refresh token if needed
        oauth2Client.on('tokens', async (newTokens) => {
            await supabase
                .from('user_integrations')
                .upsert({
                    user_id: userId,
                    provider: 'gmail',
                    tokens: { ...integratedUser.tokens, ...newTokens },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, provider' });
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // 2. Search for bank emails in the last 24h (or since last sync)
        const query = 'from:(avisos@bancogalicia.com.ar OR no-reply@mercadopago.com.ar OR santander.com.ar OR bbva.com.ar) "transferencia" OR "pago" OR "compra"';
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 10
        });

        const messages = response.data.messages || [];
        const results = [];

        for (const msg of messages) {
            // Check if already processed (not implemented here, but should check a processed_ids table)
            const details = await gmail.users.messages.get({ userId: 'me', id: msg.id });
            const body = extractBody(details.data);

            if (body) {
                // 3. Parse with AI
                const movements = await parseEmailWithAI(body);
                if (movements && movements.length > 0) {
                    results.push(...movements.map(m => ({ ...m, source_id: msg.id })));
                }
            }
        }

        return results;

    } catch (err) {
        console.error('[GmailService] Error syncing emails:', err);
        throw err;
    }
};

const extractBody = (message) => {
    const payload = message.payload;
    if (payload.body.data) return Buffer.from(payload.body.data, 'base64').toString();
    if (payload.parts) {
        const part = payload.parts.find(p => p.mimeType === 'text/plain') || payload.parts[0];
        if (part.body && part.body.data) return Buffer.from(part.body.data, 'base64').toString();
    }
    return null;
};

const parseEmailWithAI = async (text) => {
    try {
        const aiResult = await callClaude({
            systemPrompt: `Eres un extractor de transacciones bancarias. Lee el texto de este EMAIL y extrae los movimientos.
Responde ÚNICAMENTE con un JSON válido: [{ "date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "currency": "ARS" | "USD" }]
Si no es un mail de movimiento bancario, responde [].`,
            userMessage: `Correo:
"""
${text.slice(0, 3000)}
"""`
        });

        const match = aiResult.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
    } catch (err) {
        console.error('[GmailService] AI Parse Error:', err);
        return [];
    }
};

module.exports = {
    syncBankEmails
};
