import React, { useState, useMemo, useEffect } from 'react';
import { useExpenses } from './ExpensesContext';
import { getDolarRate } from '../../services/dolarApi';
import { Plus, Trash2, ArrowLeft, DollarSign, CreditCard, Users, Calendar } from 'lucide-react';

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
        deleteExpense
    } = useExpenses();

    const [selectedPlanillaId, setSelectedPlanillaId] = useState(null);
    const [newPlanillaName, setNewPlanillaName] = useState('');

    // Expense Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [esCompartido, setEsCompartido] = useState(false);
    const [enCuotas, setEnCuotas] = useState(false);
    const [totalCuotas, setTotalCuotas] = useState('');
    const [cuotaActual, setCuotaActual] = useState('');
    const [editingId, setEditingId] = useState(null);

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
        setEditingId(null);
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount) return;

        const expenseData = {
            description,
            amount: parseFloat(amount),
            currency,
            esCompartido,
            enCuotas,
            cuotaActual: enCuotas ? parseInt(cuotaActual) : null,
            totalCuotas: enCuotas ? parseInt(totalCuotas) : null,
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
        setEsCompartido(expense.is_shared);
        setEnCuotas(expense.is_installment);
        setCuotaActual(expense.current_installment || '');
        setTotalCuotas(expense.total_installments || '');
    };

    const handleDeleteExpense = async (id) => {
        if (window.confirm('¿Eliminar gasto?')) {
            await deleteExpense(selectedPlanillaId, id);
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-2xl font-bold text-white mb-6">Mis Planillas de Gastos</h2>

                <form onSubmit={handleAddPlanilla} className="mb-8 flex gap-3">
                    <input
                        type="text"
                        value={newPlanillaName}
                        onChange={(e) => setNewPlanillaName(e.target.value)}
                        placeholder="Nueva planilla (ej. Enero 2026)"
                        className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={!newPlanillaName.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50">
                        <Plus size={20} />
                    </button>
                </form>

                <div className="grid gap-4">
                    {planillas.map(planilla => (
                        <div
                            key={planilla.id}
                            onClick={() => setSelectedPlanillaId(planilla.id)}
                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-5 flex justify-between items-center cursor-pointer transition-all hover:shadow-lg hover:border-slate-600"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-white">{planilla.nombre}</h3>
                                    <p className="text-xs text-slate-500">{new Date(planilla.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => handleDeletePlanilla(planilla.id, e)}
                                className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {planillas.length === 0 && (
                        <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                            No tienes planillas creadas.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // VIEW: EXPENSE SHEET
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
                onClick={() => setSelectedPlanillaId(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
            >
                <ArrowLeft size={20} />
                <span>Volver a Planillas</span>
            </button>

            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-1">{currentPlanilla?.nombre}</h2>
                    <p className="text-slate-400 text-sm">Gestiona tus gastos mensuales</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 px-5 py-3 rounded-xl">
                    <p className="text-xs text-slate-400 mb-1">Total Personal (Estimado)</p>
                    <div className="text-2xl font-bold text-green-400">
                        ARS ${totalPersonalARS.toFixed(2)}
                    </div>
                    {dolarRate && <p className="text-xs text-slate-500 mt-1">Dólar Venta: ${dolarRate}</p>}
                </div>
            </header>

            {/* FORM */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">{editingId ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
                <form onSubmit={handleSubmitExpense} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-6">
                            <label className="block text-xs text-slate-500 mb-1">Descripción</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ej. Supermercado"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs text-slate-500 mb-1">Monto</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs text-slate-500 mb-1">Moneda</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ARS">ARS</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm">
                            <input
                                type="checkbox"
                                checked={esCompartido}
                                onChange={(e) => setEsCompartido(e.target.checked)}
                                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                            />
                            <Users size={16} />
                            <span>Compartido (50%)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm">
                            <input
                                type="checkbox"
                                checked={enCuotas}
                                onChange={(e) => setEnCuotas(e.target.checked)}
                                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                            />
                            <CreditCard size={16} />
                            <span>En Cuotas</span>
                        </label>
                    </div>

                    {enCuotas && (
                        <div className="flex gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Cuota Actual</label>
                                <input
                                    type="number"
                                    value={cuotaActual}
                                    onChange={(e) => setCuotaActual(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Total Cuotas</label>
                                <input
                                    type="number"
                                    value={totalCuotas}
                                    onChange={(e) => setTotalCuotas(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition-colors">
                            {editingId ? 'Actualizar Gasto' : 'Agregar Gasto'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={resetForm} className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors">
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* LIST */}
            <div className="space-y-3">
                {expenses.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">No hay gastos registrados en esta planilla.</div>
                ) : (
                    expenses.map(expense => {
                        const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                        const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                        return (
                            <div key={expense.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-white">{expense.description}</span>
                                        {expense.is_shared && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">Compartido</span>}
                                        {expense.is_installment && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">{expense.current_installment}/{expense.total_installments}</span>}
                                    </div>
                                    <div className="text-sm text-slate-400 flex gap-3">
                                        <span>
                                            {expense.currency} ${expense.amount}
                                        </span>
                                        {expense.currency === 'USD' && dolarRate && (
                                            <span className="text-slate-500">
                                                (~ ARS ${montoTotalArs.toFixed(2)})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right mr-4">
                                    <div className="text-sm font-bold text-green-400">
                                        Personal: ARS ${montoPersonalArs.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        {new Date(expense.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditExpense(expense)} className="text-slate-400 hover:text-white p-1">
                                        <CreditCard size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteExpense(expense.id)} className="text-slate-400 hover:text-red-400 p-1">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default Expenses;
