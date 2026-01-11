import React, { useState, useEffect, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Wallet, Calendar as CalendarIcon, ArrowRight, Trash2, Edit2 } from 'lucide-react';
import { getDolarRate } from '../../services/dolarApi';

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
                // Check split details deep equality? simpler to check length or payer
                g.payer_name === expense.payer_name &&
                Math.abs(new Date(g.primary_created_at) - new Date(expense.created_at)) < 5000
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
        if (!window.confirm('¿Eliminar este gasto (y sus copias en otras planillas)?')) return;

        try {
            await Promise.all(group.ids.map(item => deleteExpense(item.planilla_id, item.id)));
            getDailyExpenses(selectedDate);
        } catch (err) {
            console.error("Error deleting group:", err);
            alert("Error al eliminar");
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
            const promises = selectedPlanillaIds.map(id =>
                addExpense(id, {
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
                    // Use selectedDate for creation to ensure it appears in the right day
                    date: selectedDate.toISOString()
                })
            );

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
                    <div className={`bg-slate-800/50 border ${editingGroup ? 'border-amber-500/30 shadow-amber-500/10' : 'border-slate-700/50'} border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm transition-colors`}>
                        <h3 className="text-slate-200 font-semibold mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {editingGroup ? (
                                    <>
                                        <Edit2 size={18} className="text-amber-400" />
                                        <span className="text-amber-400">Editar Gasto</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} className="text-emerald-400" />
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

                                        {/* Division Personalizada */}
                                        <div className="mt-3 p-3 bg-slate-900/30 rounded-xl border border-slate-700/30">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-xs font-medium text-slate-300">División Personalizada</h4>
                                                <button
                                                    type="button"
                                                    onClick={addSplitDetail}
                                                    className="text-[10px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded"
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
                                                                className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-[10px] rounded p-1.5 focus:border-indigo-500 focus:outline-none"
                                                            />
                                                            <div className="relative w-20">
                                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">$</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={detail.amount}
                                                                    onChange={(e) => updateSplitDetail(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-[10px] rounded pl-3 pr-1 py-1.5 focus:border-indigo-500 focus:outline-none text-right"
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
                                                    <div className="pt-2 border-t border-slate-700/50 text-right text-[10px] text-slate-500">
                                                        Asignado: <span className="text-slate-300">${splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(2)}</span>
                                                        {amount && (
                                                            <span className="ml-2">
                                                                Resto: <span className="text-emerald-400">${(parseFloat(amount) - splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)).toFixed(2)}</span>
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
                                    className={`w-full ${editingGroup ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'} text-white font-medium py-2.5 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2`}
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            {editingGroup ? <Edit2 size={18} /> : <Plus size={18} />}
                                            {editingGroup ? 'Guardar Cambios' : 'Agregar'}
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
                                                {/* Split Details Indicator */}
                                                {expense.split_details && expense.split_details.length > 0 && (
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        División: {expense.split_details.map(d => `${d.name} $${d.amount}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div className="text-slate-200 font-semibold tabular-nums">
                                                {expense.currency === 'USD' ? 'USD ' : '$ '}
                                                {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditGroup(expense)}
                                                    className="p-1.5 bg-slate-700 hover:bg-amber-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGroup(expense)}
                                                    className="p-1.5 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                    title="Eliminar"
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
        </div>
    );
};

export default DailyExpenses;
