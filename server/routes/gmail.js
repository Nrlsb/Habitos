const express = require('express');
const router = express.Router();
const { createOAuthClient, GMAIL_SCOPES } = require('../services/gmailClient');
const { syncBankEmails } = require('../services/gmailService');

module.exports = (supabase, authenticateUser) => {

    // 1. Redirect to Google Auth
    router.get('/auth', authenticateUser, (req, res) => {
        const oauth2Client = createOAuthClient();

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Required for refresh token
            scope: GMAIL_SCOPES,
            prompt: 'consent', // Ensure we get refresh token every time during setup
            state: req.user.id // Pass user ID to identify them in callback
        });

        res.json({ url });
    });

    // 2. Callback from Google
    router.get('/callback', async (req, res) => {
        const { code, state: userId } = req.query;
        if (!code) return res.status(400).send('No code provided');

        try {
            const oauth2Client = createOAuthClient();
            const { tokens } = await oauth2Client.getToken(code);

            // Save tokens to DB for this user
            // Note: We use upsert into user_integrations table
            const { error } = await supabase
                .from('user_integrations')
                .upsert({
                    user_id: userId,
                    provider: 'gmail',
                    tokens: tokens,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, provider' });

            if (error) {
                console.error('Error saving Gmail tokens:', error.message);
                return res.status(500).send('Error vinculando cuenta de Google');
            }

            // Success page (simple HTML or redirect to frontend)
            res.send(`
                <html>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #131f18; color: white;">
                        <div style="text-align: center; border: 1px solid #c8ff0033; padding: 40px; rounded: 20px; background: #ffffff05;">
                            <h2 style="color: #c8ff00;">¡Conexión Exitosa!</h2>
                            <p>Tu cuenta de Gmail ha sido vinculada correctamente.</p>
                            <p style="font-size: 0.8em; color: #888;">Ya podés cerrar esta pestaña y volver a la app.</p>
                        </div>
                    </body>
                </html>
            `);
        } catch (err) {
            console.error('Gmail OAuth Callback Error:', err);
            res.status(500).send('Error durante la autenticación');
        }
    });

    // 3. Sync Emails
    router.get('/sync', authenticateUser, async (req, res) => {
        try {
            const movements = await syncBankEmails(req.user.id, supabase);
            res.json({ transactions: movements });
        } catch (err) {
            console.error('Gmail Sync Error:', err);
            res.status(500).json({ error: 'Fallo al sincronizar con Gmail: ' + err.message });
        }
    });

    return router;
};
