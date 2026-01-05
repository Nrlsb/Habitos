import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, isSameDay, parseISO, isToday, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CheckCircle, Circle, Calendar, Layout, Trash2, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Planning = () => {
    const { session } = useAuth();
    const [view, setView] = useState('weekly'); // 'daily' | 'weekly'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('medium');
    const [newTaskDate, setNewTaskDate] = useState(new Date()); // For specific date add
    const [isAdding, setIsAdding] = useState(false); // To show/hide modal or inline form

    // Fetch Tasks
    const fetchTasks = async () => {
        if (!session) return;
        setLoading(true);
        try {
            // Determine date range based on view
            let start, end;
            if (view === 'weekly') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else {
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
            }

            const queryCurrent = `start_date=${format(start, 'yyyy-MM-dd')}&end_date=${format(end, 'yyyy-MM-dd')}`;

            const response = await fetch(`${API_URL}/api/tasks?${queryCurrent}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setTasks(data);
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [currentDate, view, session]);

    // Handlers
    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const response = await fetch(`${API_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    title: newTaskTitle,
                    due_date: newTaskDate.toISOString(),
                    priority: newTaskPriority
                })
            });

            if (response.ok) {
                setNewTaskTitle('');
                setIsAdding(false);
                fetchTasks();
            }
        } catch (error) {
            console.error("Error adding task:", error);
        }
    };

    const toggleTask = async (task) => {
        try {
            // Optimistic update
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
            );
            setTasks(updatedTasks);

            await fetch(`${API_URL}/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ is_completed: !task.is_completed })
            });
        } catch (error) {
            console.error("Error toggling task:", error);
            fetchTasks(); // Revert on error
        }
    };

    const deleteTask = async (id) => {
        if (!window.confirm('¿Eliminar tarea?')) return;
        try {
            await fetch(`${API_URL}/api/tasks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            setTasks(tasks.filter(t => t.id !== id));
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    // Navigation
    const nextPeriod = () => {
        if (view === 'weekly') setCurrentDate(d => addDays(d, 7));
        else setCurrentDate(d => addDays(d, 1));
    };

    const prevPeriod = () => {
        if (view === 'weekly') setCurrentDate(d => subDays(d, 7));
        else setCurrentDate(d => subDays(d, 1));
    };

    const goToToday = () => setCurrentDate(new Date());

    // Render Helpers
    const getWeekDays = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    };

    const getPriorityColor = (p) => {
        switch (p) {
            case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'medium': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            default: return 'text-slate-400 bg-slate-400/10';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button onClick={prevPeriod} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-center min-w-[200px]">
                        <h2 className="text-lg font-semibold text-slate-200 capitalize">
                            {view === 'weekly'
                                ? `Semana ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`
                                : format(currentDate, "EEEE d 'de' MMMM", { locale: es })
                            }
                        </h2>
                    </div>
                    <button onClick={nextPeriod} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                    <button onClick={goToToday} className="text-xs font-bold uppercase text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors ml-2">
                        Hoy
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-700 flex">
                        <button
                            onClick={() => setView('weekly')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${view === 'weekly' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Layout size={16} /> <span className="hidden sm:inline">Semana</span>
                        </button>
                        <button
                            onClick={() => setView('daily')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${view === 'daily' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Calendar size={16} /> <span className="hidden sm:inline">Día</span>
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setNewTaskDate(view === 'daily' ? currentDate : new Date());
                            setIsAdding(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Nueva Tarea</span>
                    </button>
                </div>
            </div>

            {/* Modal for Adding Task */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Nueva Tarea</h3>
                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="¿Qué tienes que hacer?"
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={format(newTaskDate, 'yyyy-MM-dd')}
                                        onChange={(e) => setNewTaskDate(parseISO(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Prioridad</label>
                                    <select
                                        value={newTaskPriority}
                                        onChange={(e) => setNewTaskPriority(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    >
                                        <option value="low">Baja</option>
                                        <option value="medium">Media</option>
                                        <option value="high">Alta</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="text-slate-300 hover:text-white px-4 py-2"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Views */}
            {view === 'weekly' ? (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {getWeekDays().map((day) => {
                        const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), day));
                        const isDayToday = isToday(day);

                        return (
                            <div key={day.toISOString()} className={`flex flex-col h-full min-h-[200px] rounded-xl border ${isDayToday ? 'bg-slate-800/80 border-indigo-500/50 ring-1 ring-indigo-500/20' : 'bg-slate-800/30 border-slate-700/30'}`}>
                                <div className={`p-3 text-center border-b ${isDayToday ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-slate-700/30'}`}>
                                    <span className={`text-xs font-bold uppercase block mb-1 ${isDayToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                                        {format(day, 'EEE', { locale: es })}
                                    </span>
                                    <span className={`text-xl font-bold ${isDayToday ? 'text-white' : 'text-slate-300'}`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>

                                <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[500px]">
                                    {dayTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className={`group p-2.5 rounded-lg border transition-all hover:shadow-md ${task.is_completed ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <button
                                                    onClick={() => toggleTask(task)}
                                                    className={`mt-0.5 flex-shrink-0 transition-colors ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-indigo-400'}`}
                                                >
                                                    {task.is_completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${task.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                        {task.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                                                        </span>
                                                        <button
                                                            onClick={() => deleteTask(task.id)}
                                                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => {
                                            setNewTaskDate(day);
                                            setIsAdding(true);
                                        }}
                                        className="w-full py-2 text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-700/30 rounded-lg border border-transparent hover:border-slate-700/50 dashed border-2 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        + Agregar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="max-w-3xl mx-auto">
                    {/* Daily View */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm min-h-[500px]">
                        {tasks.length === 0 ? (
                            <div className="text-center py-20 text-slate-500">
                                <Clock size={48} className="mx-auto mb-4 opacity-30" />
                                <p>No hay tareas para este día.</p>
                                <button
                                    onClick={() => {
                                        setNewTaskDate(currentDate);
                                        setIsAdding(true);
                                    }}
                                    className="mt-4 text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                    Crear una tarea
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tasks.map(task => (
                                    <div
                                        key={task.id}
                                        className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${task.is_completed ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-indigo-500/30 hover:shadow-lg'}`}
                                    >
                                        <button
                                            onClick={() => toggleTask(task)}
                                            className={`p-1 rounded-full transition-colors ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                                        >
                                            {task.is_completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                                        </button>

                                        <div className="flex-1">
                                            <h4 className={`text-lg font-medium ${task.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                {task.title}
                                            </h4>
                                            {task.description && <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg border ${getPriorityColor(task.priority)} font-medium`}>
                                                {task.priority.toUpperCase()}
                                            </span>
                                            <button
                                                onClick={() => deleteTask(task.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;
