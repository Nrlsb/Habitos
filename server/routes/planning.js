const express = require('express');
const router = express.Router();

module.exports = (supabase, supabaseAdmin, authenticateUser) => {

    const checkAccess = async (sheetId, userId) => {
        const { data: owner } = await supabase
            .from('planning_sheets').select('id').eq('id', sheetId).eq('user_id', userId).maybeSingle();
        if (owner) return true;
        const { data: shared } = await supabase
            .from('planning_shares').select('id').eq('planning_sheet_id', sheetId).eq('user_id', userId).maybeSingle();
        return !!shared;
    };

    // --- Sheets ---

    router.get('/', authenticateUser, async (req, res) => {
        try {
            const { data: owned, error } = await supabase
                .from('planning_sheets').select('*').eq('user_id', req.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const { data: shares } = await supabase
                .from('planning_shares').select('planning_sheet_id').eq('user_id', req.user.id);

            let sharedSheets = [];
            if (shares && shares.length > 0) {
                const { data: shared } = await supabase
                    .from('planning_sheets').select('*').in('id', shares.map(s => s.planning_sheet_id))
                    .order('created_at', { ascending: false });
                if (shared) sharedSheets = shared.map(s => ({ ...s, is_shared_with_me: true }));
            }

            res.json([...owned, ...sharedSheets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const { data, error } = await supabase
            .from('planning_sheets').insert([{ name, user_id: req.user.id }]).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { error } = await supabase
            .from('planning_sheets').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Sheet deleted successfully' });
    });

    router.post('/:id/share', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        try {
            const { data: sheet } = await supabase
                .from('planning_sheets').select('id').eq('id', id).eq('user_id', req.user.id).single();
            if (!sheet) return res.status(403).json({ error: 'Unauthorized or sheet not found' });

            let targetUserId = null;
            const { data: profile } = await supabase
                .from('profiles').select('id').eq('email', email).maybeSingle();
            if (profile) {
                targetUserId = profile.id;
            } else {
                const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                if (users) {
                    const found = users.find(u => u.email === email);
                    if (found) targetUserId = found.id;
                }
            }

            if (!targetUserId) return res.status(404).json({ error: 'User not found' });

            const { error: shareError } = await supabaseAdmin
                .from('planning_shares').insert([{ planning_sheet_id: id, user_id: targetUserId }]);
            if (shareError) {
                if (shareError.code === '23505') return res.status(400).json({ error: 'Already shared' });
                throw shareError;
            }
            res.json({ message: `Shared with ${email}` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
