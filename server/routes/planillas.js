const express = require('express');
const router = express.Router();

module.exports = (supabase, supabaseAdmin, authenticateUser) => {

    const checkPlanillaAccess = async (planillaId, userId) => {
        const { data: owner } = await supabase
            .from('planillas').select('id').eq('id', planillaId).eq('user_id', userId).maybeSingle();
        if (owner) return true;

        const { data: shared } = await supabase
            .from('planilla_shares').select('id').eq('planilla_id', planillaId).eq('user_id', userId).maybeSingle();
        return !!shared;
    };

    // --- PLANILLAS ---

    router.get('/', authenticateUser, async (req, res) => {
        try {
            const { data: owned, error: ownedError } = await supabase
                .from('planillas').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
            if (ownedError) throw ownedError;

            const { data: shares } = await supabase
                .from('planilla_shares').select('planilla_id').eq('user_id', req.user.id);

            let sharedPlanillas = [];
            if (shares && shares.length > 0) {
                const { data: shared } = await supabase
                    .from('planillas').select('*').in('id', shares.map(s => s.planilla_id))
                    .order('created_at', { ascending: false });
                if (shared) sharedPlanillas = shared.map(p => ({ ...p, is_shared_with_me: true }));
            }

            const allPlanillas = [...owned, ...sharedPlanillas]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            res.json(allPlanillas);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', authenticateUser, async (req, res) => {
        const { nombre, participants } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Name is required' });

        const { data, error } = await supabase
            .from('planillas')
            .insert([{ user_id: req.user.id, nombre, participants: participants || ['Yo'] }])
            .select();

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.put('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { nombre, participants } = req.body;
        const updates = {};
        if (nombre) updates.nombre = nombre;
        if (participants) updates.participants = participants;

        const { data, error } = await supabase
            .from('planillas').update(updates).eq('id', id).eq('user_id', req.user.id).select();

        if (error) return res.status(500).json({ error: error.message });
        if (data.length === 0) return res.status(404).json({ error: 'Planilla not found or permission denied' });
        res.json(data[0]);
    });

    router.post('/:id/share', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        try {
            const { data: planilla } = await supabase
                .from('planillas').select('id').eq('id', id).eq('user_id', req.user.id).single();
            if (!planilla) return res.status(403).json({ error: 'Unauthorized or planilla not found' });

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

            if (!targetUserId) return res.status(404).json({ error: 'User not found with this email' });

            const { error: shareError } = await supabaseAdmin
                .from('planilla_shares').insert([{ planilla_id: id, user_id: targetUserId }]);

            if (shareError) {
                if (shareError.code === '23505') return res.status(400).json({ error: 'Planilla already shared with this user' });
                throw shareError;
            }
            res.json({ message: `Planilla shared with ${email}` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/:id', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { error } = await supabase
            .from('planillas').delete().eq('id', id).eq('user_id', req.user.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Planilla deleted successfully' });
    });

    // --- EXPENSES ---

    router.get('/:planillaId/expenses', authenticateUser, async (req, res) => {
        const { planillaId } = req.params;
        if (!(await checkPlanillaAccess(planillaId, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized or planilla not found' });

        const { data, error } = await supabase
            .from('expenses').select('*').eq('planilla_id', planillaId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    router.post('/:planillaId/expenses', authenticateUser, async (req, res) => {
        const { planillaId } = req.params;
        if (!(await checkPlanillaAccess(planillaId, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized or planilla not found' });

        const { description, amount, currency, category, esCompartido, enCuotas,
            cuotaActual, totalCuotas, payer_name, split_details, credit_card_id } = req.body;

        const { data, error } = await supabase
            .from('expenses')
            .insert([{
                planilla_id: planillaId, description, amount,
                currency: currency || 'ARS',
                category: category || 'General',
                is_shared: esCompartido || false,
                is_installment: enCuotas || false,
                current_installment: cuotaActual || null,
                total_installments: totalCuotas || null,
                payer_name: esCompartido ? payer_name : null,
                created_at: req.body.date || new Date().toISOString(),
                split_details: split_details || null,
                credit_card_id: credit_card_id || null
            }])
            .select();

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data[0]);
    });

    router.post('/:targetId/expenses/copy', authenticateUser, async (req, res) => {
        const { targetId } = req.params;
        const { sourcePlanillaId, expenseIds } = req.body;

        if (!sourcePlanillaId) return res.status(400).json({ error: 'Source Planilla ID is required' });
        if (!(await checkPlanillaAccess(targetId, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized access to target planilla' });
        if (!(await checkPlanillaAccess(sourcePlanillaId, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized access to source planilla' });

        try {
            const { data: sourceExpenses, error: fetchError } = await supabase
                .from('expenses').select('*').eq('planilla_id', sourcePlanillaId);
            if (fetchError) throw fetchError;
            if (!sourceExpenses || sourceExpenses.length === 0)
                return res.json({ message: 'No expenses to copy', count: 0 });

            let expensesToCopy = (expenseIds && expenseIds.length > 0)
                ? sourceExpenses.filter(e => expenseIds.includes(e.id))
                : sourceExpenses;

            if (expensesToCopy.length === 0)
                return res.json({ message: 'No matching expenses to copy', count: 0 });

            const toInsert = expensesToCopy.map(e => ({
                planilla_id: targetId, description: e.description, amount: e.amount,
                currency: e.currency, category: e.category, is_shared: e.is_shared,
                payer_name: e.payer_name, is_installment: e.is_installment,
                current_installment: e.current_installment,
                total_installments: e.total_installments, created_at: e.created_at,
                split_details: e.split_details, credit_card_id: e.credit_card_id
            }));

            const { data: inserted, error: insertError } = await supabase
                .from('expenses').insert(toInsert).select();
            if (insertError) throw insertError;
            res.json({ message: 'Expenses copied successfully', count: inserted.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/:id/rollover', authenticateUser, async (req, res) => {
        const { id } = req.params;
        const { targetDate, selectedExpenseIds } = req.body;
        if (!targetDate) return res.status(400).json({ error: 'Target date is required' });

        const target = new Date(targetDate);
        const prevMonthDate = new Date(target);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const startPrev = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString();
        const endPrev = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();

        if (!(await checkPlanillaAccess(id, req.user.id)))
            return res.status(403).json({ error: 'Unauthorized or planilla not found' });

        try {
            const { data: previousExpenses, error: fetchError } = await supabase
                .from('expenses').select('*').eq('planilla_id', id)
                .gte('created_at', startPrev).lt('created_at', endPrev);
            if (fetchError) throw fetchError;
            if (!previousExpenses || previousExpenses.length === 0)
                return res.json({ message: 'No expenses found in previous month', count: 0 });

            let expensesToProcess = previousExpenses;
            if (selectedExpenseIds && selectedExpenseIds.length > 0) {
                expensesToProcess = previousExpenses.filter(e => selectedExpenseIds.includes(e.id));
            } else {
                expensesToProcess = previousExpenses.filter(e =>
                    e.is_installment && (!e.total_installments || e.current_installment < e.total_installments));
            }

            if (expensesToProcess.length === 0)
                return res.json({ message: 'No expenses selected or found to rollover', count: 0 });

            const toInsert = expensesToProcess.map(e => ({
                planilla_id: id, description: e.description, amount: e.amount,
                currency: e.currency, category: e.category, is_shared: e.is_shared,
                payer_name: e.payer_name,
                is_installment: e.is_installment,
                current_installment: e.is_installment ? (e.current_installment + 1) : null,
                total_installments: e.total_installments,
                created_at: targetDate
            }));

            const { data: inserted, error: insertError } = await supabase
                .from('expenses').insert(toInsert).select();
            if (insertError) throw insertError;
            res.json({ message: 'Month rollover successful', count: inserted.length, details: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
