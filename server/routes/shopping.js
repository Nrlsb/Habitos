const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    // GET all items for the user
    router.get('/', authenticateUser, async (req, res) => {
        const { data, error } = await supabase
            .from('shopping_items')
            .select('*')
            .eq('user_id', req.user.id)
            .order('checked', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    // POST create a new item
    router.post('/', authenticateUser, async (req, res) => {
        const { name, quantity } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

        const { data, error } = await supabase
            .from('shopping_items')
            .insert([{ user_id: req.user.id, name: name.trim(), quantity: quantity?.trim() || null, checked: false }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    });

    // PATCH toggle checked or update item
    router.patch('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { checked, name, quantity } = req.body;

        const { data: item } = await supabase
            .from('shopping_items').select('user_id').eq('id', id).single();
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        const updates = {};
        if (checked !== undefined) updates.checked = checked;
        if (name !== undefined) updates.name = name.trim();
        if (quantity !== undefined) updates.quantity = quantity?.trim() || null;

        const { data, error } = await supabase
            .from('shopping_items').update(updates).eq('id', id).select().single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    // DELETE a specific item
    router.delete('/checked', authenticateUser, async (req, res) => {
        const { error } = await supabase
            .from('shopping_items')
            .delete()
            .eq('user_id', req.user.id)
            .eq('checked', true);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Checked items deleted' });
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;

        const { data: item } = await supabase
            .from('shopping_items').select('user_id').eq('id', id).single();
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await supabase.from('shopping_items').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Item deleted' });
    });

    return router;
};
