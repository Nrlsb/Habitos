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
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL ERROR: Supabase URL or Key is missing in environment variables!');
}

// CRITICAL FIX: Use Service Role Key for the main client if available.
// This allows the backend to bypass RLS policies (which require a user token that we aren't forwarding).
// We rely on the code-level checks (req.user.id) for security.
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Admin client alias (points to the same instance if service key is used)
const supabaseAdmin = supabase;

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
            // Use supabaseAdmin because listing users requires service_role key
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (listError) {
                console.error("Error listing users:", listError);
            } else if (users) {
                const foundUser = users.find(u => u.email === email);
                if (foundUser) targetUserId = foundUser.id;
            }
        }

        if (!targetUserId) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        // 3. Insert into planilla_shares
        // Use supabaseAdmin to bypass RLS policies since we already verified ownership
        const { error: shareError } = await supabaseAdmin
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
        category, // New field
        esCompartido,
        enCuotas,
        cuotaActual,
        totalCuotas,
        payer_name // New field
    } = req.body;

    const newExpense = {
        planilla_id: planillaId,
        description,
        amount,
        currency: currency || 'ARS',
        category: category || 'General', // Default to General
        is_shared: esCompartido || false,
        is_installment: enCuotas || false,
        current_installment: cuotaActual || null,
        total_installments: totalCuotas || null,
        payer_name: esCompartido ? payer_name : null, // Only save if shared
        created_at: req.body.date || undefined // Use provided date
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
        category, // New field
        esCompartido,
        enCuotas,
        cuotaActual,
        totalCuotas,
        payer_name // New field
    } = req.body;

    const updates = {
        description,
        amount,
        currency,
        category, // New field
        is_shared: esCompartido,
        is_installment: enCuotas,
        current_installment: cuotaActual,
        total_installments: totalCuotas,
        payer_name: esCompartido ? payer_name : null,
        created_at: req.body.date // Allow updating date
    };

    const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Copy expenses from Source Planilla to Target Planilla
app.post('/api/planillas/:targetId/expenses/copy', authenticateUser, async (req, res) => {
    const { targetId } = req.params;
    const { sourcePlanillaId } = req.body;

    if (!sourcePlanillaId) {
        return res.status(400).json({ error: 'Source Planilla ID is required' });
    }

    // 1. Verify access to TARGET
    if (!(await checkPlanillaAccess(targetId, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized access to target planilla' });
    }

    // 2. Verify access to SOURCE
    if (!(await checkPlanillaAccess(sourcePlanillaId, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized access to source planilla' });
    }

    try {
        // 3. Fetch expenses from SOURCE
        const { data: sourceExpenses, error: fetchError } = await supabase
            .from('expenses')
            .select('*')
            .eq('planilla_id', sourcePlanillaId);

        if (fetchError) throw fetchError;

        if (!sourceExpenses || sourceExpenses.length === 0) {
            return res.json({ message: 'No expenses to copy', count: 0 });
        }

        // 4. Prepare expenses for insertion into TARGET
        // We omit 'id' to let DB generate new ones.
        // We keep 'created_at' to preserve history/order.
        const expensesToInsert = sourceExpenses.map(e => ({
            planilla_id: targetId,
            description: e.description,
            amount: e.amount,
            currency: e.currency,
            category: e.category,
            is_shared: e.is_shared,
            payer_name: e.payer_name,
            is_installment: e.is_installment,
            current_installment: e.current_installment,
            total_installments: e.total_installments,
            created_at: e.created_at
        }));

        // 5. Bulk Insert
        const { data: inserted, error: insertError } = await supabase
            .from('expenses')
            .insert(expensesToInsert)
            .select();

        if (insertError) throw insertError;

        res.json({ message: 'Expenses copied successfully', count: inserted.length });

    } catch (err) {
        console.error("Error copying expenses:", err);
        res.status(500).json({ error: err.message });
    }
});

// Rollover Month: Copy recurring/installments from Previous Month to Current Month
app.post('/api/planillas/:id/rollover', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { targetDate, selectedExpenseIds } = req.body; // selectedExpenseIds is optional array of strings

    if (!targetDate) return res.status(400).json({ error: 'Target date is required' });

    // 1. Calculate Previous Month Range
    const target = new Date(targetDate);
    // Be careful with timezones. Best to assume targetDate is YYYY-MM-01 and treat as UTC or consistent local.
    // Let's assume targetDate is set to the 1st of the month.

    // Previous month calculation
    const prevMonthDate = new Date(target);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);

    // Start of previous month
    const startPrev = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString();
    // End of previous month (start of current target month)
    const endPrev = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();

    if (!(await checkPlanillaAccess(id, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized or planilla not found' });
    }

    try {
        // 2. Fetch Expenses from Previous Month
        // If IDs provided, we can fetch just those (optimization), or fetch all and filter.
        // Let's fetch all from prev month to validate they are indeed from prev month.

        const { data: previousExpenses, error: fetchError } = await supabase
            .from('expenses')
            .select('*')
            .eq('planilla_id', id)
            .gte('created_at', startPrev)
            .lt('created_at', endPrev);

        if (fetchError) throw fetchError;

        if (!previousExpenses || previousExpenses.length === 0) {
            return res.json({ message: 'No expenses found in previous month', count: 0 });
        }

        let expensesToProcess = previousExpenses;

        // 2.1 Filter by Selection if provided
        if (selectedExpenseIds && Array.isArray(selectedExpenseIds) && selectedExpenseIds.length > 0) {
            expensesToProcess = previousExpenses.filter(e => selectedExpenseIds.includes(e.id));
        } else {
            // Default behavior (Legacy Support / Auto-Rollover without selection):
            // Only take Active Installments
            expensesToProcess = previousExpenses.filter(e => e.is_installment && (!e.total_installments || e.current_installment < e.total_installments));
        }

        if (expensesToProcess.length === 0) {
            return res.json({ message: 'No expenses selected or found to rollover', count: 0 });
        }

        // 3. Prepare New Expenses for Target Month
        const expensesToInsert = expensesToProcess.map(e => {
            let newCurrentInstallment = e.current_installment;
            let isInstallment = e.is_installment;

            // Logic:
            // - If it WAS an installment, we increment. 
            // - If it was NOT, it's a fixed expense we are copying, so it stays as is (not installment? or keep flags?)
            //   Usually fixed expenses are just repeated.

            if (e.is_installment) {
                // Verify it hasn't finished (double check for safety if manually selected completed ones)
                if (e.total_installments && e.current_installment >= e.total_installments) {
                    // It's finished. Should we rollover? valid use case: extended quotas?
                    // For now, let's assume if user selected it, they want it. But usually we increment.
                    newCurrentInstallment = e.current_installment + 1;
                } else {
                    newCurrentInstallment = e.current_installment + 1;
                }
            } else {
                // It is a fixed expense. Just copy.
                // Reset installment fields just in case
                newCurrentInstallment = null;
                isInstallment = false;
            }

            return {
                planilla_id: id,
                description: e.description,
                amount: e.amount,
                currency: e.currency,
                category: e.category,
                is_shared: e.is_shared,
                payer_name: e.payer_name,
                is_installment: isInstallment,
                current_installment: newCurrentInstallment,
                total_installments: e.total_installments,
                created_at: targetDate // Set to 1st of the new month
            };
        });

        // 4. Bulk Insert
        const { data: inserted, error: insertError } = await supabase
            .from('expenses')
            .insert(expensesToInsert)
            .select();

        if (insertError) throw insertError;

        res.json({ message: 'Month rollover successful', count: inserted.length, details: inserted });

    } catch (err) {
        console.error("Error during month rollover:", err);
        res.status(500).json({ error: err.message });
    }
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

// Get daily expenses (aggregated from all owned/shared planillas)
app.get('/api/expenses/daily', authenticateUser, async (req, res) => {
    const { date, from, to } = req.query;

    // We need either 'date' OR ('from' & 'to')
    if (!date && (!from || !to)) {
        return res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) or numeric/ISO dates range (from, to) is required' });
    }

    try {
        // 1. Get all accessible planillas (Owned + Shared)
        // Owned
        const { data: owned } = await supabase
            .from('planillas')
            .select('id')
            .eq('user_id', req.user.id);

        // Shared
        const { data: shares } = await supabase
            .from('planilla_shares')
            .select('planilla_id')
            .eq('user_id', req.user.id);

        const ownedIds = owned ? owned.map(p => p.id) : [];
        const sharedIds = shares ? shares.map(s => s.planilla_id) : [];
        const allPlanillaIds = [...new Set([...ownedIds, ...sharedIds])];

        if (allPlanillaIds.length === 0) {
            return res.json([]);
        }

        // 2. Query expenses
        let startDate, endDate;

        if (from && to) {
            // Priority: Explicit range (ISO strings or timestamps)
            startDate = from;
            endDate = to;
        } else {
            // Fallback: Date string
            startDate = `${date}T00:00:00`;
            endDate = `${date}T23:59:59.999`;
        }

        const { data: expenses, error } = await supabase
            .from('expenses')
            .select(`
                *,
                planillas (
                    id,
                    nombre,
                    user_id
                )
            `)
            .in('planilla_id', allPlanillaIds)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(expenses);

    } catch (err) {
        console.error("Error fetching daily expenses:", err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Planning / Tasks Routes

// --- Helper: Check Planning Sheet Access ---
const checkPlanningSheetAccess = async (sheetId, userId) => {
    // Check Owner
    const { data: owner } = await supabase
        .from('planning_sheets')
        .select('id')
        .eq('id', sheetId)
        .eq('user_id', userId)
        .maybeSingle();

    if (owner) return true;

    // Check Shared
    const { data: shared } = await supabase
        .from('planning_shares')
        .select('id')
        .eq('planning_sheet_id', sheetId)
        .eq('user_id', userId)
        .maybeSingle();

    return !!shared;
};

// --- Planning Sheets Routes ---

// Get all sheets (Owned + Shared)
app.get('/api/planning-sheets', authenticateUser, async (req, res) => {
    try {
        // 1. Get Owned
        const { data: owned, error: ownedError } = await supabase
            .from('planning_sheets')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (ownedError) throw ownedError;

        // 2. Get Shared
        const { data: shares, error: sharesError } = await supabase
            .from('planning_shares')
            .select('planning_sheet_id')
            .eq('user_id', req.user.id);

        let sharedSheets = [];
        if (!sharesError && shares && shares.length > 0) {
            const sheetIds = shares.map(s => s.planning_sheet_id);
            const { data: shared, error: sharedDetailsError } = await supabase
                .from('planning_sheets')
                .select('*')
                .in('id', sheetIds)
                .order('created_at', { ascending: false });

            if (!sharedDetailsError && shared) {
                sharedSheets = shared.map(s => ({ ...s, is_shared_with_me: true }));
            }
        }

        const allSheets = [...owned, ...sharedSheets].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        res.json(allSheets);
    } catch (err) {
        console.error("Error getting planning sheets:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create Planning Sheet
app.post('/api/planning-sheets', authenticateUser, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
        .from('planning_sheets')
        .insert([{ name, user_id: req.user.id }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Delete Planning Sheet
app.delete('/api/planning-sheets/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('planning_sheets')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Sheet deleted successfully' });
});

// Share Planning Sheet
app.post('/api/planning-sheets/:id/share', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        // 1. Verify Ownership
        const { data: sheet, error: sheetError } = await supabase
            .from('planning_sheets')
            .select('id, name')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (sheetError || !sheet) {
            return res.status(403).json({ error: 'Unauthorized or sheet not found' });
        }

        // 2. Find User
        let targetUserId = null;
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (profile) {
            targetUserId = profile.id;
        } else {
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (users) {
                const foundUser = users.find(u => u.email === email);
                if (foundUser) targetUserId = foundUser.id;
            }
        }

        if (!targetUserId) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 3. Share
        const { error: shareError } = await supabaseAdmin
            .from('planning_shares')
            .insert([{ planning_sheet_id: id, user_id: targetUserId }]);

        if (shareError) {
            if (shareError.code === '23505') return res.status(400).json({ error: 'Already shared' });
            throw shareError;
        }

        res.json({ message: `Shared with ${email}` });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- Tasks Routes (Scoped by Sheet) ---

// Get tasks
app.get('/api/tasks', authenticateUser, async (req, res) => {
    const { sheet_id, start_date, end_date } = req.query;

    if (!sheet_id) return res.status(400).json({ error: 'sheet_id is required' });

    if (!(await checkPlanningSheetAccess(sheet_id, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized access to this sheet' });
    }

    let query = supabase
        .from('tasks')
        .select('*')
        .eq('planning_sheet_id', sheet_id)
        .order('due_date', { ascending: true });

    if (start_date && end_date) {
        query = query
            .gte('due_date', `${start_date}T00:00:00`)
            .lte('due_date', `${end_date}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Create task
app.post('/api/tasks', authenticateUser, async (req, res) => {
    const { title, description, due_date, priority, sheet_id } = req.body;

    if (!title || !due_date || !sheet_id) {
        return res.status(400).json({ error: 'Title, due_date and sheet_id are required' });
    }

    if (!(await checkPlanningSheetAccess(sheet_id, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized access to this sheet' });
    }

    const newTask = {
        user_id: req.user.id,
        planning_sheet_id: sheet_id,
        title,
        description: description || '',
        due_date,
        priority: priority || 'medium',
        is_completed: false
    };

    const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Update task
app.put('/api/tasks/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { title, description, due_date, priority, is_completed } = req.body;

    // Check ownership of the task OR access to the sheet. 
    // Simpler: Fetch task first to get sheet_id, then check access.
    const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('planning_sheet_id')
        .eq('id', id)
        .single();

    if (fetchError || !task) return res.status(404).json({ error: 'Task not found' });

    if (!(await checkPlanningSheetAccess(task.planning_sheet_id, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date !== undefined) updates.due_date = due_date;
    if (priority !== undefined) updates.priority = priority;
    if (is_completed !== undefined) updates.is_completed = is_completed;

    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Delete task
app.delete('/api/tasks/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('planning_sheet_id')
        .eq('id', id)
        .single();

    if (fetchError || !task) return res.status(404).json({ error: 'Task not found' });

    if (!(await checkPlanningSheetAccess(task.planning_sheet_id, req.user.id))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Task deleted' });
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
