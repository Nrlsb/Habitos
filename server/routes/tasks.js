const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    const checkAccess = async (sheetId, userId) => {
        const { data: owner } = await supabase
            .from('planning_sheets').select('id').eq('id', sheetId).eq('user_id', userId).maybeSingle();
        if (owner) return true;
        const { data: shared } = await supabase
            .from('planning_shares').select('id').eq('planning_sheet_id', sheetId).eq('user_id', userId).maybeSingle();
        return !!shared;
    };

    router.get('/', authenticateUser, async (req, res) => {
        const { sheet_id, start_date, end_date } = req.query;
        if (!sheet_id) return res.status(400).json({ error: 'sheet_id is required' });
        if (!(await checkAccess(sheet_id, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized access to this sheet' });

        let query = supabase.from('tasks').select('*')
            .eq('planning_sheet_id', sheet_id).order('due_date', { ascending: true });
        if (start_date && end_date) {
            query = query.gte('due_date', `${start_date}T00:00:00`).lte('due_date', `${end_date}T23:59:59`);
        }
        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { title, description, due_date, priority, sheet_id } = req.body;
        if (!title || !due_date || !sheet_id)
            return res.status(400).json({ error: 'Title, due_date and sheet_id are required' });
        if (!(await checkAccess(sheet_id, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized access to this sheet' });

        const { data, error } = await supabase.from('tasks').insert([{
            user_id: req.user.id, planning_sheet_id: sheet_id, title,
            description: description || '', due_date, priority: priority || 'medium', is_completed: false
        }]).select();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.put('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { data: task } = await supabase.from('tasks').select('planning_sheet_id').eq('id', id).single();
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (!(await checkAccess(task.planning_sheet_id, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized' });

        const { title, description, due_date, priority, is_completed } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (due_date !== undefined) updates.due_date = due_date;
        if (priority !== undefined) updates.priority = priority;
        if (is_completed !== undefined) updates.is_completed = is_completed;

        const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { data: task } = await supabase.from('tasks').select('planning_sheet_id').eq('id', id).single();
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (!(await checkAccess(task.planning_sheet_id, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Task deleted' });
    });

    return router;
};
