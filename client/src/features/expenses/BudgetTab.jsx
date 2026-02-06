import React, { useState, useEffect, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { Wallet, TrendingUp, Calendar, ArrowRight, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

const BudgetTab = ({ currentPlanillaId, dolarRate, expenses, currentDate }) => {
    const { upsertBudget, getBudgets, subscriptions } = useExpenses();
    const [income, setIncome] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    const monthKey = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }, [currentDate]);

    useEffect(() => {
        const fetchIncome = async () => {
            const budgets = await getBudgets(monthKey);
            const incomeBudget = budgets.find(b => b.category_name === 'INGRESOS');
            if (incomeBudget) {
                setIncome(incomeBudget.amount.toString());
            } else {
                setIncome('');
            }
        };
        fetchIncome();
    }, [monthKey, getBudgets]);

    const handleSaveIncome = async (e) => {
        e.preventDefault();
        if (!income || isNaN(income)) return;

        setIsSaving(true);
        setSaveStatus(null);
        try {
            await upsertBudget({
                category_name: 'INGRESOS',
                amount: parseFloat(income),
                month: monthKey
            });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (error) {
            console.error("Error saving income:", error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    // Cálculos
    const totalExpensesARS = useMemo(() => {
        return expenses.reduce((acc, expense) => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            const personalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;
            return acc + personalAmount;
        }, 0);
    }, [expenses, dolarRate]);

    const fixedExpensesARS = useMemo(() => {
        return subscriptions.reduce((acc, sub) => {
            const amountInARS = sub.currency === 'USD' && dolarRate ? sub.amount * dolarRate : sub.amount;
            // Assuming subscriptions are personal for now, or half if needed. 
            // Most subs in this app seem to be personal or managed in a specific planilla.
            return acc + amountInARS;
        }, 0);
    }, [subscriptions, dolarRate]);

    const totalBudgeted = parseFloat(income) || 0;
    const remainingBudget = totalBudgeted - fixedExpensesARS - totalExpensesARS;

    // Días restantes en el mes
    const daysRemaining = useMemo(() => {
        const today = new Date();
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Si estamos viendo un mes futuro o pasado, ajustar el cálculo
        const startOfCalculation = (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear())
            ? today
            : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        const diffTime = lastDayOfMonth - startOfCalculation;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 1;
    }, [currentDate]);

    const dailyBudget = remainingBudget > 0 ? (remainingBudget / daysRemaining) : 0;
    const weeklyBudget = dailyBudget * 7;

    const progressPercentage = totalBudgeted > 0
        ? Math.min(((fixedExpensesARS + totalExpensesARS) / totalBudgeted) * 100, 100)
        : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Income Configuration */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <h3 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
                    <Wallet className="text-indigo-400" size={24} />
                    Configuración de Ingresos
                </h3>

                <form onSubmit={handleSaveIncome} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Ingreso Mensual Estimado (ARS)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                            <input
                                type="number"
                                value={income}
                                onChange={(e) => setIncome(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-900/50 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all tabular-nums"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving || !income}
                        className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${saveStatus === 'success'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                            } disabled:opacity-50`}
                    >
                        {isSaving ? 'Guardando...' : saveStatus === 'success' ? (
                            <>
                                <CheckCircle2 size={18} />
                                Guardado
                            </>
                        ) : 'Guardar Ingreso'}
                    </button>
                </form>
                {saveStatus === 'error' && (
                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                        <AlertCircle size={14} /> Error al guardar el ingreso.
                    </p>
                )}
            </div>

            {/* Budget Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-lg">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Disponible Total</span>
                    <div className={`text-2xl font-bold tabular-nums ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${remainingBudget.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-slate-500 text-[10px] mt-2 italic">
                        Ingreso - Gastos Fijos - Gastos Variables
                    </p>
                </div>

                <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-2xl p-6 shadow-lg">
                    <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <TrendingUp size={14} /> Gasto Diario Sugerido
                    </span>
                    <div className="text-2xl font-bold text-white tabular-nums">
                        ${dailyBudget.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-indigo-400/60 text-[10px] mt-2">
                        Basado en {daysRemaining} días restantes
                    </p>
                </div>

                <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-2xl p-6 shadow-lg">
                    <span className="text-cyan-300 text-xs font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <Calendar size={14} /> Gasto Semanal
                    </span>
                    <div className="text-2xl font-bold text-white tabular-nums">
                        ${weeklyBudget.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-cyan-400/60 text-[10px] mt-2">
                        Presupuesto para los próximos 7 días
                    </p>
                </div>
            </div>

            {/* Progress Visualization */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <h4 className="text-lg font-bold text-slate-200 mb-6">Estado del Presupuesto</h4>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Consumo del Ingreso</span>
                            <span className={`font-bold ${progressPercentage > 90 ? 'text-red-400' : 'text-indigo-400'}`}>
                                {progressPercentage.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                            <div
                                style={{ width: `${progressPercentage}%` }}
                                className={`h-full transition-all duration-1000 ease-out rounded-full bg-gradient-to-r ${progressPercentage > 90 ? 'from-red-500 to-orange-500' : 'from-indigo-500 to-cyan-500'
                                    } shadow-[0_0_15px_rgba(99,102,241,0.3)]`}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                                    <ArrowRight size={16} />
                                </div>
                                <span className="text-slate-300 text-sm">Gastos Fijos (Subs)</span>
                            </div>
                            <span className="text-slate-200 font-bold font-mono">${fixedExpensesARS.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <DollarSign size={16} />
                                </div>
                                <span className="text-slate-300 text-sm">Gastos Variables</span>
                            </div>
                            <span className="text-slate-200 font-bold font-mono">${totalExpensesARS.toLocaleString('es-AR')}</span>
                        </div>
                    </div>
                </div>

                {remainingBudget < 0 && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-pulse">
                        <AlertCircle className="text-red-400 shrink-0" size={20} />
                        <div>
                            <p className="text-red-400 text-sm font-bold">Límite de presupuesto excedido</p>
                            <p className="text-red-400/70 text-xs">Has gastado ${Math.abs(remainingBudget).toLocaleString('es-AR')} más de lo ingresado.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BudgetTab;
