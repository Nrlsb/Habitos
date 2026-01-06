import React, { useState, useEffect, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Wallet, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { getDolarRate } from '../../services/dolarApi';

const DailyExpenses = () => {
    const {
        dailyExpenses,
        getDailyExpenses,
        planillas,
        addExpense,
        loading
    } = useExpenses();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dolarRate, setDolarRate] = useState(null);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedPlanillaIds, setSelectedPlanillaIds] = useState([]);
    const [category, setCategory] = useState("General");
    const [showPlanillaDropdown, setShowPlanillaDropdown] = useState(false);

    // Categories list (can be moved to a config file later)
    const categories = ["General", "Comida", "Transporte", "Servicios", "Ocio", "Salud", "Educación", "Ropa", "Regalos", "Varios"];

    // Set default planilla if available
    useEffect(() => {
        if (planillas.length > 0 && selectedPlanillaIds.length === 0) {
            setSelectedPlanillaIds([planillas[0].id]);
        }
    }, [planillas]); // Removed selectedPlanillaIds dep to avoid loop, though logic needs care

    const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
    const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));

    const togglePlanillaSelection = (id) => {
        setSelectedPlanillaIds(prev => {
            if (prev.includes(id)) {
                // Prevent deselecting all if desired, or allow empty (but disable submit)
                return prev.filter(pId => pId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const totalDayAmount = useMemo(() => {
        if (!dolarRate) return 0;
        return dailyExpenses.reduce((acc, expense) => {
            const amountInARS = expense.currency === 'USD' ? expense.amount * dolarRate : expense.amount;
            return acc + amountInARS;
        }, 0);
    }, [dailyExpenses, dolarRate]);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount || selectedPlanillaIds.length === 0) return;

        setIsSubmitting(true);
        try {
            // Create expense for each selected planilla
            const promises = selectedPlanillaIds.map(id =>
                addExpense(id, {
                    description,
                    amount: parseFloat(amount),
                    currency,
                    category, // New field
                    // Defaults for quick add
                    is_shared: false,
                    is_installment: false
                })
            );

            await Promise.all(promises);

            // Clear form
            setDescription('');
            setAmount('');
            // Keep planillas and category selected for convenience? Or reset?
            // Let's keep them.

            // Refresh list
            getDailyExpenses(selectedDate);

        } catch (error) {
            console.error("Error adding expense:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
            {/* Header / Date Navigation */}
            <div className="flex items-center justify-between mb-6 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Summary & Add Form */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Total Card */}
                    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                        <div className="relative z-10">
                            <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2">
                                <Wallet size={14} /> Total del Día
                            </span>
                            <div className="text-4xl font-bold text-white tabular-nums tracking-tight">
                                <span className="text-2xl text-slate-400 mr-1">$</span>
                                {totalDayAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            {dolarRate && (
                                <p className="text-xs text-slate-500 mt-2 font-mono">
                                    ≈ USD {(totalDayAmount / dolarRate).toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quick Add Form */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm">
                        <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
                            <Plus size={18} className="text-emerald-400" />
                            Agregar Gasto Rápido
                        </h3>

                        {planillas.length === 0 ? (
                            <div className="text-center p-4 bg-slate-900/50 rounded-xl border border-dashed border-slate-700">
                                <p className="text-sm text-slate-500 mb-2">No tienes planillas activas.</p>
                                <p className="text-xs text-slate-600">Crea una en la pestaña "Mis Planillas" para comenzar.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleAddExpense} className="space-y-3">
                                {/* Multi-Planilla Selector */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowPlanillaDropdown(!showPlanillaDropdown)}
                                        className="w-full bg-slate-900/50 border border-slate-600 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-left flex justify-between items-center"
                                    >
                                        <span className="truncate">
                                            {selectedPlanillaIds.length === 0
                                                ? "Seleccionar Planillas"
                                                : selectedPlanillaIds.length === 1
                                                    ? planillas.find(p => p.id === selectedPlanillaIds[0])?.nombre
                                                    : `${selectedPlanillaIds.length} planillas seleccionadas`
                                            }
                                        </span>
                                        <ChevronRight size={16} className={`transition-transform ${showPlanillaDropdown ? 'rotate-90' : ''}`} />
                                    </button>

                                    {showPlanillaDropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {planillas.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => togglePlanillaSelection(p.id)}
                                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 cursor-pointer"
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPlanillaIds.includes(p.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                                                        {selectedPlanillaIds.includes(p.id) && <Plus size={12} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm text-slate-200">{p.nombre}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Overlay to close dropdown */}
                                {showPlanillaDropdown && (
                                    <div className="fixed inset-0 z-0" onClick={() => setShowPlanillaDropdown(false)}></div>
                                )}

                                {/* Description */}
                                <div>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Descripción"
                                        className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-600"
                                    />
                                </div>

                                {/* Amount & Currency */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-600"
                                        />
                                    </div>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="bg-slate-900/50 border border-slate-600 text-slate-300 text-sm rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        <option value="ARS">ARS</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>

                                {/* Category Selection */}
                                <div>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-600 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !description || !amount || selectedPlanillaIds.length === 0}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Plus size={18} /> Agregar
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Right Column: List */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm min-h-[400px]">
                        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                            <h3 className="text-slate-300 font-medium">Movimientos</h3>
                            <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded-lg">
                                {dailyExpenses.length} reg.
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                                <p className="text-sm">Cargando...</p>
                            </div>
                        ) : dailyExpenses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <CalendarIcon size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">No hay gastos registrados en esta fecha.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700/30">
                                {dailyExpenses.map((expense) => (
                                    <div key={expense.id} className="p-4 hover:bg-slate-700/20 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-400">
                                                {expense.currency === 'USD' ? 'U$D' : '$'}
                                            </div>
                                            <div>
                                                <h4 className="text-slate-200 font-medium">{expense.description}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">
                                                        {expense.planillas?.nombre}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {format(parseISO(expense.created_at), 'HH:mm')} hs
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-slate-200 font-semibold tabular-nums">
                                                {expense.currency === 'USD' ? 'USD ' : '$ '}
                                                {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyExpenses;
