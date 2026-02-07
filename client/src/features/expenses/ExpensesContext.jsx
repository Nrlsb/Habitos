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
    const [categories, setCategories] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dolarOficial, setDolarOficial] = useState(null);
    const [dolarTarjeta, setDolarTarjeta] = useState(null);

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

    const fetchCategories = useCallback(async () => {
        if (!session) return;
        try {
            const response = await fetch(`${API_URL}/api/categories`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            setCategories(data);
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    }, [API_URL, session]);

    const fetchSubscriptions = useCallback(async () => {
        if (!session) return;
        try {
            const response = await fetch(`${API_URL}/api/subscriptions`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch subscriptions');
            const data = await response.json();
            setSubscriptions(data);
        } catch (err) {
            console.error("Error fetching subscriptions:", err);
        }
    }, [API_URL, session]);

    const fetchDolar = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/bna`);
            if (response.ok) {
                const data = await response.json();
                setDolarOficial(data.venta_billete);
                // Calculo aproximado Dólar Tarjeta: Oficial + 30% Impuesto PAIS + 30% Ganancias ~ 60% recargo
                // O usar cotización directa si estuviera disponible.
                // Asumimos 1.6x del oficial aprox o ajustamos según regulación actual.
                // BNA suele devolver dolar oficial minorista. 
                // A fecha 2026? Asumimos un factor genérico o usamos el valor si viniera.
                // Usaremos 1.6 (60% impuestos) a falta de dato exacto.
                setDolarTarjeta(data.venta_billete * 1.6);
            }
        } catch (error) {
            console.error("Error fetching BNA:", error);
        }
    }, [API_URL]);

    useEffect(() => {
        fetchDolar(); // Fetch publico
        if (session) {
            fetchPlanillas();
            fetchCategories();
            fetchSubscriptions();
        }
    }, [fetchPlanillas, fetchCategories, fetchSubscriptions, fetchDolar, session]);

    // CRUD operations for Planillas
    const addPlanilla = useCallback(async (nombre, participants = ['Yo']) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ nombre, participants }),
            });
            if (!response.ok) throw new Error('Failed to add planilla');
            await fetchPlanillas();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, fetchPlanillas]);

    const updatePlanilla = useCallback(async (id, updates) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Failed to update planilla');
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

    const addCategory = useCallback(async (category) => {
        try {
            const response = await fetch(`${API_URL}/api/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(category),
            });
            if (!response.ok) throw new Error('Failed to add category');
            await fetchCategories();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, fetchCategories]);

    const deleteCategory = useCallback(async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/categories/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to delete category');
            await fetchCategories();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, fetchCategories]);

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
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add expense');
            }
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
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update expense');
            }
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

    const copyExpensesToPlanilla = useCallback(async (sourceId, targetId, expenseIds = []) => {
        try {
            const response = await fetch(`${API_URL}/api/planillas/${targetId}/expenses/copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ sourcePlanillaId: sourceId, expenseIds }),
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

    // Budgets API
    const getBudgets = useCallback(async (month, planillaId) => {
        if (!session) return [];
        try {
            const url = planillaId
                ? `${API_URL}/api/budgets?month=${month}&planilla_id=${planillaId}`
                : `${API_URL}/api/budgets?month=${month}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch budgets');
            return await response.json();
        } catch (err) {
            console.error("Error fetching budgets:", err);
            return [];
        }
    }, [API_URL, session]);

    const upsertBudget = useCallback(async (budgetData) => {
        try {
            const response = await fetch(`${API_URL}/api/budgets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(budgetData),
            });
            if (!response.ok) throw new Error('Failed to save budget');
            return await response.json();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session]);

    // Subscriptions API
    const addSubscription = useCallback(async (subData) => {
        try {
            const response = await fetch(`${API_URL}/api/subscriptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(subData),
            });
            if (!response.ok) throw new Error('Failed to add subscription');
            await fetchSubscriptions();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, fetchSubscriptions]);

    const updateSubscription = useCallback(async (id, subData) => {
        try {
            const response = await fetch(`${API_URL}/api/subscriptions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(subData),
            });
            if (!response.ok) throw new Error('Failed to update subscription');
            await fetchSubscriptions();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, fetchSubscriptions]);

    const deleteSubscription = useCallback(async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/subscriptions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to delete subscription');
            await fetchSubscriptions();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, fetchSubscriptions]);

    const generateSubscriptionExpense = useCallback(async (id, date, planillaId) => {
        try {
            const response = await fetch(`${API_URL}/api/subscriptions/${id}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ date, planilla_id: planillaId }),
            });
            if (!response.ok) throw new Error('Failed to generate expense');
            await getExpenses(planillaId); // Refresh expenses
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [API_URL, session, getExpenses]);

    const value = {
        planillas,
        expenses,
        categories,
        subscriptions,
        dailyExpenses, // Add to context
        loading,
        error,
        addPlanilla,
        updatePlanilla, // Added
        deletePlanilla,
        fetchCategories,
        addCategory,
        deleteCategory,
        getExpenses,
        getDailyExpenses, // Add to context
        addExpense,
        updateExpense,
        deleteExpense,
        sharePlanilla,
        copyExpensesToPlanilla,
        performMonthRollover,
        getBudgets,
        upsertBudget,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        generateSubscriptionExpense,
        dolarOficial,
        dolarTarjeta
    };

    return (
        <ExpensesContext.Provider value={value}>
            {children}
        </ExpensesContext.Provider>
    );
};
