import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

const ExpensesContext = createContext();

export const useExpenses = () => {
    return useContext(ExpensesContext);
};

export const ExpensesProvider = ({ children }) => {
    const { session } = useAuth();
    const [planillas, setPlanillas] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // Fetch planillas
    const fetchPlanillas = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/planillas`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch planillas');
            const data = await response.json();
            setPlanillas(data);
        } catch (err) {
            setError(err.message);
            console.error("Error fetching planillas:", err);
        } finally {
            setLoading(false);
        }
    }, [API_URL, session]);

    useEffect(() => {
        fetchPlanillas();
    }, [fetchPlanillas]);

    // CRUD operations for Planillas
    const addPlanilla = useCallback(async (nombre) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ nombre }),
            });
            if (!response.ok) throw new Error('Failed to add planilla');
            await fetchPlanillas();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, fetchPlanillas]);

    const deletePlanilla = useCallback(async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to delete planilla');
            await fetchPlanillas();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, fetchPlanillas]);

    const sharePlanilla = useCallback(async (id, email) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${id}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to share planilla');
            }
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session]);

    // CRUD operations for Expenses
    const getExpenses = useCallback(async (planillaId) => {
        if (!planillaId || !session) return;
        try {
            const response = await fetch(`${API_URL}/api/planillas/${planillaId}/expenses`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch expenses');
            const data = await response.json();
            setExpenses(data);
        } catch (err) {
            setError(err.message);
        }
    }, [API_URL, session]);

    const addExpense = useCallback(async (planillaId, newExpense) => {
        // newExpense now includes 'date' if provided by frontend
        try {
            const response = await fetch(`${API_URL}/api/planillas/${planillaId}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(newExpense),
            });
            if (!response.ok) throw new Error('Failed to add expense');
            await getExpenses(planillaId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, getExpenses]);

    const updateExpense = useCallback(async (planillaId, expenseId, updatedExpense) => {
        try {
            const response = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(updatedExpense),
            });
            if (!response.ok) throw new Error('Failed to update expense');
            await getExpenses(planillaId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, getExpenses]);

    // Perform Rollover (Start Month)
    const performMonthRollover = useCallback(async (planillaId, targetDate, selectedExpenseIds = []) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${planillaId}/rollover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ targetDate, selectedExpenseIds }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to perform month rollover');
            }

            // Refresh expenses to show new ones
            await getExpenses(planillaId);
            return await response.json();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, getExpenses]);

    const deleteExpense = useCallback(async (planillaId, expenseId) => {
        try {
            const response = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to delete expense');
            await getExpenses(planillaId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, getExpenses]);

    const copyExpensesToPlanilla = useCallback(async (sourceId, targetId) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${targetId}/expenses/copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ sourcePlanillaId: sourceId }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to copy expenses');
            }
            // No need to refresh current planilla unless we copied TO current planilla (unlikely use case but possible)
            // If targetId === the currently viewed one, we should refresh.
            // But usually we view source. 

        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session]);

    // Daily Expenses
    const [dailyExpenses, setDailyExpenses] = useState([]);

    const getDailyExpenses = useCallback(async (dateOrString) => {
        if (!session) return;
        setLoading(true);
        try {
            let from, to;

            if (typeof dateOrString === 'string') {
                // Fallback for string (YYYY-MM-DD) - though we try to move away from this
                // Treat strings as local date start
                const [year, month, day] = dateOrString.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                from = startOfDay(date).toISOString();
                to = endOfDay(date).toISOString();
            } else {
                // It's a Date object
                from = startOfDay(dateOrString).toISOString();
                to = endOfDay(dateOrString).toISOString();
            }

            const queryParams = new URLSearchParams({
                from: from,
                to: to
            });
            const url = `${API_URL}/api/expenses/daily?${queryParams.toString()}`;
            console.log("Fetching Daily Expenses URL:", url);

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch daily expenses');
            const data = await response.json();
            setDailyExpenses(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [API_URL, session]);

    const value = {
        planillas,
        expenses,
        dailyExpenses, // Add to context
        loading,
        error,
        addPlanilla,
        deletePlanilla,
        getExpenses,
        getDailyExpenses, // Add to context
        addExpense,
        updateExpense,
        deleteExpense,
        sharePlanilla,
        copyExpensesToPlanilla,
        performMonthRollover
    };

    return (
        <ExpensesContext.Provider value={value}>
            {children}
        </ExpensesContext.Provider>
    );
};
