const express = require('express');
const { callClaude, callClaudeWithHistory, getCached, setCache } = require('../services/claudeClient');

module.exports = (supabase, authenticateUser) => {
    const router = express.Router();

    // ─── 1. POST /api/ai/categorize ───────────────────────────────────────
    // Categorize an expense description
    router.post('/categorize', authenticateUser, async (req, res) => {
        const { description } = req.body;

        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'description required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        const cacheKey = `cat:${description.toLowerCase().trim()}`;
        const cached = getCached(cacheKey, 24 * 60 * 60 * 1000); // 24h

        if (cached) {
            return res.json({ category: cached, cached: true });
        }

        try {
            const CATEGORIES = [
                'General', 'Comida', 'Transporte', 'Servicios', 'Alquiler',
                'Supermercado', 'Mascota', 'Hogar', 'Viandas', 'Alcohol', 'Ocio',
                'Salud', 'Ropa', 'Educación', 'Otros'
            ];

            const result = await callClaude({
                systemPrompt: `Eres un categorizador de gastos financieros para usuarios argentinos.
Tu única tarea es elegir la categoría más apropiada para una descripción de gasto.
Categorías disponibles: ${CATEGORIES.join(', ')}.
Responde ÚNICAMENTE con el nombre exacto de la categoría, sin explicaciones ni puntuación adicional.`,
                userMessage: `Descripción del gasto: "${description}"`,
                maxTokens: 20
            });

            const normalizedResult = result.trim();
            const category = CATEGORIES.find(c => normalizedResult === c) || 'General';

            setCache(cacheKey, category);
            res.json({ category });
        } catch (err) {
            console.error('[AI/categorize] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message, fallback: 'General' });
        }
    });

    // ─── 2. POST /api/ai/expense-insights ────────────────────────────────
    // Analyze expenses and provide insights
    router.post('/expense-insights', authenticateUser, async (req, res) => {
        const { expenses, month, dolarRate } = req.body;

        if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
            return res.json({ insights: null, anomalies: [], recommendations: [], score: 0 });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        const cacheKey = `exp-insights:${req.user.id}:${month}`;
        const cached = getCached(cacheKey, 4 * 60 * 60 * 1000); // 4h

        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        try {
            // Prepare compact summary
            const catTotals = expenses.reduce((acc, e) => {
                const amt = e.currency === 'USD' ? e.amount * (dolarRate || 1) : e.amount;
                acc[e.category || 'General'] = (acc[e.category || 'General'] || 0) + amt;
                return acc;
            }, {});

            const topExpenses = [...expenses]
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5)
                .map(e => ({
                    desc: e.description.substring(0, 30),
                    amount: e.amount,
                    currency: e.currency,
                    category: e.category
                }));

            const totalARS = Object.values(catTotals).reduce((a, b) => a + b, 0);

            const contextStr = JSON.stringify({
                month,
                totalARS: Math.round(totalARS),
                catTotals: Object.entries(catTotals).map(([cat, amt]) => ({
                    category: cat,
                    amount: Math.round(amt)
                })),
                topExpenses,
                count: expenses.length
            });

            const result = await callClaude({
                systemPrompt: `Eres un asesor financiero personal para usuarios argentinos.
Analiza gastos y provee insights accionables y breves.
Responde en español argentino, en formato JSON con esta estructura exacta:
{ "insights": "resumen en 2-3 oraciones", "recommendations": ["rec1","rec2","rec3"], "anomalies": [{"description":"...","reason":"..."}], "score": <0-100> }
El score es una calificación de salud financiera del mes (100 = excelente, 0 = crítica).
Sé conciso y práctico.`,
                userMessage: `Analiza estos gastos del mes ${month}: ${contextStr}`,
                maxTokens: 800
            });

            // Safe JSON parsing
            const match = result.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Invalid JSON in response');

            const parsed = JSON.parse(match[0]);
            setCache(cacheKey, parsed);
            res.json(parsed);
        } catch (err) {
            console.error('[AI/expense-insights] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message });
        }
    });

    // ─── 3. POST /api/ai/chat ─────────────────────────────────────────────
    // Chat with financial advisor
    router.post('/chat', authenticateUser, async (req, res) => {
        const { messages, context } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        try {
            // Prepare compact context summary
            const ctxSummary = context ? JSON.stringify({
                totalGastosMes: Math.round(context.totalGastosMes || 0),
                topCategoria: context.topCategoria || 'N/A',
                habitosActivos: context.habitosActivos || 0,
                rachaMaxima: context.rachaMaxima || 0
            }) : '{}';

            // Keep last 10 messages for context
            const recentMessages = messages.slice(-10);

            const response = await callClaudeWithHistory({
                systemPrompt: `Eres un asesor financiero y coach de hábitos personal para el usuario.
Tienes acceso a sus datos financieros y de hábitos.
Contexto del usuario: ${ctxSummary}
Responde siempre en español argentino, de forma concisa y práctica (máx 150 palabras por respuesta).
Si te preguntan algo fuera de finanzas o hábitos, redirige amablemente al tema.
Sé amigable y empático.`,
                messages: recentMessages,
                maxTokens: 400
            });

            res.json({ reply: response });
        } catch (err) {
            console.error('[AI/chat] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message });
        }
    });

    // ─── 4. POST /api/ai/habit-prediction ────────────────────────────────
    // Predict habit completion likelihood
    router.post('/habit-prediction', authenticateUser, async (req, res) => {
        const { habit, completions, currentStreak } = req.body;

        if (!habit) {
            return res.status(400).json({ error: 'habit required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        const weekNum = Math.ceil(new Date().getDate() / 7);
        const cacheKey = `habit-pred:${req.user.id}:${habit.id}:${new Date().getFullYear()}-W${weekNum}`;
        const cached = getCached(cacheKey, 2 * 60 * 60 * 1000); // 2h

        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        try {
            // Compact habit statistics
            const last30 = (completions || []).slice(-30);
            const completionRate = last30.length > 0
                ? last30.filter(c => c.state === 'completed').length / last30.length
                : 0;

            const dayOfWeekRates = [0, 1, 2, 3, 4, 5, 6].map(d => {
                const forDay = last30.filter(c => {
                    const date = new Date(c.completed_date);
                    return date.getDay() === d;
                });
                return forDay.length ? forDay.filter(c => c.state === 'completed').length / forDay.length : 0;
            });

            const result = await callClaude({
                systemPrompt: `Eres un analista de comportamiento que predice el cumplimiento de hábitos.
Responde ÚNICAMENTE en JSON con esta estructura:
{ "probability": <0-100>, "insight": "una oración explicando el patrón", "tip": "un consejo accionable específico" }
Sé breve y específico.`,
                userMessage: `Hábito: "${habit.title}" (tipo: ${habit.type}).
Tasa completación últimos 30 días: ${(completionRate * 100).toFixed(0)}%.
Racha actual: ${currentStreak || 0} días.
Tasas por día de semana [Dom-Sáb]: ${dayOfWeekRates.map(r => (r * 100).toFixed(0)).join(',')}%.
Predice la probabilidad de completar hoy y da un tip.`,
                maxTokens: 250
            });

            // Safe JSON parsing
            const match = result.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Invalid JSON in response');

            const parsed = JSON.parse(match[0]);
            setCache(cacheKey, parsed);
            res.json(parsed);
        } catch (err) {
            console.error('[AI/habit-prediction] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message });
        }
    });

    // ─── 5. POST /api/ai/habit-coaching ──────────────────────────────────
    // Get motivational coaching message for habits
    router.post('/habit-coaching', authenticateUser, async (req, res) => {
        const { habits } = req.body;

        if (!habits || !Array.isArray(habits)) {
            return res.json({ message: null });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `coaching:${req.user.id}:${today}`;
        const cached = getCached(cacheKey, 30 * 60 * 1000); // 30 min

        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        try {
            const completed = habits.filter(h => h.today_state === 'completed').length;
            const pending = habits.filter(h => h.today_state === 'none').length;

            const result = await callClaude({
                systemPrompt: `Eres un coach de hábitos motivador y empático para usuarios argentinos.
Responde en JSON: { "message": "mensaje motivacional personalizado (máx 2 oraciones)", "highlight": "logro específico a destacar" }
Tono: positivo, cercano, sin ser excesivamente efusivo. Sé breve.`,
                userMessage: `El usuario tiene ${completed} hábitos completados y ${pending} pendientes hoy.`,
                maxTokens: 150
            });

            // Safe JSON parsing
            const match = result.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Invalid JSON in response');

            const parsed = JSON.parse(match[0]);
            setCache(cacheKey, parsed);
            res.json(parsed);
        } catch (err) {
            console.error('[AI/habit-coaching] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message });
        }
    });

    // ─── 6. POST /api/ai/weekly-insights ─────────────────────────────────
    // Get weekly summary of finances and habits
    router.post('/weekly-insights', authenticateUser, async (req, res) => {
        const { expenses, habits, weekStart } = req.body;

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({ error: 'AI service not configured' });
        }

        const cacheKey = `weekly:${req.user.id}:${weekStart}`;
        const cached = getCached(cacheKey, 6 * 60 * 60 * 1000); // 6h

        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        try {
            const habitRate = habits && habits.length > 0
                ? (habits.filter(h => h.today_state === 'completed').length / habits.length * 100).toFixed(0)
                : 0;

            const totalGastos = expenses && Array.isArray(expenses)
                ? expenses.reduce((a, e) => a + (e.amount || 0), 0)
                : 0;

            const result = await callClaude({
                systemPrompt: `Eres un coach integral de bienestar y finanzas personales para argentinos.
Responde en JSON: { "summary": "resumen semanal en 2 oraciones", "wins": ["logro1","logro2"], "improvements": ["mejora1","mejora2"] }
Sé positivo pero realista.`,
                userMessage: `Semana del ${weekStart}. Tasa de hábitos: ${habitRate}%. Gastos totales: $${totalGastos.toFixed(0)} ARS. Transacciones: ${expenses?.length || 0}.`,
                maxTokens: 350
            });

            // Safe JSON parsing
            const match = result.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Invalid JSON in response');

            const parsed = JSON.parse(match[0]);
            setCache(cacheKey, parsed);
            res.json(parsed);
        } catch (err) {
            console.error('[AI/weekly-insights] Full Error:', err);
            res.status(500).json({ error: 'AI unavailable', message: err.message });
        }
    });

    return router;
};
