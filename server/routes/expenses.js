const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateUser) => {

    // Update an expense
    router.put('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;

        const { data: expense, error: fetchError } = await supabase
            .from('expenses').select('planilla_id').eq('id', id).single();
        if (fetchError || !expense) return res.status(404).json({ error: 'Expense not found' });

        const { data: planilla } = await supabase
            .from('planillas').select('id').eq('id', expense.planilla_id).eq('user_id', req.user.id).single();
        if (!planilla) return res.status(403).json({ error: 'Unauthorized' });

        const { description, amount, currency, category, esCompartido, enCuotas,
            cuotaActual, totalCuotas, payer_name, split_details } = req.body;

        const { data, error } = await supabase
            .from('expenses')
            .update({
                description, amount, currency, category,
                is_shared: esCompartido, is_installment: enCuotas,
                current_installment: cuotaActual, total_installments: totalCuotas,
                payer_name: esCompartido ? payer_name : null,
                created_at: req.body.date,
                split_details: split_details || null
            })
            .eq('id', id).select();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    });

    // Delete an expense
    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;

        const { data: expense } = await supabase
            .from('expenses').select('planilla_id').eq('id', id).single();
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        const { data: planilla } = await supabase
            .from('planillas').select('id').eq('id', expense.planilla_id).eq('user_id', req.user.id).single();
        if (!planilla) return res.status(403).json({ error: 'Unauthorized' });

        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Expense deleted successfully' });
    });

    // Get daily expenses (aggregated from all owned/shared planillas)
    router.get('/daily', authenticateUser, async (req, res) => {
        const { date, from, to } = req.query;
        if (!date && (!from || !to))
            return res.status(400).json({ error: 'Date or date range (from, to) is required' });

        try {
            const { data: owned } = await supabase
                .from('planillas').select('id').eq('user_id', req.user.id);
            const { data: shares } = await supabase
                .from('planilla_shares').select('planilla_id').eq('user_id', req.user.id);

            const ownedIds = owned ? owned.map(p => p.id) : [];
            const sharedIds = shares ? shares.map(s => s.planilla_id) : [];
            const allPlanillaIds = [...new Set([...ownedIds, ...sharedIds])];

            if (allPlanillaIds.length === 0) return res.json([]);

            const startDate = from || `${date}T00:00:00`;
            const endDate = to || `${date}T23:59:59.999`;

            const { data: expenses, error } = await supabase
                .from('expenses')
                .select('*, planillas(id, nombre, user_id)')
                .in('planilla_id', allPlanillaIds)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(expenses);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
