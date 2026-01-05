import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { startOfWeek, endOfWeek, format, startOfDay, endOfDay } from 'date-fns';

const PlanningContext = createContext();

export const usePlanning = () => useContext(PlanningContext);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const PlanningProvider = ({ children }) => {
    const { session } = useAuth();

    // Sheets State
    const [sheets, setSheets] = useState([]);
    const [currentSheetId, setCurrentSheetId] = useState(null);

    // Tasks State
    const [tasks, setTasks] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch Sheets
    const fetchSheets = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/planning-sheets`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSheets(data);
                // Select first sheet if none selected and data exists
                if (data.length > 0 && !currentSheetId) {
                    setCurrentSheetId(data[0].id);
                }
            } else {
                throw new Error('Failed to fetch sheets');
            }
        } catch (err) {
            console.error("Error fetching sheets:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [session, currentSheetId]); // Depend on currentSheetId to avoid overriding selection during re-fetches if logic changes

    useEffect(() => {
        fetchSheets();
    }, [fetchSheets]);

    // Fetch Tasks for Current Sheet
    const fetchTasks = useCallback(async (view, currentDate) => {
        if (!session || !currentSheetId) return;

        setLoading(true);
        try {
            let start, end;
            if (view === 'weekly') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else {
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
            }

            const queryCurrent = `sheet_id=${currentSheetId}&start_date=${format(start, 'yyyy-MM-dd')}&end_date=${format(end, 'yyyy-MM-dd')}`;

            const response = await fetch(`${API_URL}/api/tasks?${queryCurrent}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setTasks(data);
            }
        } catch (err) {
            console.error("Error fetching tasks:", err);
        } finally {
            setLoading(false);
        }
    }, [session, currentSheetId]);

    // --- Sheet Actions ---

    const createSheet = async (name) => {
        try {
            const response = await fetch(`${API_URL}/api/planning-sheets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                const newSheet = await response.json();
                setSheets([newSheet, ...sheets]);
                setCurrentSheetId(newSheet.id);
                return newSheet;
            }
        } catch (err) {
            console.error("Error creating sheet:", err);
            throw err;
        }
    };

    const deleteSheet = async (id) => {
        try {
            await fetch(`${API_URL}/api/planning-sheets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const newSheets = sheets.filter(s => s.id !== id);
            setSheets(newSheets);
            if (currentSheetId === id) {
                setCurrentSheetId(newSheets.length > 0 ? newSheets[0].id : null);
            }
        } catch (err) {
            console.error("Error deleting sheet:", err);
        }
    };

    const shareSheet = async (id, email) => {
        const response = await fetch(`${API_URL}/api/planning-sheets/${id}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to share');
        }
    };

    // --- Task Actions ---

    const addTask = async (taskData) => {
        if (!currentSheetId) return;
        try {
            const response = await fetch(`${API_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ ...taskData, sheet_id: currentSheetId })
            });

            if (response.ok) {
                const newTask = await response.json();
                // Optimistically add if date matches current view? Easier to just refetch or rely on caller to refetch.
                // We'll update state directly for smoother UX
                setTasks([...tasks, newTask]);
                // Note: Simple push might result in wrong order or inclusion if date filter applies.
                // Caller usually triggers fetchTasks to be safe, but let's try to keep it synced.
            }
        } catch (err) {
            console.error("Error adding task:", err);
        }
    };

    const updateTask = async (id, updates) => {
        try {
            // Optimistic update
            setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

            await fetch(`${API_URL}/api/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(updates)
            });
        } catch (err) {
            console.error("Error updating task:", err);
            // Revert could be here by re-fetching
        }
    };

    const deleteTask = async (id) => {
        try {
            // Optimistic update
            setTasks(prev => prev.filter(t => t.id !== id));

            await fetch(`${API_URL}/api/tasks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
        } catch (err) {
            console.error("Error deleting task:", err);
        }
    };

    const value = {
        sheets,
        currentSheetId,
        setCurrentSheetId,
        tasks,
        loading,
        error,
        fetchTasks,
        createSheet,
        deleteSheet,
        shareSheet,
        addTask,
        updateTask,
        deleteTask
    };

    return (
        <PlanningContext.Provider value={value}>
            {children}
        </PlanningContext.Provider>
    );
};
