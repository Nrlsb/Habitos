import React, { useState, useMemo, useEffect } from 'react';
import { useExpenses } from './ExpensesContext';
import { getDolarRate } from '../../services/dolarApi';
import { Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react';

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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">Mis Planillas de Gastos</h2>

                <form onSubmit={handleAddPlanilla} className="mb-8 flex gap-3 max-w-2xl mx-auto">
                    <input
                        type="text"
                        value={newPlanillaName}
                        onChange={(e) => setNewPlanillaName(e.target.value)}
                        placeholder="Nueva planilla (ej. Enero 2026)"
                        className="flex-1 bg-white border border-slate-300 text-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                    <button type="submit" disabled={!newPlanillaName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm">
                        <Plus size={20} />
                    </button>
                </form>

                <div className="grid gap-4 max-w-2xl mx-auto">
                    {planillas.map(planilla => (
                        <div
                            key={planilla.id}
                            onClick={() => setSelectedPlanillaId(planilla.id)}
                            className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 flex justify-between items-center cursor-pointer transition-all hover:shadow-md"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">{planilla.nombre}</h3>
                                    <p className="text-sm text-slate-500">{new Date(planilla.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => handleDeletePlanilla(planilla.id, e)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}
                    {planillas.length === 0 && (
                        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                            No tienes planillas creadas.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // VIEW: EXPENSE SHEET
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-100 min-h-screen p-6">
            <button
                onClick={() => setSelectedPlanillaId(null)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6 font-medium"
            >
                <ArrowLeft size={20} />
                <span>Volver a Planillas</span>
            </button>

            <div className="max-w-7xl mx-auto">
                <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Planilla: {currentPlanilla?.nombre}</h2>

                {/* TOTAL HEADER */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Gasto Personal Total:</span>
                        <span className="text-blue-600 font-bold text-xl">ARS ${totalPersonalARS.toFixed(2)}</span>
                    </div>
                </div>

                {/* ADD NEW EXPENSE FORM */}
                <div className="bg-white border border-slate-200 rounded-lg p-6 mb-8 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                        {editingId ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                    </h3>
                    <form onSubmit={handleSubmitExpense}>
                        <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                            <div className="flex-grow">
                                <label className="block text-xs text-slate-500 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ej: Compra en el supermercado"
                                    className="w-full bg-white border border-slate-300 text-slate-800 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-xs text-slate-500 mb-1">Monto</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Ej: 50.25"
                                    className="w-full bg-white border border-slate-300 text-slate-800 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-slate-500 mb-1">Moneda</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full bg-white border border-slate-300 text-slate-800 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="ARS">ARS</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4 pb-2">
                                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={esCompartido}
                                        onChange={(e) => setEsCompartido(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Gasto Compartido</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={enCuotas}
                                        onChange={(e) => setEnCuotas(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Pagar en cuotas</span>
                                </label>
                            </div>
                        </div>

                        {enCuotas && (
                            <div className="flex gap-4 mb-4 animate-in fade-in slide-in-from-top-2">
                                <div className="w-32">
                                    <label className="block text-xs text-slate-500 mb-1">Cuota Actual</label>
                                    <input
                                        type="number"
                                        value={cuotaActual}
                                        onChange={(e) => setCuotaActual(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 rounded px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs text-slate-500 mb-1">Total Cuotas</label>
                                    <input
                                        type="number"
                                        value={totalCuotas}
                                        onChange={(e) => setTotalCuotas(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 rounded px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors text-sm">
                                {editingId ? 'Actualizar' : 'Añadir'}
                            </button>
                            {editingId && (
                                <button type="button" onClick={resetForm} className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-medium transition-colors text-sm">
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* EXPENSES TABLE */}
                <div className="mb-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Historial de Gastos</h3>
                </div>

                {/* MOBILE CARD VIEW */}
                <div className="block md:hidden space-y-4">
                    {expenses.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                            No hay gastos registrados.
                        </div>
                    ) : (
                        expenses.map((expense) => {
                            const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                            const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                            // Calculate USD amount for display
                            let montoUsdDisplay = '-';
                            if (expense.currency === 'USD') {
                                montoUsdDisplay = `USD $${expense.amount.toFixed(2)}`;
                            } else if (dolarRate) {
                                montoUsdDisplay = `USD $${(expense.amount / dolarRate).toFixed(2)}`;
                            }

                            return (
                                <div key={expense.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-lg">{expense.description}</h4>
                                            <p className="text-xs text-slate-500">{new Date(expense.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditExpense(expense)}
                                                className="text-slate-400 hover:text-blue-600 p-1"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExpense(expense.id)}
                                                className="text-slate-400 hover:text-red-600 p-1"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-2 text-sm mb-3">
                                        <div>
                                            <span className="text-slate-500 text-xs block">Monto Total</span>
                                            <span className="font-medium text-slate-800">ARS ${montoTotalArs.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-xs block">Monto Personal</span>
                                            <span className="font-bold text-blue-600">ARS ${montoPersonalArs.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-xs block">USD</span>
                                            <span className="text-slate-600">{montoUsdDisplay}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-xs block">Cuotas</span>
                                            <span className="text-slate-600">
                                                {expense.is_installment ? `${expense.current_installment}/${expense.total_installments}` : '-'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {expense.is_shared ? (
                                            <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-1 rounded-full font-medium border border-cyan-200">Compartido</span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-medium border border-slate-200">Personal</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-white uppercase bg-slate-900">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Descripción</th>
                                    <th scope="col" className="px-6 py-3">Monto Total (ARS)</th>
                                    <th scope="col" className="px-6 py-3">Monto Personal (ARS)</th>
                                    <th scope="col" className="px-6 py-3">Monto en Dólares</th>
                                    <th scope="col" className="px-6 py-3">Cuotas</th>
                                    <th scope="col" className="px-6 py-3">Tipo</th>
                                    <th scope="col" className="px-6 py-3">Fecha</th>
                                    <th scope="col" className="px-6 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                                            No hay gastos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((expense, index) => {
                                        const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                                        const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                                        // Calculate USD amount for display
                                        let montoUsdDisplay = '-';
                                        if (expense.currency === 'USD') {
                                            montoUsdDisplay = `USD $${expense.amount.toFixed(2)}`;
                                        } else if (dolarRate) {
                                            montoUsdDisplay = `USD $${(expense.amount / dolarRate).toFixed(2)}`;
                                        }

                                        return (
                                            <tr key={expense.id} className={`border-b border-slate-200 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                <td className="px-6 py-4 font-medium text-slate-800">
                                                    {expense.description}
                                                </td>
                                                <td className="px-6 py-4">
                                                    ARS ${montoTotalArs.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-700">
                                                    ARS ${montoPersonalArs.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {montoUsdDisplay}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {expense.is_installment ? `${expense.current_installment}/${expense.total_installments}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {expense.is_shared ? (
                                                        <span className="bg-cyan-500 text-white text-xs px-2 py-1 rounded font-medium">Compartido</span>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs font-medium">Personal</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {new Date(expense.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEditExpense(expense)}
                                                            className="text-slate-500 border border-slate-300 hover:bg-slate-100 hover:text-blue-600 px-3 py-1 rounded text-xs transition-colors"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteExpense(expense.id)}
                                                            className="text-red-500 border border-red-200 hover:bg-red-50 hover:text-red-600 px-3 py-1 rounded text-xs transition-colors"
                                                        >
                                                            Eliminar
                                                        </button>
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
            </div>
        </div>
    );
}

export default Expenses;
