import React, { useState, useMemo, useEffect } from 'react';
import { useExpenses } from './ExpensesContext';
import { getDolarRate } from '../../services/dolarApi';
import { Plus, Trash2, ArrowLeft, Edit2, Wallet, CheckCircle, Share2, Users, X, PieChart, BarChart3, List, Check } from 'lucide-react';
import ExpensesAnalysis from './ExpensesAnalysis';

function Expenses() {
    const {
        planillas,
        expenses,
        loading,
        addPlanilla,
        deletePlanilla,
        getExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        sharePlanilla
    } = useExpenses();

    const [selectedPlanillaId, setSelectedPlanillaId] = useState(null);
    const [newPlanillaName, setNewPlanillaName] = useState('');

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareEmail, setShareEmail] = useState('');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');

    // Expense Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [esCompartido, setEsCompartido] = useState(false);
    const [enCuotas, setEnCuotas] = useState(false);
    const [totalCuotas, setTotalCuotas] = useState('');
    const [cuotaActual, setCuotaActual] = useState('');
    const [category, setCategory] = useState('General'); // New Category State
    const [paidBy, setPaidBy] = useState(''); // New Paid By State
    const [editingId, setEditingId] = useState(null);

    // Inline Editing State
    const [editingRowId, setEditingRowId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'analysis'

    const [dolarRate, setDolarRate] = useState(null);

    useEffect(() => {
        const fetchDolar = async () => {
            const rate = await getDolarRate();
            setDolarRate(rate);
        };
        fetchDolar();
    }, []);

    useEffect(() => {
        if (selectedPlanillaId) {
            getExpenses(selectedPlanillaId);
        }
    }, [selectedPlanillaId, getExpenses]);

    const handleAddPlanilla = async (e) => {
        e.preventDefault();
        if (!newPlanillaName.trim()) return;
        await addPlanilla(newPlanillaName);
        setNewPlanillaName('');
    };

    const handleDeletePlanilla = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de eliminar esta planilla?')) {
            await deletePlanilla(id);
            if (selectedPlanillaId === id) setSelectedPlanillaId(null);
        }
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCurrency('ARS');
        setEsCompartido(false);
        setEnCuotas(false);
        setCuotaActual('');
        setTotalCuotas('');
        setCategory('General');
        setPaidBy('');
        setEditingId(null);
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount) return;

        const expenseData = {
            description,
            amount: parseFloat(amount),
            currency,
            category,
            esCompartido,
            enCuotas,
            cuotaActual: enCuotas ? parseInt(cuotaActual) : null,
            totalCuotas: enCuotas ? parseInt(totalCuotas) : null,
            payer_name: esCompartido ? paidBy : null,
        };

        if (editingId) {
            await updateExpense(selectedPlanillaId, editingId, expenseData);
        } else {
            await addExpense(selectedPlanillaId, expenseData);
        }
        resetForm();
    };

    const handleEditExpense = (expense) => {
        setEditingId(expense.id);
        setDescription(expense.description);
        setAmount(expense.amount);
        setCurrency(expense.currency || 'ARS');
        setCategory(expense.category || 'General');
        setEsCompartido(expense.is_shared);
        setEnCuotas(expense.is_installment);
        setCuotaActual(expense.current_installment || '');
        setTotalCuotas(expense.total_installments || '');
        setPaidBy(expense.payer_name || '');
    };

    // Inline Editing Handlers
    const handleStartInlineEdit = (expense) => {
        setEditingRowId(expense.id);
        setEditFormData({
            description: expense.description,
            amount: expense.amount,
            category: expense.category || 'General',
            currency: expense.currency || 'ARS'
        });
    };

    const handleCancelInlineEdit = () => {
        setEditingRowId(null);
        setEditFormData({});
    };

    const handleSaveInlineEdit = async (id) => {
        const originalExpense = expenses.find(e => e.id === id);
        if (!originalExpense) return;

        const updatedData = {
            ...originalExpense, // Keep other fields untouched
            description: editFormData.description,
            amount: parseFloat(editFormData.amount),
            category: editFormData.category,
            currency: editFormData.currency,
            // Map back to DB field names if needed by updateExpense helper, 
            // but updateExpense usually takes the object and component logic might need to ensure backend expectation.
            // Looking at updateExpense implementation in ExpensesContext or usage in handleSubmitExpense:
            // It expects: { description, amount, currency, category, esCompartido, enCuotas... }
            // Let's pass the specific fields we allowed editing.
            esCompartido: originalExpense.is_shared,
            enCuotas: originalExpense.is_installment,
            cuotaActual: originalExpense.current_installment,
            totalCuotas: originalExpense.total_installments
        };

        await updateExpense(selectedPlanillaId, id, updatedData);
        setEditingRowId(null);
        setEditFormData({});
    };

    const handleInlineChange = (field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleDeleteExpense = async (id) => {
        if (window.confirm('¿Eliminar gasto?')) {
            await deleteExpense(selectedPlanillaId, id);
        }
    };

    const handleShareSubmit = async (e) => {
        e.preventDefault();
        setShareError('');
        setShareSuccess('');

        try {
            await sharePlanilla(selectedPlanillaId, shareEmail);
            setShareSuccess(`Invitación enviada a ${shareEmail}`);
            setShareEmail('');
            setTimeout(() => {
                setIsShareModalOpen(false);
                setShareSuccess('');
            }, 2000);
        } catch (err) {
            setShareError(err.message || 'Error al compartir');
        }
    };

    const totalPersonalARS = useMemo(() => {
        if (!dolarRate) return 0;
        return expenses.reduce((acc, expense) => {
            const amountInARS = expense.currency === 'USD' ? expense.amount * dolarRate : expense.amount;
            const personalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;
            return acc + personalAmount;
        }, 0);
    }, [expenses, dolarRate]);

    const currentPlanilla = planillas.find(p => p.id === selectedPlanillaId);

    if (loading && !planillas.length) return <div className="text-center py-10 text-slate-400">Cargando...</div>;

    // VIEW: LIST OF PLANILLAS
    if (!selectedPlanillaId) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">Mis Planillas de Gastos</h2>

                <form onSubmit={handleAddPlanilla} className="mb-8 flex gap-3 max-w-2xl mx-auto">
                    <input
                        type="text"
                        value={newPlanillaName}
                        onChange={(e) => setNewPlanillaName(e.target.value)}
                        placeholder="Nueva planilla (ej. Enero 2026)"
                        className="flex-1 bg-slate-800/50 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-500 shadow-lg shadow-black/10"
                    />
                    <button type="submit" disabled={!newPlanillaName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                        <Plus size={20} />
                    </button>
                </form>

                <div className="grid gap-4 max-w-2xl mx-auto">
                    {planillas.map(planilla => (
                        <div
                            key={planilla.id}
                            onClick={() => setSelectedPlanillaId(planilla.id)}
                            className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 flex justify-between items-center cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${planilla.is_shared_with_me ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                    {planilla.is_shared_with_me ? <Users size={24} /> : <Wallet size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-slate-200">{planilla.nombre}</h3>
                                        {planilla.is_shared_with_me && <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">Compartida</span>}
                                    </div>
                                    <p className="text-sm text-slate-500">{new Date(planilla.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            {!planilla.is_shared_with_me && (
                                <button
                                    onClick={(e) => handleDeletePlanilla(planilla.id, e)}
                                    className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                    {planillas.length === 0 && (
                        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                            No tienes planillas creadas.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // VIEW: EXPENSE SHEET
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen relative">
            {/* Share Modal */}
            {isShareModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsShareModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Share2 className="text-indigo-400" size={24} />
                            Compartir Planilla
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Invita a otros usuarios a colaborar en "{currentPlanilla?.nombre}".
                        </p>

                        <form onSubmit={handleShareSubmit}>
                            <div className="mb-4">
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Email del usuario</label>
                                <input
                                    type="email"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    placeholder="usuario@ejemplo.com"
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    required
                                />
                            </div>

                            {shareError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-2 rounded-lg">{shareError}</p>}
                            {shareSuccess && <p className="text-emerald-400 text-sm mb-4 bg-emerald-500/10 p-2 rounded-lg">{shareSuccess}</p>}

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsShareModalOpen(false)}
                                    className="text-slate-300 hover:text-white px-4 py-2"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium"
                                >
                                    Enviar Invitación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <button
                onClick={() => setSelectedPlanillaId(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 font-medium"
            >
                <ArrowLeft size={20} />
                <span>Volver a Planillas</span>
            </button>

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-200">
                            {currentPlanilla?.nombre}
                        </h2>
                        {currentPlanilla?.is_shared_with_me && (
                            <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/30">
                                Compartido
                            </span>
                        )}
                    </div>

                    {!currentPlanilla?.is_shared_with_me && (
                        <button
                            onClick={() => setIsShareModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 px-4 py-2 rounded-xl border border-indigo-500/20 transition-all font-medium"
                        >
                            <Share2 size={18} />
                            Compartir
                        </button>
                    )}
                </div>

                {/* TOTAL HEADER */}
                <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 mb-8 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity duration-700 group-hover:opacity-75"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-300">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Gasto Personal Total</span>
                                <div className="text-3xl font-bold text-white tabular-nums mt-1">
                                    ARS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">${totalPersonalARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                        {dolarRate && (
                            <div className="text-right bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                                <span className="text-xs text-slate-500 uppercase block">Cotización Dólar</span>
                                <span className="text-emerald-400 font-mono font-medium">${dolarRate}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* TABS NAVIGATION */}
                <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-xl w-fit border border-slate-700/50">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <List size={18} />
                        Lista
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <PieChart size={18} />
                        Análisis
                    </button>
                </div>

                {activeTab === 'analysis' ? (
                    <ExpensesAnalysis expenses={expenses} dolarRate={dolarRate} />
                ) : (
                    <>
                        {/* ADD NEW EXPENSE FORM */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8 shadow-lg backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                                <Plus size={20} className="text-indigo-400" />
                                {editingId ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                            </h3>
                            <form onSubmit={handleSubmitExpense}>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                                    <div className="md:col-span-5">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Descripción</label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Ej: Compra en el supermercado"
                                            className="w-full bg-slate-900/50 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Categoría</label>
                                        <div className="relative">
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full bg-slate-900/50 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="General">General</option>
                                                <option value="Comida">Comida 🍔</option>
                                                <option value="Transporte">Transporte 🚌</option>
                                                <option value="Servicios">Servicios 💡</option>
                                                <option value="Alquiler">Alquiler 🏠</option>
                                                <option value="Supermercado">Supermercado 🛒</option>
                                                <option value="Mascota">Mascota 🐶</option>
                                                <option value="Hogar">Hogar 🛋️</option>
                                                <option value="Viandas">Viandas 🍱</option>
                                                <option value="Alcohol">Alcohol 🍺</option>
                                                <option value="Ocio">Ocio 🎬</option>
                                                <option value="Salud">Salud 💊</option>
                                                <option value="Ropa">Ropa 👕</option>
                                                <option value="Educación">Educación 📚</option>
                                                <option value="Otros">Otros 📦</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Monto</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-900/50 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600 tabular-nums"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Moneda</label>
                                        <div className="relative">
                                            <select
                                                value={currency}
                                                onChange={(e) => setCurrency(e.target.value)}
                                                className="w-full bg-slate-900/50 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="ARS">ARS 🇦🇷</option>
                                                <option value="USD">USD 🇺🇸</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 mb-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${esCompartido ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900/50 group-hover:border-slate-500'}`}>
                                            {esCompartido && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={esCompartido}
                                            onChange={(e) => setEsCompartido(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">Gasto Compartido</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${enCuotas ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900/50 group-hover:border-slate-500'}`}>
                                            {enCuotas && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={enCuotas}
                                            onChange={(e) => setEnCuotas(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">Pagar en cuotas</span>
                                    </label>
                                </div>

                                {esCompartido && (
                                    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Pagado por</label>
                                        <input
                                            type="text"
                                            value={paidBy}
                                            onChange={(e) => setPaidBy(e.target.value)}
                                            placeholder="Nombre de quien pagó (ej. Yo, Juan)"
                                            className="w-full md:w-1/2 bg-slate-900/50 border border-slate-600/50 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                                        />
                                    </div>
                                )}

                                {enCuotas && (
                                    <div className="flex gap-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
                                        <div className="w-32">
                                            <label className="block text-xs text-slate-500 mb-1.5 ml-1">Cuota Actual</label>
                                            <input
                                                type="number"
                                                value={cuotaActual}
                                                onChange={(e) => setCuotaActual(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-xs text-slate-500 mb-1.5 ml-1">Total Cuotas</label>
                                            <input
                                                type="number"
                                                value={totalCuotas}
                                                onChange={(e) => setTotalCuotas(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex-1 md:flex-none md:min-w-[120px]">
                                        {editingId ? 'Actualizar' : 'Añadir Gasto'}
                                    </button>
                                    {editingId && (
                                        <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors">
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* EXPENSES TABLE */}
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-200 mb-2">Historial de Gastos</h3>
                        </div>

                        {/* MOBILE CARD VIEW */}
                        <div className="block md:hidden space-y-4">
                            {expenses.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                                    No hay gastos registrados.
                                </div>
                            ) : (
                                expenses.map((expense) => {
                                    const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                                    const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                                    // Calculate USD amount for display
                                    let montoUsdDisplay = null;
                                    if (expense.currency === 'USD') {
                                        montoUsdDisplay = `USD $${expense.amount.toFixed(2)}`;
                                    } else if (dolarRate) {
                                        montoUsdDisplay = `USD $${(expense.amount / dolarRate).toFixed(2)}`;
                                    }

                                    return (
                                        <div key={expense.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-semibold text-slate-200 text-lg">{expense.description}</h4>
                                                    <p className="text-xs text-slate-500">{new Date(expense.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditExpense(expense)}
                                                        className="text-slate-500 hover:text-indigo-400 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteExpense(expense.id)}
                                                        className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mb-4">
                                                <div className="bg-slate-900/50 p-2 rounded-lg">
                                                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">Monto Total</span>
                                                    <span className="font-medium text-slate-300 tabular-nums">${montoTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="bg-indigo-900/20 p-2 rounded-lg border border-indigo-500/20">
                                                    <span className="text-indigo-400 text-[10px] uppercase tracking-wider block mb-0.5">Personal</span>
                                                    <span className="font-bold text-indigo-300 tabular-nums">${montoPersonalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                {montoUsdDisplay && (
                                                    <div className="col-span-2 flex justify-between items-center border-t border-slate-700 pt-2 mt-1">
                                                        <span className="text-slate-500 text-xs">Equivalente USD</span>
                                                        <span className="text-slate-400 font-mono text-xs">{montoUsdDisplay}</span>
                                                    </div>
                                                )}
                                                {expense.is_installment && (
                                                    <div className="col-span-2">
                                                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                            <span>Progreso Cuotas</span>
                                                            <span>{expense.current_installment}/{expense.total_installments}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                style={{ width: `${(expense.current_installment / expense.total_installments) * 100}%` }}
                                                                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {expense.is_shared ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2.5 py-1 rounded-full font-medium border border-cyan-500/20">Compartido</span>
                                                        {expense.payer_name && <span className="text-[10px] text-slate-500">Pagado por: <span className="text-slate-300">{expense.payer_name}</span></span>}
                                                    </div>
                                                ) : (
                                                    <span className="bg-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-600">Personal</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden md:block bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/80 border-b border-slate-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide">Descripción</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Monto Total (ARS)</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Categoría</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Monto Personal (ARS)</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Ref. USD</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Cuotas</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Tipo</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Fecha</th>
                                            <th scope="col" className="px-6 py-4 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {expenses.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                                    No hay gastos registrados en esta planilla.
                                                </td>
                                            </tr>
                                        ) : (
                                            expenses.map((expense, index) => {
                                                const isEditing = editingRowId === expense.id;

                                                const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                                                const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                                                // Calculate USD amount for display
                                                let montoUsdDisplay = '-';
                                                if (expense.currency === 'USD') {
                                                    montoUsdDisplay = `$${expense.amount.toFixed(2)}`;
                                                } else if (dolarRate) {
                                                    montoUsdDisplay = `$${(expense.amount / dolarRate).toFixed(2)}`;
                                                }

                                                return (
                                                    <tr key={expense.id} className={`group hover:bg-slate-700/30 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/30'}`}>
                                                        <td className="px-6 py-4 font-medium text-slate-200">
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={editFormData.description}
                                                                    onChange={(e) => handleInlineChange('description', e.target.value)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                expense.description
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-300">
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <input
                                                                        type="number"
                                                                        value={editFormData.amount}
                                                                        onChange={(e) => handleInlineChange('amount', e.target.value)}
                                                                        className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm text-right focus:border-indigo-500 focus:outline-none"
                                                                    />
                                                                    <select
                                                                        value={editFormData.currency}
                                                                        onChange={(e) => handleInlineChange('currency', e.target.value)}
                                                                        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                                                                    >
                                                                        <option value="ARS">ARS</option>
                                                                        <option value="USD">USD</option>
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                `$ ${montoTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {isEditing ? (
                                                                <select
                                                                    value={editFormData.category}
                                                                    onChange={(e) => handleInlineChange('category', e.target.value)}
                                                                    className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                                                                >
                                                                    <option value="General">General</option>
                                                                    <option value="Comida">Comida 🍔</option>
                                                                    <option value="Transporte">Transporte 🚌</option>
                                                                    <option value="Servicios">Servicios 💡</option>
                                                                    <option value="Alquiler">Alquiler 🏠</option>
                                                                    <option value="Supermercado">Supermercado 🛒</option>
                                                                    <option value="Mascota">Mascota 🐶</option>
                                                                    <option value="Hogar">Hogar 🛋️</option>
                                                                    <option value="Viandas">Viandas 🍱</option>
                                                                    <option value="Alcohol">Alcohol 🍺</option>
                                                                    <option value="Ocio">Ocio 🎬</option>
                                                                    <option value="Salud">Salud 💊</option>
                                                                    <option value="Ropa">Ropa 👕</option>
                                                                    <option value="Educación">Educación 📚</option>
                                                                    <option value="Otros">Otros 📦</option>
                                                                </select>
                                                            ) : (
                                                                <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md text-xs border border-slate-600/50">
                                                                    {expense.category || 'General'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums font-semibold text-indigo-300">
                                                            $ {montoPersonalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-500 font-mono text-xs">
                                                            {montoUsdDisplay}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {expense.is_installment ? (
                                                                <div className="w-24 mx-auto">
                                                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                                        <span>{expense.current_installment}/{expense.total_installments}</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                                        <div
                                                                            style={{ width: `${(expense.current_installment / expense.total_installments) * 100}%` }}
                                                                            className={`h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400`}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-slate-600">-</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {expense.is_shared ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="inline-flex items-center justify-center bg-cyan-500/10 text-cyan-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-cyan-500/20 tracking-wide">Shared</span>
                                                                    {expense.payer_name && <span className="text-[9px] text-slate-500 whitespace-nowrap">Por: {expense.payer_name}</span>}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-slate-700 tracking-wide">Personal</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                            {new Date(expense.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`flex justify-end gap-2 transition-opacity ${isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                                {isEditing ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleSaveInlineEdit(expense.id)}
                                                                            className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
                                                                            title="Guardar"
                                                                        >
                                                                            <Check size={18} />
                                                                        </button>
                                                                        <button
                                                                            onClick={handleCancelInlineEdit}
                                                                            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                                            title="Cancelar"
                                                                        >
                                                                            <X size={18} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleStartInlineEdit(expense)}
                                                                            className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                                                            title="Editar"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteExpense(expense.id)}
                                                                            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                                                            title="Eliminar"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Expenses;
