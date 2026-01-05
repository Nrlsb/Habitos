import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

    const value = {
        planillas,
        expenses,
        loading,
        error,
        addPlanilla,
        deletePlanilla,
        getExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
    };

    return (
        <ExpensesContext.Provider value={value}>
            {children}
        </ExpensesContext.Provider>
    );
};
