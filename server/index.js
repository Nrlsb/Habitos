const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
app.get('/api/habits', async (req, res) => {
    const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Get a single habit with completions
app.get('/api/habits/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Get habit details
        const { data: habit, error: habitError } = await supabase
            .from('habits')
            .select('*')
            .eq('id', id)
            .single();

        if (habitError) {
            console.error('Error fetching habit:', habitError);
            return res.status(500).json({ error: habitError.message });
        }

        // Get completions for this habit
        const { data: completions, error: completionsError } = await supabase
            .from('habit_completions')
            .select('completed_date')
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
app.post('/api/habits', async (req, res) => {
    const { title, description, type, goal, unit, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const newHabit = {
        title,
        description,
        type: type || 'boolean',
        goal: goal || 0,
        unit: unit || '',
        category: category || 'General'
    };

    const { data, error } = await supabase
        .from('habits')
        .insert([newHabit])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Delete a habit
app.delete('/api/habits/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Habit deleted successfully' });
});

// Toggle habit completion or update value
app.post('/api/habits/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { date, state, value } = req.body; // value is optional (for counters)

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
app.get('/api/completions', async (req, res) => {
    const { data, error } = await supabase
        .from('habit_completions')
        .select('*');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
