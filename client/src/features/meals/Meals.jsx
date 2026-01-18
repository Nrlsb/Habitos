import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Utensils, Coffee, Sun, Moon, Cookie } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Meals = () => {
    const { session } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [meals, setMeals] = useState({
        breakfast: '',
        lunch: '',
        snack: '',
        dinner: ''
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    useEffect(() => {
        if (session) {
            fetchMeals();
        }
    }, [selectedDate, session]);

    const fetchMeals = async () => {
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const response = await fetch(`${API_URL}/api/meals?date=${dateStr}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await response.json();

            if (data && !data.error) {
                setMeals({
                    breakfast: data.breakfast || '',
                    lunch: data.lunch || '',
                    snack: data.snack || '',
                    dinner: data.dinner || ''
                });
            } else {
                // Reset if no data found
                setMeals({ breakfast: '', lunch: '', snack: '', dinner: '' });
            }
        } catch (error) {
            console.error('Error fetching meals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const response = await fetch(`${API_URL}/api/meals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    date: dateStr,
                    ...meals
                })
            });

            if (!response.ok) throw new Error('Error saving meals');

            // Optional: Show success feedback
        } catch (error) {
            console.error('Error saving meals:', error);
            alert('Error al guardar las comidas');
        } finally {
            setSaving(false);
        }
    };

    const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
    const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
    const isToday = isSameDay(selectedDate, new Date());

    const updateMeal = (type, value) => {
        setMeals(prev => ({ ...prev, [type]: value }));
    };

    const sections = [
        { id: 'breakfast', label: 'Desayuno', icon: <Coffee size={20} className="text-orange-400" />, placeholder: '¿Qué desayunaste hoy? ☕' },
        { id: 'lunch', label: 'Almuerzo', icon: <Sun size={20} className="text-yellow-400" />, placeholder: '¿Qué almorzaste? 🥗' },
        { id: 'snack', label: 'Merienda', icon: <Cookie size={20} className="text-pink-400" />, placeholder: '¿Algo de merienda? 🍪' },
        { id: 'dinner', label: 'Cena', icon: <Moon size={20} className="text-indigo-400" />, placeholder: '¿Qué cenaste? 🌙' }
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
            {/* Header / Date Navigation */}
            <div className="flex items-center justify-between mb-6 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm sticky top-0 z-20">
                <button
                    onClick={handlePrevDay}
                    className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="text-center">
                    <h2 className="text-lg font-semibold text-slate-200 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {isToday ? 'Hoy' : 'Histórico'}
                    </p>
                </div>

                <div className="flex gap-2">
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="p-2 hover:bg-slate-700 rounded-xl text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-bold uppercase border border-indigo-500/20"
                        >
                            HOY
                        </button>
                    )}
                    <button
                        onClick={handleNextDay}
                        disabled={isToday}
                        className={`p-2 rounded-xl transition-colors ${isToday ? 'text-slate-700 cursor-not-allowed' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                    <p className="text-sm">Cargando comidas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sections.map((section) => (
                        <div key={section.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm flex flex-col h-full focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                                    {section.icon}
                                </div>
                                <h3 className="text-slate-200 font-medium">{section.label}</h3>
                            </div>
                            <textarea
                                value={meals[section.id]}
                                onChange={(e) => updateMeal(section.id, e.target.value)}
                                placeholder={section.placeholder}
                                className="w-full flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50 resize-none min-h-[100px] placeholder:text-slate-600"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Save Button Floating or Fixed */}
            <div className="fixed bottom-6 right-6 md:relative md:bottom-auto md:right-auto md:mt-8 md:flex md:justify-end z-30">
                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <Save size={20} />
                    )}
                    <span className="hidden md:inline">Guardar Cambios</span>
                    <span className="md:hidden">Guardar</span>
                </button>
            </div>
        </div>
    );
};

export default Meals;
