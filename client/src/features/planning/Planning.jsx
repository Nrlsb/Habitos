import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, isSameDay, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CheckCircle, Circle, Calendar, Layout, Trash2, Clock, Share2, Users, FolderPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlanning } from './PlanningContext';

const Planning = () => {
    const {
        sheets,
        currentSheetId,
        setCurrentSheetId,
        tasks,
        fetchTasks,
        createSheet,
        deleteSheet,
        shareSheet,
        addTask,
        updateTask,
        deleteTask
    } = usePlanning();

    const [view, setView] = useState('weekly'); // 'daily' | 'weekly'
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal States
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [isAddingSheet, setIsAddingSheet] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // Form States
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('medium');
    const [newTaskDate, setNewTaskDate] = useState(new Date());

    const [newSheetName, setNewSheetName] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [shareMessage, setShareMessage] = useState({ type: '', text: '' });

    // Fetch tasks when date/view/sheet changes
    useEffect(() => {
        if (currentSheetId) {
            fetchTasks(view, currentDate);
        }
    }, [currentSheetId, view, currentDate, fetchTasks]);

    // Handlers
    const handleAddReport = async (e) => {
        e.preventDefault();
        if (!newSheetName.trim()) return;
        await createSheet(newSheetName);
        setNewSheetName('');
        setIsAddingSheet(false);
    };

    const handleShare = async (e) => {
        e.preventDefault();
        setShareMessage({ type: '', text: '' });
        try {
            await shareSheet(currentSheetId, shareEmail);
            setShareMessage({ type: 'success', text: `Invitación enviada a ${shareEmail}` });
            setShareEmail('');
            setTimeout(() => {
                setIsSharing(false);
                setShareMessage({ type: '', text: '' });
            }, 2000);
        } catch (err) {
            setShareMessage({ type: 'error', text: err.message });
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        await addTask({
            title: newTaskTitle,
            due_date: newTaskDate.toISOString(),
            priority: newTaskPriority
        });

        setNewTaskTitle('');
        setIsAddingTask(false);
        // fetchTasks triggered by dependency/optimistic update in context
        fetchTasks(view, currentDate);
    };

    const handleDeleteSheet = async (e) => {
        e.stopPropagation(); // prevent select trigger if button inside select area (though it's separate)
        if (!window.confirm('¿Seguro que quieres eliminar esta lista y todas sus tareas?')) return;
        await deleteSheet(currentSheetId);
    };

    // Navigation Utils
    const nextPeriod = () => view === 'weekly' ? setCurrentDate(d => addDays(d, 7)) : setCurrentDate(d => addDays(d, 1));
    const prevPeriod = () => view === 'weekly' ? setCurrentDate(d => subDays(d, 7)) : setCurrentDate(d => subDays(d, 1));
    const goToToday = () => setCurrentDate(new Date());

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

    const currentSheet = sheets.find(s => s.id === currentSheetId);

    // Render Empty State if no sheets
    if (sheets.length === 0 && !isAddingSheet) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <div className="bg-slate-800/50 p-6 rounded-full mb-6 border border-slate-700/50">
                    <Layout size={48} className="text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Comienza a Planificar</h2>
                <p className="text-slate-400 max-w-md mb-8">Crea tu primera lista de tareas para organizar tus proyectos, trabajo o vida personal.</p>
                <button
                    onClick={() => setIsAddingSheet(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all hover:scale-105"
                >
                    <FolderPlus size={20} /> Crear Nueva Lista
                </button>

                {/* Modal Create Sheet (Inline logic reused) */}
                {isAddingSheet && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                            <button onClick={() => setIsAddingSheet(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                            <h3 className="text-xl font-bold text-white mb-4">Nueva Lista</h3>
                            <form onSubmit={handleAddReport}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newSheetName}
                                    onChange={(e) => setNewSheetName(e.target.value)}
                                    placeholder="Nombre de la lista (ej. Trabajo)"
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                />
                                <button type="submit" disabled={!newSheetName.trim()} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium">Crear</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
            {/* Top Bar: Sheet Selection & Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none md:min-w-[240px]">
                        <select
                            value={currentSheetId || ''}
                            onChange={(e) => {
                                if (e.target.value === 'new') {
                                    setIsAddingSheet(true);
                                } else {
                                    setCurrentSheetId(e.target.value);
                                }
                            }}
                            className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-100 text-lg font-semibold rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer pr-10"
                        >
                            {sheets.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.is_shared_with_me ? `👥 ${s.name}` : s.name}
                                </option>
                            ))}
                            <option value="new" className="text-indigo-400 font-bold">+ Crear Nueva Lista</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <ChevronRight size={16} className="rotate-90" />
                        </div>
                    </div>

                    {currentSheet && !currentSheet.is_shared_with_me && (
                        <>
                            <button
                                onClick={() => setIsSharing(true)}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-xl border border-slate-700 hover:border-indigo-500/30 transition-all tooltip"
                                title="Compartir Lista"
                            >
                                <Share2 size={20} />
                            </button>
                            <button
                                onClick={handleDeleteSheet}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-red-400 rounded-xl border border-slate-700 hover:border-red-500/30 transition-all"
                                title="Eliminar Lista"
                            >
                                <Trash2 size={20} />
                            </button>
                        </>
                    )}
                </div>

                {/* View Switcher & Add Task */}
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-700 flex flex-1 md:flex-none">
                        <button
                            onClick={() => setView('weekly')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex justify-center items-center gap-2 ${view === 'weekly' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Layout size={16} /> <span className="hidden sm:inline">Semana</span>
                        </button>
                        <button
                            onClick={() => setView('daily')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex justify-center items-center gap-2 ${view === 'daily' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Calendar size={16} /> <span className="hidden sm:inline">Día</span>
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setNewTaskDate(view === 'daily' ? currentDate : new Date());
                            setIsAddingTask(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Tarea</span>
                    </button>
                </div>
            </div>

            {/* Date Navigation Header */}
            <div className="flex items-center justify-between mb-4 bg-slate-800/30 p-3 rounded-xl border border-slate-700/30">
                <button onClick={prevPeriod} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                <h2 className="text-md md:text-lg font-semibold text-slate-200 capitalize text-center">
                    {view === 'weekly'
                        ? `Semana ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`
                        : format(currentDate, "EEEE d 'de' MMMM", { locale: es })
                    }
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={goToToday} className="text-xs font-bold uppercase text-indigo-400 hover:text-indigo-300 mr-2">Hoy</button>
                    <button onClick={nextPeriod} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Content Views */}
            {view === 'weekly' ? (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {getWeekDays().map((day) => {
                        const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), day));
                        const isDayToday = isToday(day);

                        return (
                            <div key={day.toISOString()} className={`flex flex-col h-full min-h-[200px] rounded-xl border transition-all ${isDayToday ? 'bg-slate-800/80 border-indigo-500/50 ring-1 ring-indigo-500/10' : 'bg-slate-800/30 border-slate-700/30'}`}>
                                <div className={`p-2.5 text-center border-b ${isDayToday ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-slate-700/30'}`}>
                                    <span className={`text-xs font-bold uppercase block mb-0.5 ${isDayToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                                        {format(day, 'EEE', { locale: es })}
                                    </span>
                                    <span className={`text-lg font-bold ${isDayToday ? 'text-white' : 'text-slate-400'}`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                                <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[400px]">
                                    {dayTasks.map(task => (
                                        <div key={task.id} className={`p-2 rounded-lg border text-sm group ${task.is_completed ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                                            <div className="flex gap-2 items-start">
                                                <button onClick={() => updateTask(task.id, { is_completed: !task.is_completed })} className={`mt-0.5 ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-indigo-400'}`}>
                                                    {task.is_completed ? <CheckCircle size={14} /> : <Circle size={14} />}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`truncate font-medium ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</p>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className={`text-[9px] px-1 rounded border ${getPriorityColor(task.priority)} uppercase`}>{task.priority.slice(0, 3)}</span>
                                                        <button onClick={() => deleteTask(task.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => { setNewTaskDate(day); setIsAddingTask(true); }} className="w-full py-1.5 text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-700/30 rounded border border-transparent hover:border-slate-700/50 dashed border-2 opacity-0 group-hover:opacity-100 transition-all">+ Add</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="max-w-2xl mx-auto bg-slate-800/30 border border-slate-700/30 rounded-2xl p-6 min-h-[500px]">
                    {tasks.filter(t => isSameDay(parseISO(t.due_date), currentDate)).length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <Clock size={48} className="mx-auto mb-4 text-slate-600" />
                            <p className="text-slate-400">No hay tareas programadas.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.filter(t => isSameDay(parseISO(t.due_date), currentDate)).map(task => (
                                <div key={task.id} className={`p-4 rounded-xl border flex items-center gap-4 group ${task.is_completed ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 hover:border-indigo-500/30'}`}>
                                    <button onClick={() => updateTask(task.id, { is_completed: !task.is_completed })} className={`p-1 rounded-full ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'}`}>
                                        {task.is_completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                                    </button>
                                    <div className="flex-1">
                                        <h3 className={`text-lg font-medium ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</h3>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded border font-bold uppercase ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                                    <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {isAddingSheet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button onClick={() => setIsAddingSheet(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                        <h3 className="text-xl font-bold text-white mb-4">Nueva Lista</h3>
                        <form onSubmit={handleAddReport}>
                            <input
                                autoFocus
                                type="text"
                                value={newSheetName}
                                onChange={(e) => setNewSheetName(e.target.value)}
                                placeholder="Nombre de la lista"
                                className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAddingSheet(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancelar</button>
                                <button type="submit" disabled={!newSheetName.trim()} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isSharing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button onClick={() => setIsSharing(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Share2 size={20} className="text-indigo-400" /> Compartir Lista</h3>
                        <p className="text-sm text-slate-400 mb-4">Invita a alguien a colaborar en "{currentSheet?.name}"</p>

                        <form onSubmit={handleShare}>
                            <input
                                autoFocus
                                type="email"
                                value={shareEmail}
                                onChange={(e) => setShareEmail(e.target.value)}
                                placeholder="Email del usuario"
                                className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                required
                            />
                            {shareMessage.text && (
                                <p className={`text-sm mb-4 p-2 rounded ${shareMessage.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {shareMessage.text}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsSharing(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cerrar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium">Enviar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button onClick={() => setIsAddingTask(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                        <h3 className="text-xl font-bold text-white mb-4">Nueva Tarea</h3>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Título</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="¿Qué hay que hacer?"
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                            <button type="submit" disabled={!newTaskTitle.trim()} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium mt-4">Guardar Tarea</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;
