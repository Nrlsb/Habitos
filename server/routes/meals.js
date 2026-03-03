const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    router.get('/', authenticateUser, async (req, res) => {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Date is required' });

        const { data, error } = await supabase
            .from('daily_meals')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('date', date)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || {});
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { date, breakfast, lunch, snack, dinner } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required' });

        const { data, error } = await supabase
            .from('daily_meals')
            .upsert({ user_id: req.user.id, date, breakfast, lunch, snack, dinner },
                { onConflict: 'user_id, date' })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    return router;
};
