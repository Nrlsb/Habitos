const express = require('express');

module.exports = (supabase, authenticateUser) => {
    const router = express.Router();

    // GET /api/activities - Obtener historial de caminatas
    router.get('/', authenticateUser, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('walk_sessions')
                .select('*')
                .eq('user_id', req.user.id)
                .order('start_time', { ascending: false });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error('Error fetching activities:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/activities - Guardar sesión de caminata
    router.post('/', authenticateUser, async (req, res) => {
        const { start_time, end_time, distance, steps, path } = req.body;
        try {
            const { data, error } = await supabase
                .from('walk_sessions')
                .insert([{
                    user_id: req.user.id,
                    start_time,
                    end_time,
                    distance,
                    steps,
                    path
                }])
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error('Error saving activity:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
