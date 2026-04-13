const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    // Get all credit cards for user
    router.get('/', authenticateUser, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Create a new credit card
    router.post('/', authenticateUser, async (req, res) => {
        const { name, last_digits, bank, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Card name is required' });

        try {
            const { data, error } = await supabase
                .from('credit_cards')
                .insert([{
                    user_id: req.user.id,
                    name,
                    last_digits: last_digits || null,
                    bank: bank || null,
                    color: color || '#2ecc70'
                }])
                .select();

            if (error) throw error;
            res.status(201).json(data[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update a credit card
    router.put('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { name, last_digits, bank, color } = req.body;

        try {
            const { data: card, error: fetchError } = await supabase
                .from('credit_cards')
                .select('user_id')
                .eq('id', id)
                .single();

            if (fetchError || !card) return res.status(404).json({ error: 'Card not found' });
            if (card.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (last_digits !== undefined) updates.last_digits = last_digits;
            if (bank !== undefined) updates.bank = bank;
            if (color !== undefined) updates.color = color;

            const { data, error } = await supabase
                .from('credit_cards')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            res.json(data[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete a credit card
    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;

        try {
            const { data: card, error: fetchError } = await supabase
                .from('credit_cards')
                .select('user_id')
                .eq('id', id)
                .single();

            if (fetchError || !card) return res.status(404).json({ error: 'Card not found' });
            if (card.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

            const { error } = await supabase
                .from('credit_cards')
                .delete()
                .eq('id', id);

            if (error) throw error;
            res.json({ message: 'Credit card deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
