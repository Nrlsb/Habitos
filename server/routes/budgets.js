const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    router.get('/', authenticateUser, async (req, res) => {
        const { month, planilla_id } = req.query;
        if (!month) return res.status(400).json({ error: 'Month is required' });

        let query = supabase.from('budgets').select('*').eq('user_id', req.user.id).eq('month', month);
        query = planilla_id ? query.eq('planilla_id', planilla_id) : query.is('planilla_id', null);

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { category_name, amount, month, planilla_id } = req.body;
        if (!category_name || !amount || !month) return res.status(400).json({ error: 'Missing fields' });

        const { data, error } = await supabase
            .from('budgets')
            .upsert({ user_id: req.user.id, category_name, amount, month, planilla_id: planilla_id || null },
                { onConflict: 'user_id, category_name, month, planilla_id' })
            .select();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    });

    return router;
};
