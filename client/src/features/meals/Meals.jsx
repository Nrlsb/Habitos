import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Utensils, Coffee, Sun, Moon, Cookie } from 'lucide-react';
import { toast } from 'sonner';
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
            toast.success('Comidas guardadas');
        } catch (error) {
            console.error('Error saving meals:', error);
            toast.error('Error al guardar las comidas');
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
        { id: 'dinner', label: 'Cena', icon: <Moon size={20} className="text-primary" />, placeholder: '¿Qué cenaste? 🌙' }
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 md:pb-0 pt-safe overflow-y-auto max-h-[calc(100vh-220px)]" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
            {/* Header / Date Navigation */}
            <div className="flex items-center justify-between mb-8 bg-[#131f18]/80 backdrop-blur-xl p-4 md:p-5 rounded-[32px] border border-white/5 shadow-glass sticky top-safe z-20 mx-4 md:mx-0 mt-4">
                <button
                    onClick={handlePrevDay}
                    className="p-2.5 hover:bg-white/5 active-scale rounded-2xl text-slate-400 hover:text-white transition-all shadow-inner"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="text-center">
                    <h2 className="text-lg font-bold text-slate-100 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {isToday ? 'Hoy' : 'Histórico'}
                    </p>
                </div>

                <div className="flex gap-2 items-center">
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="px-3 py-2 h-10 bg-primary/10 rounded-2xl text-primary text-xs font-bold uppercase border border-primary/20 active-scale transition-all"
                        >
                            HOY
                        </button>
                    )}
                    <button
                        onClick={handleNextDay}
                        disabled={isToday}
                        className={`p-2.5 rounded-2xl transition-all shadow-inner ${isToday ? 'text-slate-700 cursor-not-allowed opacity-50' : 'hover:bg-white/5 active-scale text-slate-400 hover:text-white'}`}
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
                    <p className="text-sm">Cargando comidas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mx-4 md:mx-0">
                    {sections.map((section) => (
                        <div key={section.id} className="glass-panel border-white/5 shadow-glass rounded-[32px] p-6 flex flex-col h-full focus-within:border-primary/40 focus-within:shadow-[var(--shadow-glow)] transition-all duration-300">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-white/5 rounded-2xl shadow-inner text-white">
                                    {section.icon}
                                </div>
                                <h3 className="text-slate-100 font-bold text-lg">{section.label}</h3>
                            </div>
                            <textarea
                                value={meals[section.id]}
                                onChange={(e) => updateMeal(section.id, e.target.value)}
                                placeholder={section.placeholder}
                                className="w-full flex-1 bg-white/5 border border-white/5 rounded-2xl p-4 text-slate-100 text-base focus:outline-none focus:border-primary/40 resize-none min-h-[120px] placeholder:text-slate-500 transition-all shadow-inner"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Save Button Floating or Fixed */}
            <div className="fixed bottom-safe right-4 mb-24 md:mb-0 md:relative md:bottom-auto md:right-auto md:mt-8 md:flex md:justify-end z-30">
                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="bg-primary hover:bg-primary/90 text-[#131f18] px-6 py-4 rounded-[24px] font-bold shadow-[var(--shadow-glow-strong)] flex items-center gap-2 transition-all active-scale disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <div className="w-6 h-6 border-2 border-[#131f18]/30 border-t-[#131f18] rounded-full animate-spin"></div>
                    ) : (
                        <Save size={24} />
                    )}
                    <span className="hidden md:inline text-lg">Guardar Cambios</span>
                </button>
            </div>
        </div>
    );
};

export default Meals;
