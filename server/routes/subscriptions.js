const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    router.get('/', authenticateUser, async (req, res) => {
        const { planilla_id } = req.query;
        let query = supabase
            .from('subscriptions').select('*').eq('user_id', req.user.id);
        if (planilla_id) query = query.eq('planilla_id', planilla_id);
        const { data, error } = await query.order('created_at');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { name, amount, currency, category_name, frequency, billing_date, planilla_id, credit_card_id } = req.body;
        if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });

        const { data, error } = await supabase.from('subscriptions').insert([{
            user_id: req.user.id, name, amount,
            currency: currency || 'ARS',
            category_name: category_name || 'General',
            frequency: frequency || 'monthly',
            billing_date: billing_date || null,
            planilla_id: planilla_id || null,
            credit_card_id: credit_card_id || null
        }]).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.put('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { name, amount, currency, category_name, frequency, billing_date, active, credit_card_id } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (amount) updates.amount = amount;
        if (currency) updates.currency = currency;
        if (category_name) updates.category_name = category_name;
        if (frequency) updates.frequency = frequency;
        if (billing_date !== undefined) updates.billing_date = billing_date;
        if (active !== undefined) updates.active = active;
        if (credit_card_id !== undefined) updates.credit_card_id = credit_card_id;

        const { data, error } = await supabase
            .from('subscriptions').update(updates).eq('id', id).eq('user_id', req.user.id).select();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { error } = await supabase
            .from('subscriptions').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Subscription deleted' });
    });

    router.post('/:id/generate', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { date, planilla_id } = req.body;
        if (!date || !planilla_id) return res.status(400).json({ error: 'Date and Planilla ID required' });

        const { data: sub } = await supabase
            .from('subscriptions').select('*').eq('id', id).eq('user_id', req.user.id).single();
        if (!sub) return res.status(404).json({ error: 'Subscription not found' });

        const { data: expense, error: expError } = await supabase.from('expenses').insert([{
            planilla_id, description: sub.name, amount: sub.amount, currency: sub.currency,
            category: sub.category_name, created_at: date, is_shared: false, is_installment: false
        }]).select();
        if (expError) return res.status(500).json({ error: expError.message });

        await supabase.from('subscriptions').update({ last_generated_date: date }).eq('id', id);
        res.json(expense[0]);
    });

    return router;
};
