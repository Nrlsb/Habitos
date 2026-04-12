import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, isSameDay, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CheckCircle, Circle, Calendar, Layout, Trash2, Clock, Share2, Users, FolderPlus, X } from 'lucide-react';
import { toast } from 'sonner';
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

        try {
            await addTask({
                title: newTaskTitle,
                due_date: newTaskDate.toISOString(),
                priority: newTaskPriority
            });
            toast.success('Tarea agregada');
        } catch (err) {
            toast.error('No se pudo agregar la tarea');
        }

        setNewTaskTitle('');
        setIsAddingTask(false);
        fetchTasks(view, currentDate);
    };

    const handleDeleteSheet = async (e) => {
        e.stopPropagation();
        if (!window.confirm('¿Seguro que quieres eliminar esta lista y todas sus tareas?')) return;
        try {
            await deleteSheet(currentSheetId);
            toast.success('Lista eliminada');
        } catch (err) {
            toast.error('No se pudo eliminar la lista');
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await deleteTask(taskId);
            toast.success('Tarea eliminada');
        } catch (err) {
            toast.error('No se pudo eliminar la tarea');
        }
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
            case 'low': return 'text-primary bg-emerald-400/10 border-emerald-400/20';
            default: return 'text-slate-400 bg-slate-400/10';
        }
    };

    const currentSheet = sheets.find(s => s.id === currentSheetId);

    // Render Empty State if no sheets
    if (sheets.length === 0 && !isAddingSheet) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <div className="bg-primary/5 p-6 rounded-full mb-6 border border-primary/10">
                    <Layout size={48} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Comienza a Planificar</h2>
                <p className="text-slate-400 max-w-md mb-8">Crea tu primera lista de tareas para organizar tus proyectos, trabajo o vida personal.</p>
                <button
                    onClick={() => setIsAddingSheet(true)}
                    className="bg-primary hover:bg-primary/90 text-[#131f18] px-8 py-4 rounded-[24px] font-bold shadow-[var(--shadow-glow-strong)] flex items-center gap-2 transition-all active-scale"
                >
                    <FolderPlus size={24} /> Crear Nueva Lista
                </button>

                {/* Modal Create Sheet (Inline logic reused) */}
                {isAddingSheet && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white/5 border border-primary/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                            <button onClick={() => setIsAddingSheet(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                            <h3 className="text-xl font-bold text-white mb-4">Nueva Lista</h3>
                            <form onSubmit={handleAddReport}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newSheetName}
                                    onChange={(e) => setNewSheetName(e.target.value)}
                                    placeholder="Nombre de la lista (ej. Trabajo)"
                                    className="w-full bg-white/5 border border-primary/20 text-slate-100 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                                <button type="submit" disabled={!newSheetName.trim()} className="w-full bg-primary text-white py-2.5 rounded-xl font-medium">Crear</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 md:pb-0 px-4 pt-safe overflow-y-auto max-h-[calc(100vh-120px)]">
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
                            className="w-full appearance-none bg-white/5 border border-white/5 text-slate-100 text-lg font-bold rounded-[24px] px-5 py-4 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none cursor-pointer pr-12 shadow-inner"
                        >
                            {sheets.map(s => (
                                <option key={s.id} value={s.id} className="bg-slate-900">
                                    {s.is_shared_with_me ? `👥 ${s.name}` : s.name}
                                </option>
                            ))}
                            <option value="new" className="text-primary font-bold bg-slate-900">+ Crear Nueva Lista</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <ChevronRight size={20} className="rotate-90" />
                        </div>
                    </div>

                    {currentSheet && !currentSheet.is_shared_with_me && (
                        <>
                            <button
                                onClick={() => setIsSharing(true)}
                                className="p-4 bg-white/5 hover:bg-white/10 text-primary hover:text-primary rounded-[20px] shadow-inner border border-white/5 transition-all active-scale"
                                title="Compartir Lista"
                            >
                                <Share2 size={24} />
                            </button>
                            <button
                                onClick={handleDeleteSheet}
                                className="p-4 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-[20px] shadow-inner border border-white/5 hover:border-red-500/30 transition-all active-scale"
                                title="Eliminar Lista"
                            >
                                <Trash2 size={24} />
                            </button>
                        </>
                    )}
                </div>

                {/* View Switcher & Add Task */}
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="bg-white/5 p-1.5 rounded-[20px] shadow-inner border border-white/5 flex flex-1 md:flex-none">
                        <button
                            onClick={() => setView('weekly')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-2xl text-sm font-bold transition-all flex justify-center items-center gap-2 ${view === 'weekly' ? 'bg-primary text-[#131f18] shadow-[var(--shadow-glow)]' : 'text-slate-400 hover:text-slate-200 active-scale'}`}
                        >
                            <Layout size={18} /> <span className="hidden sm:inline">Semana</span>
                        </button>
                        <button
                            onClick={() => setView('daily')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-2xl text-sm font-bold transition-all flex justify-center items-center gap-2 ${view === 'daily' ? 'bg-primary text-[#131f18] shadow-[var(--shadow-glow)]' : 'text-slate-400 hover:text-slate-200 active-scale'}`}
                        >
                            <Calendar size={18} /> <span className="hidden sm:inline">Día</span>
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setNewTaskDate(view === 'daily' ? currentDate : new Date());
                            setIsAddingTask(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-[#131f18] px-5 py-3 rounded-[20px] font-bold transition-all shadow-[var(--shadow-glow)] active-scale flex items-center gap-2 h-auto"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">Tarea</span>
                    </button>
                </div>
            </div>

            {/* Date Navigation Header */}
            <div className="flex items-center justify-between mb-6 glass-panel p-4 rounded-[24px] border-white/5 shadow-glass">
                <button onClick={prevPeriod} className="p-2.5 hover:bg-white/5 active-scale rounded-2xl text-slate-400 hover:text-white transition-all shadow-inner"><ChevronLeft size={24} /></button>
                <h2 className="text-md md:text-lg font-bold text-slate-100 capitalize text-center leading-tight">
                    {view === 'weekly'
                        ? `Semana ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`
                        : format(currentDate, "EEEE d 'de' MMMM", { locale: es })
                    }
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={goToToday} className="px-3 py-2 bg-primary/10 rounded-2xl text-primary text-xs font-bold uppercase border border-primary/20 active-scale transition-all mr-1">Hoy</button>
                    <button onClick={nextPeriod} className="p-2.5 hover:bg-white/5 active-scale rounded-2xl text-slate-400 hover:text-white transition-all shadow-inner"><ChevronRight size={24} /></button>
                </div>
            </div>

            {/* Content Views */}
            {view === 'weekly' ? (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {getWeekDays().map((day) => {
                        const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), day));
                        const isDayToday = isToday(day);

                        return (
                            <div key={day.toISOString()} className={`flex flex-col h-full min-h-[200px] rounded-[24px] border transition-all duration-300 ${isDayToday ? 'bg-primary/10 border-primary/50 shadow-[var(--shadow-glow)]' : 'glass-panel border-white/5 shadow-glass'}`}>
                                <div className={`p-3 text-center border-b ${isDayToday ? 'border-primary/30 bg-primary/5 rounded-t-[24px]' : 'border-white/5 bg-white/5 rounded-t-[24px]'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-0.5 ${isDayToday ? 'text-primary' : 'text-slate-500'}`}>
                                        {format(day, 'EEE', { locale: es })}
                                    </span>
                                    <span className={`text-xl font-bold ${isDayToday ? 'text-white' : 'text-slate-300'}`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                                <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[400px]">
                                    {dayTasks.map(task => (
                                        <div key={task.id} className={`p-3 rounded-2xl border text-sm group transition-all duration-300 ${task.is_completed ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10 hover:border-primary/30 hover:bg-white/10 shadow-inner'}`}>
                                            <div className="flex gap-2 items-start">
                                                <button onClick={() => updateTask(task.id, { is_completed: !task.is_completed })} className={`mt-0.5 active-scale ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-primary'}`}>
                                                    {task.is_completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`truncate font-bold text-[13px] ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>{task.title}</p>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold uppercase ${getPriorityColor(task.priority)}`}>{task.priority.slice(0, 3)}</span>
                                                        <button onClick={() => handleDeleteTask(task.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => { setNewTaskDate(day); setIsAddingTask(true); }} className="w-full py-3 text-sm font-bold text-slate-500 hover:text-primary hover:bg-primary/10 rounded-2xl border border-transparent hover:border-primary/20 border-dashed opacity-0 group-hover:opacity-100 transition-all active-scale">+ Añadir Tarea</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="max-w-2xl mx-auto glass-panel border-white/5 rounded-[32px] shadow-glass p-6 md:p-8 min-h-[500px]">
                    {tasks.filter(t => isSameDay(parseISO(t.due_date), currentDate)).length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <Clock size={48} className="mx-auto mb-4 text-slate-600" />
                            <p className="text-slate-400 font-medium">No hay tareas programadas.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tasks.filter(t => isSameDay(parseISO(t.due_date), currentDate)).map(task => (
                                <div key={task.id} className={`p-4 md:p-5 rounded-[24px] border flex items-center gap-4 group transition-all duration-300 ${task.is_completed ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'glass-panel border-white/10 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]'}`}>
                                    <button onClick={() => updateTask(task.id, { is_completed: !task.is_completed })} className={`p-1 rounded-full active-scale transition-colors ${task.is_completed ? 'text-emerald-500' : 'text-slate-500 hover:text-primary hover:bg-primary/10'}`}>
                                        {task.is_completed ? <CheckCircle size={28} /> : <Circle size={28} />}
                                    </button>
                                    <div className="flex-1">
                                        <h3 className={`text-lg font-bold ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>{task.title}</h3>
                                    </div>
                                    <span className={`text-xs px-3 py-1.5 rounded-xl border font-bold uppercase ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                                    <button onClick={() => handleDeleteTask(task.id)} className="p-3 text-slate-500 hover:text-red-400 rounded-2xl hover:bg-white/5 active-scale transition-all"><Trash2 size={24} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {isAddingSheet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-[#131f18] border border-white/5 rounded-[32px] w-full max-w-sm p-8 shadow-[var(--shadow-glow-strong)] relative">
                        <button onClick={() => setIsAddingSheet(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white active-scale"><X size={24} /></button>
                        <h3 className="text-2xl font-bold text-white mb-6">Nueva Lista</h3>
                        <form onSubmit={handleAddReport}>
                            <input
                                autoFocus
                                type="text"
                                value={newSheetName}
                                onChange={(e) => setNewSheetName(e.target.value)}
                                placeholder="Nombre de la lista"
                                className="w-full bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-5 py-4 mb-6 focus:ring-2 focus:ring-primary/40 outline-none transition-all shadow-inner"
                            />
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAddingSheet(false)} className="px-5 py-3 text-slate-400 hover:text-white font-bold transition-colors">Cancelar</button>
                                <button type="submit" disabled={!newSheetName.trim()} className="bg-primary hover:bg-primary/90 text-[#131f18] px-8 py-3 rounded-2xl font-bold shadow-[var(--shadow-glow)] transition-all active-scale disabled:opacity-50">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isSharing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[#131f18] border border-white/5 rounded-[32px] w-full max-w-sm p-8 shadow-[var(--shadow-glow-strong)] relative">
                        <button onClick={() => setIsSharing(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white active-scale"><X size={24} /></button>
                        <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-3"><Share2 size={24} className="text-primary" /> Compartir Lista</h3>
                        <p className="text-sm text-slate-400 mb-6 font-medium">Invita a alguien a colaborar en "{currentSheet?.name}"</p>

                        <form onSubmit={handleShare}>
                            <input
                                autoFocus
                                type="email"
                                value={shareEmail}
                                onChange={(e) => setShareEmail(e.target.value)}
                                placeholder="Email del usuario"
                                className="w-full bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-5 py-4 mb-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all shadow-inner"
                                required
                            />
                            {shareMessage.text && (
                                <p className={`text-sm mb-4 p-3 rounded-xl font-bold ${shareMessage.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
                                    {shareMessage.text}
                                </p>
                            )}
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setIsSharing(false)} className="px-5 py-3 text-slate-400 hover:text-white font-bold transition-colors">Cerrar</button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-[#131f18] px-8 py-3 rounded-2xl font-bold shadow-[var(--shadow-glow)] transition-all active-scale">Enviar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[#131f18] border border-white/5 rounded-[32px] w-full max-w-md p-8 shadow-[var(--shadow-glow-strong)] relative">
                        <button onClick={() => setIsAddingTask(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white active-scale"><X size={24} /></button>
                        <h3 className="text-2xl font-bold text-white mb-6">Nueva Tarea</h3>
                        <form onSubmit={handleCreateTask} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider ml-1">Título</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="¿Qué hay que hacer?"
                                    className="w-full bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider ml-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={format(newTaskDate, 'yyyy-MM-dd')}
                                        onChange={(e) => setNewTaskDate(parseISO(e.target.value))}
                                        className="w-full bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider ml-1">Prioridad</label>
                                    <div className="relative">
                                        <select
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value)}
                                            className="w-full appearance-none bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner"
                                        >
                                            <option value="low" className="bg-slate-900">Baja</option>
                                            <option value="medium" className="bg-slate-900">Media</option>
                                            <option value="high" className="bg-slate-900">Alta</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={!newTaskTitle.trim()} className="w-full bg-primary hover:bg-primary/90 text-[#131f18] py-4 rounded-2xl font-bold shadow-[var(--shadow-glow)] transition-all active-scale disabled:opacity-50 mt-4">Guardar Tarea</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;
