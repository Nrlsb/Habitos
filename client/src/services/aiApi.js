const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const aiPost = async (endpoint, body, token) => {
    try {
        const res = await fetch(`${API_URL}/api/ai/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `AI error ${res.status}`);
        }

        return res.json();
    } catch (error) {
        console.error(`[AI API] ${endpoint}:`, error.message);
        throw error;
    }
};

export const categorizeExpense = (description, token) =>
    aiPost('categorize', { description }, token);

export const getExpenseInsights = (expenses, month, dolarRate, token) =>
    aiPost('expense-insights', { expenses, month, dolarRate }, token);

export const sendChatMessage = (messages, context, token) =>
    aiPost('chat', { messages, context }, token);

export const getHabitPrediction = (habit, completions, currentStreak, token) =>
    aiPost('habit-prediction', { habit, completions, currentStreak }, token);

export const getHabitCoaching = (habits, token) =>
    aiPost('habit-coaching', { habits }, token);

export const getWeeklyInsights = (expenses, habits, weekStart, token) =>
    aiPost('weekly-insights', { expenses, habits, weekStart }, token);
