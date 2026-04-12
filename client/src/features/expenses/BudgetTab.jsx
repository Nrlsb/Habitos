import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExpenses } from './ExpensesContext';
import {
    Wallet, TrendingUp, Calendar, DollarSign, AlertCircle,
    Plus, Trash2, Target, Save, TriangleAlert, CheckCircle2, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n) => (isNaN(n) ? '0' : Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

const subMonthlyEquivalent = (sub, dolarRate) => {
    const amt = parseFloat(sub.amount) || 0;
    const inArs = sub.currency === 'USD' && dolarRate ? amt * dolarRate : amt;
    if (sub.frequency === 'annual') return inArs / 12;
    if (sub.frequency === 'quarterly') return inArs / 3;
    return inArs;
};

const BudgetTab = ({ currentPlanillaId, dolarRate, expenses, currentDate }) => {
    const { upsertBudget, getBudgets, subscriptions, categories, expenses: allExpenses } = useExpenses();

    const monthKey = useMemo(() => {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }, [currentDate]);

    const prevMonthKey = useMemo(() => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, [currentDate]);

    // Server state
    const [prevBudgets, setPrevBudgets] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showAnnual, setShowAnnual] = useState(false);

    // Editable state
    const [incomes, setIncomes] = useState([]); // [{key, label, amount}]
    const [newIncomeLabel, setNewIncomeLabel] = useState('');
    const [newIncomeAmount, setNewIncomeAmount] = useState('');
    const [savingsGoal, setSavingsGoal] = useState('');
    const [catBudgets, setCatBudgets] = useState({}); // {catName: string}

    const loadBudgets = useCallback(async () => {
        const [curr, prev] = await Promise.all([
            getBudgets(monthKey, currentPlanillaId),
            getBudgets(prevMonthKey, currentPlanillaId),
        ]);
        setPrevBudgets(prev || []);

        // Parse incomes (new schema: INGRESO:Label, backward compat: INGRESOS)
        const incs = (curr || [])
            .filter(b => b.category_name.startsWith('INGRESO:'))
            .map(b => ({ key: b.category_name, label: b.category_name.replace('INGRESO:', ''), amount: b.amount }));
        if (incs.length === 0) {
            const old = (curr || []).find(b => b.category_name === 'INGRESOS');
            if (old) incs.push({ key: 'INGRESO:Principal', label: 'Principal', amount: old.amount });
        }
        setIncomes(incs);

        const sg = (curr || []).find(b => b.category_name === 'AHORRO_OBJETIVO');
        setSavingsGoal(sg ? String(sg.amount) : '');

        const cb = {};
        (curr || []).filter(b => b.category_name.startsWith('CATBUDGET:')).forEach(b => {
            cb[b.category_name.replace('CATBUDGET:', '')] = String(b.amount);
        });
        setCatBudgets(cb);
        setIsDirty(false);
    }, [monthKey, prevMonthKey, getBudgets, currentPlanillaId]);

    useEffect(() => { loadBudgets(); }, [loadBudgets]);

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const saves = [];
            incomes.forEach(inc => saves.push(upsertBudget({
                category_name: inc.key,
                amount: parseFloat(inc.amount) || 0,
                month: monthKey,
                planilla_id: currentPlanillaId,
            })));
            if (savingsGoal !== '') saves.push(upsertBudget({
                category_name: 'AHORRO_OBJETIVO',
                amount: parseFloat(savingsGoal) || 0,
                month: monthKey,
                planilla_id: currentPlanillaId,
            }));
            Object.entries(catBudgets).forEach(([cat, amount]) => {
                if (amount !== '') saves.push(upsertBudget({
                    category_name: `CATBUDGET:${cat}`,
                    amount: parseFloat(amount) || 0,
                    month: monthKey,
                    planilla_id: currentPlanillaId,
                }));
            });
            await Promise.all(saves);
            toast.success('Presupuesto guardado');
            setIsDirty(false);
            await loadBudgets();
        } catch {
            toast.error('Error al guardar el presupuesto');
        } finally {
            setIsSaving(false);
        }
    };

    // ---- CALCULATIONS ----
    const totalIncome = useMemo(() =>
        incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [incomes]);

    const savingsGoalNum = useMemo(() => parseFloat(savingsGoal) || 0, [savingsGoal]);

    const activeSubscriptions = useMemo(() =>
        (Array.isArray(subscriptions) ? subscriptions : []).filter(s => s.active !== false),
        [subscriptions]);

    const fixedExpensesARS = useMemo(() =>
        activeSubscriptions.reduce((acc, sub) => acc + subMonthlyEquivalent(sub, dolarRate), 0),
        [activeSubscriptions, dolarRate]);

    const totalExpensesARS = useMemo(() =>
        expenses.reduce((acc, e) => {
            const amt = e.currency === 'USD' && dolarRate ? e.amount * dolarRate : e.amount;
            return acc + (e.is_shared ? amt / 2 : amt);
        }, 0), [expenses, dolarRate]);

    const totalSpent = fixedExpensesARS + totalExpensesARS;
    const availableAfterSavings = totalIncome - savingsGoalNum - totalSpent;
    const progressPercentage = totalIncome > 0 ? Math.min((totalSpent / totalIncome) * 100, 100) : 0;

    const { daysInMonth, daysElapsed, daysRemaining } = useMemo(() => {
        const today = new Date();
        const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
        const dim = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const elapsed = isCurrentMonth ? today.getDate() : dim;
        return { daysInMonth: dim, daysElapsed: elapsed, daysRemaining: Math.max(dim - elapsed, 1) };
    }, [currentDate]);

    const dailyBudget = availableAfterSavings > 0 ? availableAfterSavings / daysRemaining : 0;

    const projectedBalance = useMemo(() => {
        if (daysElapsed === 0) return totalIncome - savingsGoalNum - fixedExpensesARS;
        const projected = (totalExpensesARS / daysElapsed) * daysInMonth;
        return totalIncome - savingsGoalNum - fixedExpensesARS - projected;
    }, [totalIncome, savingsGoalNum, fixedExpensesARS, totalExpensesARS, daysElapsed, daysInMonth]);

    const expensesByCategory = useMemo(() => {
        const map = {};
        expenses.forEach(e => {
            const cat = e.category || 'General';
            const amt = e.currency === 'USD' && dolarRate ? e.amount * dolarRate : e.amount;
            map[cat] = (map[cat] || 0) + (e.is_shared ? amt / 2 : amt);
        });
        return map;
    }, [expenses, dolarRate]);

    // Previous month
    const prevIncome = useMemo(() =>
        prevBudgets
            .filter(b => b.category_name.startsWith('INGRESO:') || b.category_name === 'INGRESOS')
            .reduce((s, b) => s + b.amount, 0), [prevBudgets]);

    const prevSavingsGoal = useMemo(() => {
        const b = prevBudgets.find(b => b.category_name === 'AHORRO_OBJETIVO');
        return b ? b.amount : 0;
    }, [prevBudgets]);

    const prevMonthExpenses = useMemo(() => {
        if (!allExpenses?.length) return 0;
        const [py, pm] = prevMonthKey.split('-').map(Number);
        return allExpenses
            .filter(e => {
                const d = new Date(e.created_at);
                return d.getFullYear() === py && d.getMonth() + 1 === pm;
            })
            .reduce((acc, e) => {
                const amt = e.currency === 'USD' && dolarRate ? e.amount * dolarRate : e.amount;
                return acc + (e.is_shared ? amt / 2 : amt);
            }, 0);
    }, [allExpenses, prevMonthKey, dolarRate]);

    const prevBalance = prevIncome - prevSavingsGoal - prevMonthExpenses;
    const prevSavingsAchieved = prevIncome > 0 ? prevBalance >= prevSavingsGoal : null;

    // Proyección anual
    const annualIncome = totalIncome * 12;
    const annualFixed = activeSubscriptions.reduce((acc, sub) => {
        const amt = parseFloat(sub.amount) || 0;
        const inArs = sub.currency === 'USD' && dolarRate ? amt * dolarRate : amt;
        if (sub.frequency === 'annual') return acc + inArs;
        if (sub.frequency === 'quarterly') return acc + inArs * 4;
        return acc + inArs * 12;
    }, 0);
    const dailyRate = daysElapsed > 0 ? totalExpensesARS / daysElapsed : 0;
    const annualVariable = dailyRate * 365;
    const annualSavingsGoal = savingsGoalNum * 12;
    const annualBalance = annualIncome - annualFixed - annualVariable - annualSavingsGoal;

    // ---- HANDLERS ----
    const addIncome = () => {
        if (!newIncomeLabel.trim() || !newIncomeAmount) return;
        const key = `INGRESO:${newIncomeLabel.trim()}`;
        if (incomes.find(i => i.key === key)) { toast.error('Ya existe una fuente con ese nombre'); return; }
        setIncomes(p => [...p, { key, label: newIncomeLabel.trim(), amount: parseFloat(newIncomeAmount) || 0 }]);
        setNewIncomeLabel('');
        setNewIncomeAmount('');
        setIsDirty(true);
    };

    const removeIncome = (key) => { setIncomes(p => p.filter(i => i.key !== key)); setIsDirty(true); };
    const updateIncomeAmount = (key, val) => { setIncomes(p => p.map(i => i.key === key ? { ...i, amount: val } : i)); setIsDirty(true); };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-24 overflow-y-auto max-h-[calc(100vh-120px)]">

            {/* === INGRESOS === */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <Wallet className="text-primary" size={20} />
                        Ingresos del Mes
                    </h3>
                    <span className="text-2xl font-bold text-primary tabular-nums">${fmt(totalIncome)}</span>
                </div>

                <div className="space-y-2 mb-4">
                    {incomes.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-2">Sin fuentes de ingreso. Agregá una abajo.</p>
                    )}
                    {incomes.map(inc => (
                        <div key={inc.key} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="flex-1 text-slate-300 text-sm font-medium truncate">{inc.label}</span>
                            <div className="relative shrink-0">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                <input
                                    type="number"
                                    value={inc.amount}
                                    onChange={e => updateIncomeAmount(inc.key, e.target.value)}
                                    className="w-36 bg-white/5 border border-slate-600/50 text-slate-100 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 tabular-nums"
                                    min="0"
                                />
                            </div>
                            <button onClick={() => removeIncome(inc.key)} className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={newIncomeLabel}
                        onChange={e => setNewIncomeLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addIncome()}
                        placeholder="Fuente (ej. Sueldo)"
                        className="flex-1 bg-white/5 border border-slate-600/50 text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder-slate-600"
                    />
                    <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <input
                            type="number"
                            value={newIncomeAmount}
                            onChange={e => setNewIncomeAmount(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addIncome()}
                            placeholder="Monto"
                            className="w-36 bg-white/5 border border-slate-600/50 text-slate-100 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            min="0"
                        />
                    </div>
                    <button
                        onClick={addIncome}
                        disabled={!newIncomeLabel.trim() || !newIncomeAmount}
                        className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-all disabled:opacity-40 shrink-0"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* === OBJETIVO DE AHORRO === */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                    <Target className="text-primary" size={20} />
                    Objetivo de Ahorro
                </h3>
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        <input
                            type="number"
                            value={savingsGoal}
                            onChange={e => { setSavingsGoal(e.target.value); setIsDirty(true); }}
                            placeholder="¿Cuánto querés ahorrar este mes?"
                            className="w-full bg-white/5 border border-slate-600/50 text-slate-100 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 tabular-nums"
                            min="0"
                        />
                    </div>
                    {savingsGoalNum > 0 && totalIncome > 0 && (
                        <span className="text-primary text-sm font-bold whitespace-nowrap shrink-0">
                            {((savingsGoalNum / totalIncome) * 100).toFixed(0)}% del ingreso
                        </span>
                    )}
                </div>
                {savingsGoalNum > 0 && (
                    <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden border border-primary/10">
                        <div
                            style={{ width: `${Math.min((savingsGoalNum / (totalIncome || 1)) * 100, 100)}%` }}
                            className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-700"
                        />
                    </div>
                )}
            </div>

            {/* === RESUMEN DEL MES === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 shadow-lg">
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Ingresos</span>
                    <div className="text-xl font-bold text-primary tabular-nums">${fmt(totalIncome)}</div>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 shadow-lg">
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Gastado</span>
                    <div className="text-xl font-bold text-white tabular-nums">${fmt(totalSpent)}</div>
                </div>
                <div className={`rounded-2xl p-5 shadow-lg border ${availableAfterSavings >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Disponible</span>
                    <div className={`text-xl font-bold tabular-nums ${availableAfterSavings >= 0 ? 'text-primary' : 'text-red-400'}`}>
                        {availableAfterSavings < 0 ? '-' : ''}${fmt(availableAfterSavings)}
                    </div>
                    {savingsGoalNum > 0 && <p className="text-[10px] text-slate-500 mt-1">Descontando ahorro</p>}
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-2xl p-5 shadow-lg">
                    <span className="text-cyan-300 text-[11px] font-semibold uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <TrendingUp size={11} /> Gasto diario
                    </span>
                    <div className="text-xl font-bold text-white tabular-nums">${fmt(dailyBudget)}</div>
                    <p className="text-[10px] text-cyan-400/60 mt-1">{daysRemaining} días restantes</p>
                </div>
            </div>

            {/* === BARRA DE PROGRESO === */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-300 text-sm font-bold">Consumo del Ingreso</span>
                    <span className={`font-bold text-sm ${progressPercentage > 90 ? 'text-red-400' : 'text-primary'}`}>
                        {progressPercentage.toFixed(1)}%
                    </span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-primary/10">
                    <div
                        style={{ width: `${progressPercentage}%` }}
                        className={`h-full transition-all duration-1000 rounded-full bg-gradient-to-r ${progressPercentage > 90 ? 'from-red-500 to-orange-500' : 'from-primary to-cyan-500'}`}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[11px] text-slate-500 flex-wrap gap-x-4">
                    <span>Suscripciones: ${fmt(fixedExpensesARS)}</span>
                    <span>Variables: ${fmt(totalExpensesARS)}</span>
                    {savingsGoalNum > 0 && <span>Ahorro obj: ${fmt(savingsGoalNum)}</span>}
                </div>
                {/* Desglose visual fijos vs variables */}
                {totalIncome > 0 && (
                    <div className="mt-3 flex h-1.5 w-full rounded-full overflow-hidden gap-px bg-white/5">
                        <div style={{ width: `${Math.min((fixedExpensesARS / totalIncome) * 100, 100)}%` }}
                            className="bg-cyan-500 rounded-l-full transition-all duration-700" title={`Suscripciones: $${fmt(fixedExpensesARS)}`} />
                        <div style={{ width: `${Math.min((totalExpensesARS / totalIncome) * 100, 100)}%` }}
                            className="bg-primary transition-all duration-700" title={`Variables: $${fmt(totalExpensesARS)}`} />
                        {savingsGoalNum > 0 && (
                            <div style={{ width: `${Math.min((savingsGoalNum / totalIncome) * 100, 100)}%` }}
                                className="bg-purple-500 rounded-r-full transition-all duration-700" title={`Ahorro: $${fmt(savingsGoalNum)}`} />
                        )}
                    </div>
                )}
                {totalIncome > 0 && (
                    <div className="flex gap-4 mt-1.5 text-[10px]">
                        <span className="flex items-center gap-1 text-cyan-400"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />Suscripciones</span>
                        <span className="flex items-center gap-1 text-primary"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Variables</span>
                        {savingsGoalNum > 0 && <span className="flex items-center gap-1 text-purple-400"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Ahorro</span>}
                    </div>
                )}
                {availableAfterSavings < 0 && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                        <AlertCircle className="text-red-400 shrink-0" size={16} />
                        <p className="text-red-400 text-xs font-medium">
                            Excediste el presupuesto por ${fmt(Math.abs(availableAfterSavings))}
                        </p>
                    </div>
                )}
            </div>

            {/* === PROYECCIÓN DE CIERRE === */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                    <TrendingUp className="text-primary" size={20} />
                    Proyección de Cierre
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                        <p className="text-slate-400 text-[11px] mb-1 uppercase tracking-wide">Ritmo actual</p>
                        <p className="text-base font-bold text-white tabular-nums">
                            ${fmt(daysElapsed > 0 ? totalExpensesARS / daysElapsed : 0)}/día
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">{daysElapsed} días registrados</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                        <p className="text-slate-400 text-[11px] mb-1 uppercase tracking-wide">Variable proyectado</p>
                        <p className="text-base font-bold text-white tabular-nums">
                            ${fmt(daysElapsed > 0 ? (totalExpensesARS / daysElapsed) * daysInMonth : 0)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">para {daysInMonth} días</p>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${projectedBalance >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <p className="text-slate-400 text-[11px] mb-1 uppercase tracking-wide">Balance final</p>
                        <p className={`text-base font-bold tabular-nums ${projectedBalance >= 0 ? 'text-primary' : 'text-red-400'}`}>
                            {projectedBalance < 0 ? '-' : ''}${fmt(projectedBalance)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">estimado al fin de mes</p>
                    </div>
                </div>
            </div>

            {/* === PRESUPUESTO POR CATEGORÍAS === */}
            {categories.length > 0 && (
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-5">
                        <DollarSign className="text-primary" size={20} />
                        Presupuesto por Categorías
                    </h3>
                    <div className="space-y-3">
                        {categories.map(cat => {
                            const catName = cat.name || cat;
                            const budget = parseFloat(catBudgets[catName]) || 0;
                            const spent = expensesByCategory[catName] || 0;
                            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                            const over = budget > 0 && spent > budget;
                            return (
                                <div key={cat.id || catName} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-lg shrink-0">{cat.icon || '📦'}</span>
                                        <span className="text-slate-200 text-sm font-medium flex-1 min-w-0 truncate">{catName}</span>
                                        {budget > 0 && pct >= 80 && !over && (
                                            <TriangleAlert size={14} className="text-orange-400 shrink-0" title="Cerca del límite" />
                                        )}
                                        {over && (
                                            <TriangleAlert size={14} className="text-red-400 shrink-0" title="Límite excedido" />
                                        )}
                                        <div className="relative shrink-0">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                            <input
                                                type="number"
                                                value={catBudgets[catName] || ''}
                                                onChange={e => { setCatBudgets(p => ({ ...p, [catName]: e.target.value })); setIsDirty(true); }}
                                                placeholder="Límite"
                                                className="w-32 bg-white/5 border border-slate-600/50 text-slate-100 rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    {budget > 0 ? (
                                        <>
                                            <div className="flex justify-between text-[11px] mb-1.5">
                                                <span className={over ? 'text-red-400 font-medium' : 'text-slate-400'}>
                                                    ${fmt(spent)} gastado
                                                </span>
                                                <span className={over ? 'text-red-400 font-bold' : 'text-slate-500'}>
                                                    {over ? `+$${fmt(spent - budget)} excedido` : `$${fmt(budget - spent)} restante`}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    style={{ width: `${pct}%` }}
                                                    className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-500' : pct > 80 ? 'bg-orange-400' : 'bg-primary'}`}
                                                />
                                            </div>
                                        </>
                                    ) : spent > 0 ? (
                                        <p className="text-[11px] text-slate-500">Gastado: ${fmt(spent)} · Sin límite configurado</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* === COMPARACIÓN MENSUAL === */}
            {prevIncome > 0 && (
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-5">
                        <Calendar className="text-primary" size={20} />
                        Comparación Mensual
                    </h3>
                    {/* Ahorro logrado el mes anterior */}
                    {prevSavingsGoal > 0 && (
                        <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3
                            ${prevSavingsAchieved ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            {prevSavingsAchieved
                                ? <CheckCircle2 className="text-primary shrink-0" size={20} />
                                : <XCircle className="text-red-400 shrink-0" size={20} />}
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {prevSavingsAchieved ? 'Objetivo de ahorro alcanzado' : 'Objetivo de ahorro no alcanzado'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    Meta: ${fmt(prevSavingsGoal)} · Balance: {prevBalance < 0 ? '-' : ''}${fmt(prevBalance)}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Ingreso', curr: totalIncome, prev: prevIncome, higherIsBetter: true },
                            { label: 'Gasto total', curr: totalSpent, prev: prevMonthExpenses, higherIsBetter: false },
                            { label: 'Balance', curr: availableAfterSavings, prev: prevBalance, higherIsBetter: true },
                        ].map(({ label, curr, prev, higherIsBetter }) => {
                            const delta = curr - prev;
                            const isGood = higherIsBetter ? delta >= 0 : delta <= 0;
                            return (
                                <div key={label} className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                                    <p className="text-slate-400 text-[11px] mb-2 font-medium uppercase tracking-wide">{label}</p>
                                    <p className="text-base font-bold text-white tabular-nums">
                                        {curr < 0 ? '-' : ''}${fmt(curr)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">Ant: ${fmt(prev)}</p>
                                    {delta !== 0 && (
                                        <p className={`text-[11px] font-bold mt-1 tabular-nums ${isGood ? 'text-primary' : 'text-red-400'}`}>
                                            {delta > 0 ? '+' : '-'}${fmt(delta)}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* === PROYECCIÓN ANUAL === */}
            {totalIncome > 0 && (
                <div className="bg-primary/5 border border-primary/10 rounded-2xl shadow-xl overflow-hidden">
                    <button
                        onClick={() => setShowAnnual(p => !p)}
                        className="w-full p-6 flex items-center justify-between text-left"
                    >
                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                            <TrendingUp className="text-primary" size={20} />
                            Proyección Anual
                        </h3>
                        {showAnnual ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    {showAnnual && (
                        <div className="px-6 pb-6 space-y-3 border-t border-white/5 pt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">Ingreso anual</p>
                                    <p className="text-base font-bold text-primary tabular-nums">${fmt(annualIncome)}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">${fmt(totalIncome)}/mes × 12</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">Suscripciones</p>
                                    <p className="text-base font-bold text-cyan-400 tabular-nums">${fmt(annualFixed)}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Costo real anual</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">Gasto variable</p>
                                    <p className="text-base font-bold text-white tabular-nums">${fmt(annualVariable)}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Ritmo actual × 365 días</p>
                                </div>
                                {annualSavingsGoal > 0 && (
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">Ahorro anual</p>
                                        <p className="text-base font-bold text-purple-400 tabular-nums">${fmt(annualSavingsGoal)}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">${fmt(savingsGoalNum)}/mes × 12</p>
                                    </div>
                                )}
                            </div>
                            <div className={`p-4 rounded-xl border ${annualBalance >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-slate-300 text-sm font-semibold">Balance anual estimado</p>
                                    <p className={`text-xl font-bold tabular-nums ${annualBalance >= 0 ? 'text-primary' : 'text-red-400'}`}>
                                        {annualBalance < 0 ? '-' : ''}${fmt(annualBalance)}
                                    </p>
                                </div>
                                {daysElapsed === 0 && (
                                    <p className="text-xs text-slate-500 mt-1">Registrá gastos para calcular el variable proyectado</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === BOTÓN GUARDAR (sticky) === */}
            {isDirty && (
                <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-30 pointer-events-none">
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="pointer-events-auto bg-primary hover:bg-primary/90 text-[#131f18] px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-primary/40 flex items-center gap-2 transition-all disabled:opacity-50 animate-in slide-in-from-bottom-2 duration-300"
                    >
                        {isSaving ? 'Guardando...' : <><Save size={18} />Guardar Presupuesto</>}
                    </button>
                </div>
            )}
        </div>
    );
};

export default BudgetTab;
