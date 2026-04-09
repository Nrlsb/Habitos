import React, { useState, useEffect, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Wallet, Calendar as CalendarIcon, ArrowRight, Trash2, Edit2 } from 'lucide-react';
import { getDolarRate } from '../../services/dolarApi';

// Helper: genera ISO string con offset local (ej: 2026-03-04T20:52:00-03:00)
const toLocalISOString = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
};

const DailyExpenses = () => {
    const {
        dailyExpenses,
        getDailyExpenses,
        planillas,
        addExpense,
        deleteExpense, // Added for editing/deletion
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

    // Editing State
    const [editingGroup, setEditingGroup] = useState(null); // Stores the group being edited { ids: [], ... }
    const [isDeletingGroup, setIsDeletingGroup] = useState(false);

    // New State for Advanced Options
    const [esCompartido, setEsCompartido] = useState(false);
    const [paidBy, setPaidBy] = useState('');
    const [splitDetails, setSplitDetails] = useState([]); // [{ name: 'Lucas', amount: 0 }]
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
                return prev.filter(pId => pId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const groupedExpenses = useMemo(() => {
        if (!dailyExpenses || dailyExpenses.length === 0) return [];

        const sorted = [...dailyExpenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const groups = [];

        sorted.forEach(expense => {
            const existingGroup = groups.find(g =>
                g.description === expense.description &&
                g.amount === expense.amount &&
                g.currency === expense.currency &&
                g.category === expense.category &&
                g.is_shared === expense.is_shared &&
                g.is_installment === expense.is_installment &&
                g.payer_name === expense.payer_name
            );

            const idObj = { id: expense.id, planilla_id: expense.planilla_id };

            if (existingGroup) {
                existingGroup.planillas.push(expense.planillas?.nombre || 'Unknown');
                existingGroup.ids.push(idObj);
            } else {
                groups.push({
                    ...expense,
                    primary_created_at: expense.created_at,
                    planillas: [expense.planillas?.nombre || 'Unknown'],
                    ids: [idObj]
                });
            }
        });

        return groups;
    }, [dailyExpenses]);

    const totalDayAmount = useMemo(() => {
        return groupedExpenses.reduce((acc, expense) => {
            let amount = expense.amount;
            if (expense.currency === 'USD') {
                amount = dolarRate ? amount * dolarRate : 0;
            }
            return acc + amount;
        }, 0);
    }, [groupedExpenses, dolarRate]);

    // --- Helpers for Splits ---
    const addSplitDetail = () => setSplitDetails([...splitDetails, { name: '', amount: '' }]);

    const updateSplitDetail = (index, field, value) => {
        const newDetails = [...splitDetails];
        newDetails[index][field] = value;
        setSplitDetails(newDetails);
    };

    const removeSplitDetail = (index) => {
        const newDetails = [...splitDetails];
        newDetails.splice(index, 1);
        setSplitDetails(newDetails);
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCategory("General");
        setCurrency('ARS');
        setEsCompartido(false);
        setEnCuotas(false);
        setPaidBy('');
        setSplitDetails([]);
        setCuotaActual('1');
        setTotalCuotas('');
        setEditingGroup(null);
        // Reset planillas to default? Keep current selection as it's often repeated.
    };

    const handleEditGroup = (group) => {
        setEditingGroup(group);
        setDescription(group.description);
        setAmount(group.amount);
        setCurrency(group.currency || 'ARS');
        setCategory(group.category || 'General');
        setEsCompartido(group.is_shared);
        setPaidBy(group.payer_name || '');
        setSplitDetails(group.split_details || []);
        setEnCuotas(group.is_installment);
        setCuotaActual(group.current_installment || '1');
        setTotalCuotas(group.total_installments || '');

        // Extract planilla IDs from the group's items
        const groupPlanillaIds = group.ids.map(item => item.planilla_id);
        setSelectedPlanillaIds(groupPlanillaIds);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteGroup = async (group) => {
        if (isDeletingGroup) return;
        if (!window.confirm('¿Eliminar este gasto (y sus copias en otras planillas)?')) return;

        setIsDeletingGroup(true);
        try {
            await Promise.all(group.ids.map(item => deleteExpense(item.planilla_id, item.id)));
            getDailyExpenses(selectedDate);
        } catch (err) {
            console.error("Error deleting group:", err);
            alert("Error al eliminar");
        } finally {
            setIsDeletingGroup(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount || selectedPlanillaIds.length === 0) return;

        setIsSubmitting(true);
        try {
            // IF EDITING: Delete old entries first
            if (editingGroup) {
                await Promise.all(editingGroup.ids.map(item => deleteExpense(item.planilla_id, item.id)));
            }

            // Create expense for each selected planilla
            const promises = selectedPlanillaIds.map(id => {
                // Usar la fecha seleccionada con la hora actual
                const now = new Date();
                const finalDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());

                return addExpense(id, {
                    description,
                    amount: parseFloat(amount),
                    currency,
                    category,
                    esCompartido,
                    payer_name: esCompartido ? paidBy : null,
                    split_details: (esCompartido && splitDetails.length > 0) ? splitDetails : null,
                    enCuotas,
                    cuotaActual: enCuotas ? parseInt(cuotaActual) : null,
                    totalCuotas: enCuotas ? parseInt(totalCuotas) : null,
                    // Usar ISO con offset local para preservar la zona horaria
                    date: toLocalISOString(finalDate)
                });
            });

            await Promise.all(promises);

            resetForm();
            getDailyExpenses(selectedDate);

        } catch (error) {
            console.error("Error adding/editing expense:", error);
            alert("Error al guardar gasto");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Date Navigation */}
            <div className="sticky top-0 z-10 bg-[#131f18]/80 backdrop-blur-xl border-b border-white/5 px-4 pb-4 flex items-center justify-between pt-safe">
                <button
                    onClick={handlePrevDay}
                    className="p-2 hover:bg-primary/10 rounded-xl text-slate-400 hover:text-primary transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="text-center">
                    <h2 className="text-lg font-bold text-slate-100 capitalize tracking-tight">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </h2>
                    {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Hoy
                        </span>
                    )}
                </div>

                <div className="flex gap-2 items-center">
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="px-3 py-1 hover:bg-primary/10 rounded-xl text-primary transition-colors text-xs font-bold uppercase border border-primary/20"
                        >
                            HOY
                        </button>
                    )}
                    <button
                        onClick={handleNextDay}
                        disabled={isToday}
                        className={`p-2 rounded-xl transition-colors ${isToday ? 'text-slate-700 cursor-not-allowed' : 'hover:bg-primary/10 text-slate-400 hover:text-primary'}`}
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            <div className="px-4 py-4 space-y-4">
                {/* Total Card */}
                <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary to-primary/80 p-6 shadow-[var(--shadow-glow-strong)]">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/5 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-[#131f18]/60 uppercase tracking-widest mb-1">Total del día</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-[#131f18] tabular-nums">
                                $ {totalDayAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-sm font-medium text-[#131f18]/70">ARS</span>
                        </div>
                        {dolarRate && (
                            <p className="text-xs text-[#131f18]/50 mt-1 font-mono">
                                ≈ USD {(totalDayAmount / dolarRate).toFixed(2)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Quick Add Form */}
                <div className={`glass-panel border ${editingGroup ? 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-white/5 shadow-glass'} rounded-[32px] p-6 transition-all duration-300`}>
                    <h3 className="text-slate-100 font-bold text-lg mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {editingGroup ? (
                                <>
                                    <Edit2 size={18} className="text-amber-400" />
                                    <span className="text-amber-400">Editar Gasto</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={18} className="text-primary" />
                                    <span>Agregar Gasto Rápido</span>
                                </>
                            )}
                        </div>
                        {editingGroup && (
                            <button onClick={resetForm} className="text-xs text-slate-500 hover:text-white underline">
                                Cancelar
                            </button>
                        )}
                    </h3>

                    {planillas.length === 0 ? (
                        <div className="text-center p-4 bg-primary/5 rounded-xl border border-dashed border-primary/20">
                            <p className="text-sm text-slate-400 mb-2">No tienes planillas activas.</p>
                            <p className="text-xs text-slate-500">Crea una en la pestaña "Mis Planillas" para comenzar.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleAddExpense} className="space-y-3">
                            {/* Multi-Planilla Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowPlanillaDropdown(!showPlanillaDropdown)}
                                    className="w-full bg-white/5 border border-primary/10 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 text-left flex justify-between items-center"
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
                                    <div className="absolute z-10 w-full mt-1 bg-[#1a2e20] border border-primary/20 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {planillas.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => togglePlanillaSelection(p.id)}
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-primary/10 cursor-pointer"
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPlanillaIds.includes(p.id) ? 'bg-primary border-primary' : 'border-slate-500'}`}>
                                                    {selectedPlanillaIds.includes(p.id) && <Plus size={12} className="text-[#131f18]" />}
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
                                    className="w-full bg-white/5 border border-white/5 text-slate-100 text-base rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 placeholder:text-slate-500 transition-all"
                                />
                            </div>

                            {/* Amount & Currency */}
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-primary/10 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 placeholder:text-slate-500"
                                    />
                                </div>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="bg-white/5 border border-primary/10 text-slate-300 text-sm rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                                    className="w-full bg-white/5 border border-primary/10 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Extra Options: Shared & Installments */}
                            <div className="flex gap-3">
                                <label className="flex items-center gap-2 cursor-pointer group flex-1 bg-white/5 p-2 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${esCompartido ? 'bg-primary border-primary' : 'border-slate-500 bg-white/5'}`}>
                                        {esCompartido && <Plus size={10} className="text-[#131f18]" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={esCompartido}
                                        onChange={(e) => setEsCompartido(e.target.checked)}
                                        className="hidden"
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-slate-300">Compartido</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group flex-1 bg-white/5 p-2 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${enCuotas ? 'bg-primary border-primary' : 'border-slate-500 bg-white/5'}`}>
                                        {enCuotas && <Plus size={10} className="text-[#131f18]" />}
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
                                        className="w-full bg-white/5 border border-primary/10 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 placeholder:text-slate-500"
                                    />

                                    {/* Division Personalizada */}
                                    <div className="mt-3 p-3 bg-white/5 rounded-xl border border-primary/10">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-medium text-slate-300">División Personalizada</h4>
                                            <button
                                                type="button"
                                                onClick={addSplitDetail}
                                                className="text-[10px] flex items-center gap-1 text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-1 rounded"
                                            >
                                                <Plus size={10} /> Añadir
                                            </button>
                                        </div>

                                        {splitDetails.length > 0 ? (
                                            <div className="space-y-2">
                                                {/* Headers */}
                                                <div className="flex gap-2 px-1 mb-1">
                                                    <span className="flex-1 text-[10px] text-slate-500 font-medium">Persona</span>
                                                    <span className="w-20 text-[10px] text-slate-500 font-medium text-right pr-2">Monto</span>
                                                    <span className="w-5"></span>
                                                </div>

                                                {splitDetails.map((detail, index) => (
                                                    <div key={index} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Persona (ej. Lucas)"
                                                            value={detail.name}
                                                            onChange={(e) => updateSplitDetail(index, 'name', e.target.value)}
                                                            className="flex-1 bg-white/5 border border-primary/10 text-slate-200 text-[10px] rounded p-1.5 focus:border-primary focus:outline-none"
                                                        />
                                                        <div className="relative w-20">
                                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">$</span>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={detail.amount}
                                                                onChange={(e) => updateSplitDetail(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                className="w-full bg-white/5 border border-primary/10 text-slate-200 text-[10px] rounded pl-3 pr-1 py-1.5 focus:border-primary focus:outline-none text-right"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSplitDetail(index)}
                                                            className="text-slate-500 hover:text-red-400 p-1"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="pt-2 border-t border-primary/10 text-right text-[10px] text-slate-500">
                                                    Asignado: <span className="text-slate-300">${splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(2)}</span>
                                                    {amount && (
                                                        <span className="ml-2">
                                                            Resto: <span className="text-primary">${(parseFloat(amount) - splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)).toFixed(2)}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-500 italic">Automático (50/50)</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {enCuotas && (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 ml-1 mb-0.5 block">Actual</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={cuotaActual}
                                            onChange={(e) => setCuotaActual(e.target.value)}
                                            placeholder="1"
                                            className="w-full bg-white/5 border border-primary/10 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 ml-1 mb-0.5 block">Total</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={totalCuotas}
                                            onChange={(e) => setTotalCuotas(e.target.value)}
                                            placeholder="Total"
                                            className="w-full bg-white/5 border border-primary/10 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !description || !amount || selectedPlanillaIds.length === 0}
                                className={`w-full flex justify-center items-center gap-2 mt-4 py-4 font-bold text-lg rounded-2xl transition-all active-scale disabled:opacity-50 disabled:cursor-not-allowed ${editingGroup
                                    ? 'bg-amber-500 text-[#131f18] hover:bg-amber-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]'
                                    : 'bg-primary text-[#131f18] hover:bg-primary/90 hover:shadow-[var(--shadow-glow-strong)]'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-[#131f18]/30 border-t-[#131f18] rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        {editingGroup ? <Edit2 size={20} /> : <Plus size={20} />}
                                        {editingGroup ? 'Guardar Cambios' : 'Agregar Gasto Rápido'}
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Expense List */}
                <div className="glass-panel border-white/5 shadow-glass rounded-[32px] overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h3 className="text-slate-200 font-semibold text-lg">Movimientos</h3>
                        <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-xl font-bold">
                            {groupedExpenses.length} reg.
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
                            <p className="text-sm">Cargando...</p>
                        </div>
                    ) : groupedExpenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <CalendarIcon size={40} className="mb-3 opacity-20" />
                            <p className="text-sm">No hay gastos en esta fecha.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
                            {groupedExpenses.map((expense) => (
                                <div key={expense.id} className="p-5 hover:bg-white/5 transition-colors flex items-center justify-between group active-scale cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                            {expense.category ? expense.category.charAt(0) : (expense.currency === 'USD' ? 'U' : '$')}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-slate-200 font-medium text-sm">{expense.description}</h4>
                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                                                    {categories.find(c => c.value === expense.category)?.label || expense.category}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {expense.planillas.map((pName, idx) => (
                                                    <span key={idx} className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-full border border-white/10">
                                                        {pName}
                                                    </span>
                                                ))}
                                                {expense.is_shared && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                                                        Compartido
                                                    </span>
                                                )}
                                                {expense.is_installment && (
                                                    <span className="text-[10px] bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-400/20">
                                                        Cuotas
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-600 ml-1 border-l border-white/10 pl-2">
                                                    {format(parseISO(expense.primary_created_at), 'HH:mm')} hs
                                                </span>
                                            </div>
                                            {expense.split_details && expense.split_details.length > 0 && (
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    División: {expense.split_details.map(d => `${d.name} $${d.amount}`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className="text-slate-200 font-semibold tabular-nums text-sm">
                                            {expense.currency === 'USD' ? 'USD ' : '$ '}
                                            {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditGroup(expense)}
                                                className="p-1.5 bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(expense)}
                                                disabled={isDeletingGroup}
                                                className="p-1.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DailyExpenses;
