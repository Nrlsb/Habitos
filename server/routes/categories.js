const express = require('express');
const router = express.Router();

const DEFAULT_CATEGORIES = [
    { name: 'General', icon: '📝', color: '#94a3b8' },
    { name: 'Comida', icon: '🍔', color: '#ef4444' },
    { name: 'Transporte', icon: '🚌', color: '#3b82f6' },
    { name: 'Servicios', icon: '💡', color: '#eab308' },
    { name: 'Alquiler', icon: '🏠', color: '#6366f1' },
    { name: 'Supermercado', icon: '🛒', color: '#10b981' },
    { name: 'Mascota', icon: '🐶', color: '#fca5a5' },
    { name: 'Hogar', icon: '🛋️', color: '#a855f7' },
    { name: 'Viandas', icon: '🍱', color: '#f97316' },
    { name: 'Alcohol', icon: '🍺', color: '#eab308' },
    { name: 'Ocio', icon: '🎬', color: '#8b5cf6' },
    { name: 'Salud', icon: '⚕️', color: '#f43f5e' },
    { name: 'Ropa', icon: '👕', color: '#ec4899' },
    { name: 'Educación', icon: '📚', color: '#f97316' },
    { name: 'Otros', icon: '📦', color: '#64748b' },
    { name: 'Entretenimiento', icon: '🎬', color: '#a855f7' },
    { name: 'Varios', icon: '📦', color: '#64748b' }
];

module.exports = (supabase, authenticateUser) => {

    router.get('/', authenticateUser, async (req, res) => {
        let { data, error } = await supabase
            .from('categories').select('*')
            .or(`user_id.eq.${req.user.id},is_default.eq.true`).order('name');
        if (error) return res.status(500).json({ error: error.message });

        const existingNames = new Set(data?.map(c => c.name) || []);
        const missing = DEFAULT_CATEGORIES.filter(d => !existingNames.has(d.name));

        if (missing.length > 0) {
            const { data: newCats, error: seedError } = await supabase
                .from('categories').insert(missing.map(d => ({ ...d, user_id: req.user.id }))).select();
            if (!seedError && newCats) data = [...(data || []), ...newCats];
        }

        if (data) data.sort((a, b) => a.name.localeCompare(b.name));
        res.json(data);
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const { data, error } = await supabase
            .from('categories').insert([{ user_id: req.user.id, name, icon, color }]).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { error } = await supabase
            .from('categories').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Category deleted' });
    });

    return router;
};
