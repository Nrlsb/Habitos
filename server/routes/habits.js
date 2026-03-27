const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    // Get all habits with today's completion status
    router.get('/', authenticateUser, async (req, res) => {
        const today = req.query.date || new Date().toISOString().split('T')[0];

        const { data: habits, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (habitsError) return res.status(500).json({ error: habitsError.message });

        const habitIds = habits.map(h => h.id);
        let completionsMap = {};

        if (habitIds.length > 0) {
            const { data: completions, error: completionsError } = await supabase
                .from('habit_completions')
                .select('*')
                .in('habit_id', habitIds)
                .eq('completed_date', today);

            if (!completionsError && completions) {
                completions.forEach(c => { completionsMap[c.habit_id] = c; });
            }
        }

        const habitsWithStatus = habits.map(h => ({
            ...h,
            today_state: completionsMap[h.id]?.state || 'none',
            today_value: completionsMap[h.id]?.value || 0
        }));

        res.json(habitsWithStatus);
    });

    // Get completions (filtered by user)
    router.get('/completions/all', authenticateUser, async (req, res) => {
        const { data, error } = await supabase
            .from('habit_completions')
            .select('*, habits!inner(user_id)')
            .eq('habits.user_id', req.user.id);

        if (error) return res.status(500).json({ error: error.message });
        res.json(data.map(({ habits, ...rest }) => rest));
    });

    // Get last heartbeat status
    router.get('/status', authenticateUser, async (req, res) => {
        try {
            // Seleccionamos todo para evitar fallos si falta alguna columna específica (como updated_at)
            const { data, error } = await supabase
                .from('app_status')
                .select('*')
                .eq('key', 'last_heartbeat')
                .maybeSingle();

            if (error) {
                console.error('Error in /status query:', error.message);
                return res.json({ value: 'N/A', updated_at: null });
            }

            // Si no hay datos, devolvemos N/A
            if (!data) return res.json({ value: 'N/A', updated_at: null });

            res.json({
                value: data.value || 'N/A',
                updated_at: data.updated_at || null
            });
        } catch (err) {
            console.error('CRITICAL: Unexpected error in /status route:', err.message);
            res.json({ value: 'Error', updated_at: null, debug: err.message }); // Añadimos debug
        }
    });

    // Get a single habit with completions
    router.get('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        try {
            const { data: habit, error: habitError } = await supabase
                .from('habits')
                .select('*')
                .eq('id', id)
                .eq('user_id', req.user.id)
                .single();

            if (habitError) return res.status(500).json({ error: habitError.message });

            const { data: completions, error: completionsError } = await supabase
                .from('habit_completions')
                .select('*')
                .eq('habit_id', id)
                .order('completed_date', { ascending: false });

            if (completionsError) return res.status(500).json({ error: completionsError.message });

            res.json({ ...habit, completions });
        } catch (err) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // Create a new habit
    router.post('/', authenticateUser, async (req, res) => {
        const { title, description, type, goal, unit, category } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const { data, error } = await supabase
            .from('habits')
            .insert([{
                title, description,
                type: type || 'boolean',
                goal: goal || 0,
                unit: unit || '',
                category: category || 'General',
                user_id: req.user.id
            }])
            .select();

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    // Delete a habit
    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { error } = await supabase
            .from('habits')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Habit deleted successfully' });
    });

    // Toggle habit completion
    router.post('/:id/toggle', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { date, state, value } = req.body;

        const { data: habit, error: habitError } = await supabase
            .from('habits').select('id').eq('id', id).eq('user_id', req.user.id).single();

        if (habitError || !habit) return res.status(403).json({ error: 'Unauthorized or habit not found' });
        if (!date) return res.status(400).json({ error: 'Date is required' });

        try {
            const { data: existing, error: checkError } = await supabase
                .from('habit_completions')
                .select('*').eq('habit_id', id).eq('completed_date', date).maybeSingle();

            if (checkError) return res.status(500).json({ error: checkError.message });

            if (value !== undefined) {
                const newState = state || 'completed';
                const { error: upsertError } = await supabase
                    .from('habit_completions')
                    .upsert({ habit_id: id, completed_date: date, state: newState, value },
                        { onConflict: 'habit_id, completed_date' });

                if (upsertError) return res.status(500).json({ error: upsertError.message });
                return res.json({ message: 'Habit value updated', status: newState, value });
            }

            if (existing) {
                const { error: deleteError } = await supabase
                    .from('habit_completions').delete().eq('id', existing.id);
                if (deleteError) return res.status(500).json({ error: deleteError.message });
                return res.json({ message: 'Habit completion removed', status: 'none' });
            } else {
                const newState = state || 'completed';
                const { error: insertError } = await supabase
                    .from('habit_completions')
                    .insert([{ habit_id: id, completed_date: date, state: newState }]);
                if (insertError) return res.status(500).json({ error: insertError.message });
                return res.json({ message: 'Habit marked as complete', status: newState });
            }
        } catch (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    });


    return router;
};
