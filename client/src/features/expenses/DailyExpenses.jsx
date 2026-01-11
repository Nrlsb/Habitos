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

    console.log("DailyExpenses Render - Data:", dailyExpenses?.length, "Loading:", loading);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dolarRate, setDolarRate] = useState(null);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedPlanillaIds, setSelectedPlanillaIds] = useState([]);
    const [category, setCategory] = useState("General");
    const [showPlanillaDropdown, setShowPlanillaDropdown] = useState(false);
    const [currency, setCurrency] = useState('ARS');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New State for Advanced Options
    const [esCompartido, setEsCompartido] = useState(false);
    const [paidBy, setPaidBy] = useState('');
    const [enCuotas, setEnCuotas] = useState(false);
    const [cuotaActual, setCuotaActual] = useState('1');
    const [totalCuotas, setTotalCuotas] = useState('');

    // Categories list (Synced with Expenses.jsx)
    const categories = [
        { value: "General", label: "General" },
        { value: "Comida", label: "Comida 🍔" },
        { value: "Transporte", label: "Transporte 🚌" },
        { value: "Servicios", label: "Servicios 💡" },
        { value: "Alquiler", label: "Alquiler 🏠" },
        { value: "Supermercado", label: "Supermercado 🛒" },
        { value: "Mascota", label: "Mascota 🐶" },
        { value: "Hogar", label: "Hogar 🛋️" },
        { value: "Viandas", label: "Viandas 🍱" },
        { value: "Alcohol", label: "Alcohol 🍺" },
        { value: "Ocio", label: "Ocio 🎬" },
        { value: "Salud", label: "Salud 💊" },
        { value: "Ropa", label: "Ropa 👕" },
        { value: "Educación", label: "Educación 📚" },
        { value: "Otros", label: "Otros 📦" }
    ];

    // Set default planilla if available
    useEffect(() => {
        if (planillas.length > 0 && selectedPlanillaIds.length === 0) {
            setSelectedPlanillaIds([planillas[0].id]);
        }
    }, [planillas]); // Removed selectedPlanillaIds dep to avoid loop

    // Fetch expenses when date changes
    useEffect(() => {
        getDailyExpenses(selectedDate);
    }, [selectedDate, getDailyExpenses]);

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

    const groupedExpenses = useMemo(() => {
        if (!dailyExpenses || dailyExpenses.length === 0) return [];

        // Sort by creation time desc
        const sorted = [...dailyExpenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const groups = [];

        sorted.forEach(expense => {
            // Find a candidate group: same desc, amount, currency, and time diff < 5000ms (generous buffer for network delays)
            // We check only the last group added or scan recently added groups? 
            // Better to scan recent groups.
            const existingGroup = groups.find(g =>
                g.description === expense.description &&
                g.amount === expense.amount &&
                g.currency === expense.currency &&
                g.category === expense.category && // Check category
                g.is_shared === expense.is_shared && // Check shared
                g.is_installment === expense.is_installment && // Check installment
                Math.abs(new Date(g.primary_created_at) - new Date(expense.created_at)) < 5000
            );

            if (existingGroup) {
                existingGroup.planillas.push(expense.planillas?.nombre || 'Unknown');
                existingGroup.ids.push(expense.id);
            } else {
                groups.push({
                    ...expense,
                    primary_created_at: expense.created_at,
                    planillas: [expense.planillas?.nombre || 'Unknown'],
                    ids: [expense.id]
                });
            }
        });

        return groups;

    }, [dailyExpenses]);

    const totalDayAmount = useMemo(() => {
        return groupedExpenses.reduce((acc, expense) => {
            let amount = expense.amount;
            if (expense.currency === 'USD') {
                if (dolarRate) {
                    amount = amount * dolarRate;
                } else {
                    amount = 0;
                }
            }
            return acc + amount;
        }, 0);
    }, [groupedExpenses, dolarRate]);

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
                    esCompartido: esCompartido,
                    payer_name: esCompartido ? paidBy : null,
                    enCuotas: enCuotas,
                    cuotaActual: enCuotas ? parseInt(cuotaActual) : null,
                    totalCuotas: enCuotas ? parseInt(totalCuotas) : null
                })
            );

            await Promise.all(promises);

            // Clear form (keep some selections for convenience)
            setDescription('');
            setAmount('');
            // Reset complex fields
            setEsCompartido(false);
            setEnCuotas(false);
            setPaidBy('');
            setCuotaActual('1');
            setTotalCuotas('');

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
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Extra Options: Shared & Installments */}
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer group flex-1 bg-slate-900/30 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${esCompartido ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-slate-800'}`}>
                                            {esCompartido && <Plus size={10} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={esCompartido}
                                            onChange={(e) => setEsCompartido(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-xs text-slate-400 group-hover:text-slate-300">Compartido</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer group flex-1 bg-slate-900/30 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${enCuotas ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-slate-800'}`}>
                                            {enCuotas && <Plus size={10} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={enCuotas}
                                            onChange={(e) => setEnCuotas(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-xs text-slate-400 group-hover:text-slate-300">Cuotas</span>
                                    </label>
                                </div>

                                {esCompartido && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <input
                                            type="text"
                                            value={paidBy}
                                            onChange={(e) => setPaidBy(e.target.value)}
                                            placeholder="Pagado por (opcional)"
                                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-600"
                                        />
                                    </div>
                                )}

                                {enCuotas && (
                                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-500 ml-1 mb-0.5 block">Actual</label>
                                            <input
                                                type="number"
                                                value={cuotaActual}
                                                onChange={(e) => setCuotaActual(e.target.value)}
                                                placeholder="1"
                                                className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-500 ml-1 mb-0.5 block">Total</label>
                                            <input
                                                type="number"
                                                value={totalCuotas}
                                                onChange={(e) => setTotalCuotas(e.target.value)}
                                                placeholder="Total"
                                                className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !description || !amount || selectedPlanillaIds.length === 0}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
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
                                {groupedExpenses.length} reg.
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                                <p className="text-sm">Cargando...</p>
                            </div>
                        ) : groupedExpenses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <CalendarIcon size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">No hay gastos registrados en esta fecha.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700/30">
                                {groupedExpenses.map((expense) => (
                                    <div key={expense.id} className="p-4 hover:bg-slate-700/20 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-400 font-bold">
                                                {expense.category ? expense.category.charAt(0) : (expense.currency === 'USD' ? 'U' : '$')}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-slate-200 font-medium">{expense.description}</h4>
                                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                                        {categories.find(c => c.value === expense.category)?.label || expense.category}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {expense.planillas.map((pName, idx) => (
                                                        <span key={idx} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">
                                                            {pName}
                                                        </span>
                                                    ))}
                                                    {expense.is_shared && (
                                                        <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                            Compartido
                                                        </span>
                                                    )}
                                                    {expense.is_installment && (
                                                        <span className="text-[10px] bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                            Cuotas
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-500 ml-1 border-l border-slate-700 pl-2">
                                                        {format(parseISO(expense.primary_created_at), 'HH:mm')} hs
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
