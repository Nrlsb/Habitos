const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- DEBUG LOGS FOR RENDER ---
console.log('--- STARTING SERVER ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', port);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!process.env.SUPABASE_KEY);
// -----------------------------

app.use(cors({
    origin: [
        'https://habitos-y7im.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://192.168.1.109:5173',
        'http://192.168.1.109:3000'
    ],
    credentials: true
}));
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL ERROR: Supabase URL or Key is missing in environment variables!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Authentication error' });
    }
};

app.get('/', (req, res) => {
    res.send('Hello from Habit Tracker Backend!');
});

app.get('/test-supabase', async (req, res) => {
    try {
        const { data, error } = await supabase.from('habits').select('*').limit(1);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ message: 'Supabase connection successful', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Habits Routes

// Get all habits
app.get('/api/habits', authenticateUser, async (req, res) => {
    const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Get a single habit with completions
app.get('/api/habits/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    try {
        // Get habit details
        const { data: habit, error: habitError } = await supabase
            .from('habits')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (habitError) {
            console.error('Error fetching habit:', habitError);
            return res.status(500).json({ error: habitError.message });
        }

        // Get completions for this habit
        const { data: completions, error: completionsError } = await supabase
            .from('habit_completions')
            .select('*')
            .eq('habit_id', id)
            .order('completed_date', { ascending: false });

        if (completionsError) {
            console.error('Error fetching completions:', completionsError);
            return res.status(500).json({ error: completionsError.message });
        }

        res.json({ ...habit, completions: completions });
    } catch (err) {
        console.error('Unexpected error in get habit:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create a new habit
app.post('/api/habits', authenticateUser, async (req, res) => {
    const { title, description, type, goal, unit, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const newHabit = {
        title,
        description,
        type: type || 'boolean',
        goal: goal || 0,
        unit: unit || '',
        category: category || 'General',
        user_id: req.user.id
    };

    const { data, error } = await supabase
        .from('habits')
        .insert([newHabit])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Delete a habit
app.delete('/api/habits/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id); // Validar que sea del usuario

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Habit deleted successfully' });
});

// Toggle habit completion or update value
app.post('/api/habits/:id/toggle', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { date, state, value } = req.body; // value is optional (for counters)

    // Primero verificar que el hábito pertenece al usuario
    const { data: habit, error: habitError } = await supabase
        .from('habits')
        .select('id')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

    if (habitError || !habit) {
        return res.status(403).json({ error: 'Unauthorized or habit not found' });
    }

    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        // Check if already completed
        const { data: existing, error: checkError } = await supabase
            .from('habit_completions')
            .select('*')
            .eq('habit_id', id)
            .eq('completed_date', date)
            .maybeSingle();

        if (checkError) {
            console.error('Error checking completion:', checkError);
            return res.status(500).json({ error: checkError.message });
        }

        // If 'value' is provided, we are updating a counter habit (Upsert)
        if (value !== undefined) {
            const newState = state || 'completed';
            const { error: upsertError } = await supabase
                .from('habit_completions')
                .upsert({
                    habit_id: id,
                    completed_date: date,
                    state: newState,
                    value: value
                }, { onConflict: 'habit_id, completed_date' });

            if (upsertError) {
                console.error('Error updating completion value:', upsertError);
                return res.status(500).json({ error: upsertError.message });
            }
            return res.json({ message: 'Habit value updated', status: newState, value });
        }

        // Standard Boolean Toggle Logic (No value provided)
        if (existing) {
            // Toggle OFF: Delete
            const { error: deleteError } = await supabase
                .from('habit_completions')
                .delete()
                .eq('id', existing.id);

            if (deleteError) {
                console.error('Error deleting completion:', deleteError);
                return res.status(500).json({ error: deleteError.message });
            }
            return res.json({ message: 'Habit completion removed', status: 'none' });
        } else {
            // Toggle ON: Insert
            const newState = state || 'completed';
            const { error: insertError } = await supabase
                .from('habit_completions')
                .insert([{ habit_id: id, completed_date: date, state: newState }]);

            if (insertError) {
                console.error('Error inserting completion:', insertError);
                return res.status(500).json({ error: insertError.message });
            }
            return res.json({ message: 'Habit marked as complete', status: newState });
        }
    } catch (err) {
        console.error('Unexpected error in toggle:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get completions for a habit (or all)
app.get('/api/completions', authenticateUser, async (req, res) => {
    // Esto podría ser peligroso si devuelve TODOS los completions de TODOS. 
    // Deberíamos filtrar por usuario, pero habit_completions no tiene user_id directo (está en habit).
    // Por ahora, para ser seguros, lo deshabilitamos o filtramos.
    // O mejor, hacemos un join.
    /*
    const { data, error } = await supabase
        .from('habit_completions')
        .select(`
            *,
            habits!inner(user_id)
        `)
        .eq('habits.user_id', req.user.id);
    */
    // Simplificación: solo devolvemos completions si se pide con un filtro específico o lo dejamos abierto pero limitado?
    // En la app actual, no parece usarse esta ruta globalmente, sino la de /api/habits/:id
    // Lo dejaré como estaba pero con comentario de seguridad o lo quito si no se usa.
    // Lo dejo "abierto" pero es riesgo. Mejor filtrar.

    // VERIFICAR: Si la tabla habit_completions tiene RLS habilitado en Supabase, esto se maneja solo.
    // Como estamos usando service_role key en el backend (probablemente), nos saltamos RLS.
    // Así que debemos filtrar manual.

    const { data, error } = await supabase
        .from('habit_completions')
        .select('*, habits!inner(user_id)')
        .eq('habits.user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    // Remove habits object from response to keep format clean if needed, 
    // but likely frontend expects flat array. 
    // Map to remove nested habits object
    const cleanedData = data.map(item => {
        const { habits, ...rest } = item;
        return rest;
    });
    res.json(cleanedData);
});

// --- ROUTES FOR GASTOS APP ---

// 1. Planillas Routes

// Get all planillas (Owned + Shared)
app.get('/api/planillas', authenticateUser, async (req, res) => {
    try {
        // 1. Get Owned Planillas
        const { data: owned, error: ownedError } = await supabase
            .from('planillas')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (ownedError) throw ownedError;

        // 2. Get Shared Planillas
        const { data: shares, error: sharesError } = await supabase
            .from('planilla_shares')
            .select('planilla_id')
            .eq('user_id', req.user.id);

        let sharedPlanillas = [];
        if (!sharesError && shares && shares.length > 0) {
            const planillaIds = shares.map(s => s.planilla_id);
            const { data: shared, error: sharedDetailsError } = await supabase
                .from('planillas')
                .select('*')
                .in('id', planillaIds)
                .order('created_at', { ascending: false });

            if (!sharedDetailsError && shared) {
                // Mark as shared
                sharedPlanillas = shared.map(p => ({ ...p, is_shared_with_me: true }));
            }
        }

        // Combine and sort
        const allPlanillas = [...owned, ...sharedPlanillas].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        res.json(allPlanillas);
    } catch (err) {
        console.error("Error getting planillas:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create a new planilla
app.post('/api/planillas', authenticateUser, async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
        .from('planillas')
        .insert([{ nombre, user_id: req.user.id }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Share a planilla
app.post('/api/planillas/:id/share', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        // 1. Verify Ownership
        const { data: planilla, error: planillaError } = await supabase
            .from('planillas')
            .select('id, nombre')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (planillaError || !planilla) {
            return res.status(403).json({ error: 'Unauthorized or planilla not found' });
        }

        // 2. Find User by Email
        // Try 'profiles' table first (common pattern)
        let targetUserId = null;
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (profile) {
            targetUserId = profile.id;
        } else {
            // Fallback: Admin List Users
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError && users) {
                const foundUser = users.find(u => u.email === email);
                if (foundUser) targetUserId = foundUser.id;
            }
        }

        if (!targetUserId) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        // 3. Insert into planilla_shares
        const { error: shareError } = await supabase
            .from('planilla_shares')
            .insert([{ planilla_id: id, user_id: targetUserId }]);

        if (shareError) {
            if (shareError.code === '23505') {
                return res.status(400).json({ error: 'Planilla already shared with this user' });
            }
            throw shareError;
        }

        res.json({ message: `Planilla shared with ${email}` });

    } catch (err) {
        console.error("Error sharing planilla:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Delete a planilla
app.delete('/api/planillas/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('planillas')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Planilla deleted successfully' });
});

// 2. Expenses Routes

// Helper to check access (Owner OR Shared)
const checkPlanillaAccess = async (planillaId, userId) => {
    // Check Owner
    const { data: owner } = await supabase
        .from('planillas')
        .select('id')
        .eq('id', planillaId)
        .eq('user_id', userId)
        .maybeSingle();

    if (owner) return true;

    // Check Shared
    const { data: shared } = await supabase
        .from('planilla_shares')
        .select('id')
        .eq('planilla_id', planillaId)
        .eq('user_id', userId)
        .maybeSingle();

    return !!shared;
};

// Get expenses for a specific planilla
app.get('/api/planillas/:planillaId/expenses', authenticateUser, async (req, res) => {
    const { planillaId } = req.params;

    if (!(await checkPlanillaAccess(planillaId, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized or planilla not found' });
    }

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('planilla_id', planillaId)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Create a new expense
app.post('/api/planillas/:planillaId/expenses', authenticateUser, async (req, res) => {
    const { planillaId } = req.params;

    if (!(await checkPlanillaAccess(planillaId, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized or planilla not found' });
    }

    const {
        description,
        amount,
        currency,
        esCompartido,
        enCuotas,
        cuotaActual,
        totalCuotas
    } = req.body;

    const newExpense = {
        planilla_id: planillaId,
        description,
        amount,
        currency: currency || 'ARS',
        is_shared: esCompartido || false,
        is_installment: enCuotas || false,
        current_installment: cuotaActual || null,
        total_installments: totalCuotas || null
    };

    const { data, error } = await supabase
        .from('expenses')
        .insert([newExpense])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Update an expense
app.put('/api/expenses/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('planilla_id')
        .eq('id', id)
        .single();

    if (fetchError || !expense) return res.status(404).json({ error: 'Expense not found' });

    const { data: planilla, error: planillaError } = await supabase
        .from('planillas')
        .select('id')
        .eq('id', expense.planilla_id)
        .eq('user_id', req.user.id)
        .single();

    if (planillaError || !planilla) return res.status(403).json({ error: 'Unauthorized' });

    const {
        description,
        amount,
        currency,
        esCompartido,
        enCuotas,
        cuotaActual,
        totalCuotas
    } = req.body;

    const updates = {
        description,
        amount,
        currency,
        is_shared: esCompartido,
        is_installment: enCuotas,
        current_installment: cuotaActual,
        total_installments: totalCuotas
    };

    const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Delete an expense
app.delete('/api/expenses/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('planilla_id')
        .eq('id', id)
        .single();

    if (fetchError || !expense) return res.status(404).json({ error: 'Expense not found' });

    const { data: planilla, error: planillaError } = await supabase
        .from('planillas')
        .select('id')
        .eq('id', expense.planilla_id)
        .eq('user_id', req.user.id)
        .single();

    if (planillaError || !planilla) return res.status(403).json({ error: 'Unauthorized' });

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Expense deleted successfully' });
});

// 3. BNA Route (Dollar Rate)

// URL ÚNICA de BNA
const URL_BNA = 'https://www.bna.com.ar/Personas';

// --- CONFIGURACIÓN DEL CACHÉ (En memoria) ---
let bnaCache = {
    data: null,
    timestamp: null
};
// Duración del caché: 30 minutos en milisegundos
const CACHE_DURATION_MS = 30 * 60 * 1000;

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

app.get('/api/bna', async (req, res) => {
    const now = Date.now();

    // 1. Revisar si hay datos en caché y si aún son válidos
    if (bnaCache.data && (now - bnaCache.timestamp < CACHE_DURATION_MS)) {
        res.setHeader('X-Cache-Hit', 'true');
        return res.json(bnaCache.data);
    }

    try {
        // 2. Si el caché no es válido, buscar los datos
        const { data: html } = await axios.get(URL_BNA, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(html);

        // --- LÓGICA PARA BILLETES (Solo Venta) ---
        const tablaBilletes = $('#billetes');
        const filaDolarBillete = tablaBilletes.find('tbody tr').first();
        const billeteVenta = limpiarTexto(filaDolarBillete.find('td').eq(2).text());

        // --- LÓGICA PARA DIVISAS (Solo Venta) ---
        const tablaDivisas = $('#divisas');
        const filaDolarDivisa = tablaDivisas.find('tbody tr').first();
        const divisaVenta = limpiarTexto(filaDolarDivisa.find('td').eq(2).text());

        // 3. Crear la nueva respuesta simplificada
        const nuevaRespuesta = {
            status: 'ok',
            fecha_actualizacion: new Date(now).toISOString(),
            banco: 'Banco de la Nación Argentina',
            venta_billete: parsearFormatoBillete(billeteVenta),
            venta_divisa: parsearFormatoDivisa(divisaVenta)
        };

        // 4. Guardar la nueva respuesta en el caché
        bnaCache.data = nuevaRespuesta;
        bnaCache.timestamp = now;

        // 5. Enviar la respuesta
        res.setHeader('X-Cache-Hit', 'false');
        res.json(nuevaRespuesta);

    } catch (error) {
        console.error('Error al obtener cotizaciones:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'No se pudo obtener la cotización del BNA',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
