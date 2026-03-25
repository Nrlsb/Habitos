const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://192.168.0.18:3000',
        'http://192.168.0.18:5173',
        'http://localhost',
        'capacitor://localhost',
        'https://localhost',
        /\.vercel\.app$/,
        /\.onrender\.com$/
    ],
    credentials: true
}));
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL ERROR: Supabase URL or Key is missing in environment variables!');
    process.exit(1);
}

// Service role key bypasses RLS; security is enforced at the route level via req.user.id
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);
const supabaseAdmin = supabase;

const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid token' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Authentication error' });
    }
};

app.get('/', (req, res) => res.send('Habit Tracker Backend'));

app.use('/api/habits',          require('./routes/habits')(supabase, authenticateUser));
app.use('/api/meals',           require('./routes/meals')(supabase, authenticateUser));
app.use('/api/planillas',       require('./routes/planillas')(supabase, supabaseAdmin, authenticateUser));
app.use('/api/expenses',        require('./routes/expenses')(supabase, authenticateUser));
app.use('/api/planning-sheets', require('./routes/planning')(supabase, supabaseAdmin, authenticateUser));
app.use('/api/tasks',           require('./routes/tasks')(supabase, authenticateUser));
app.use('/api/categories',      require('./routes/categories')(supabase, authenticateUser));
app.use('/api/budgets',         require('./routes/budgets')(supabase, authenticateUser));
app.use('/api/subscriptions',   require('./routes/subscriptions')(supabase, authenticateUser));
app.use('/api/bna',             require('./routes/bna')());
app.use('/api/parse-pdf',       require('./routes/parsePdf')(authenticateUser));

app.listen(port, () => console.log(`Server running on port ${port}`));
