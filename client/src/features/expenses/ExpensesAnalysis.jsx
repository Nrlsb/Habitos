
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Wallet, TrendingUp, Calendar, AlertCircle, ArrowUpRight, CreditCard, Users, ArrowRightLeft, CheckCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const SHARED_COLORS = ['#3f46e4', '#06b6d4']; // Personal (Indigo), Shared (Cyan)
const INSTALLMENT_COLORS = ['#f59e0b', '#10b981']; // Installments (Amber), Current (Emerald)
const CURRENCY_COLORS = ['#6366f1', '#22c55e']; // ARS (Indigo), USD (Green)

const ExpensesAnalysis = ({ expenses, dolarRate, onSettleDebt }) => {
    const [showProjection, setShowProjection] = useState(true);
    const [payerA, setPayerA] = useState('');
    const [payerB, setPayerB] = useState('');

    const {
        categoryData,
        dailyData,
        monthlyData,
        sharedVsPersonalData,
        installmentVsCurrentData,
        dayOfWeekData,
        currencyData,
        topExpenses,
        totalSpent,
        topCategory,
        dailyAverage,
        projectedTotal,
        futureProjections,
        activeInstallmentSum,
        daysSpan
    } = useMemo(() => {
        if (!expenses || expenses.length === 0) {
            return { categoryData: [], dailyData: [], monthlyData: [], sharedVsPersonalData: [], installmentVsCurrentData: [], dayOfWeekData: [], currencyData: [], topExpenses: [], totalSpent: 0, topCategory: null, dailyAverage: 0, projectedTotal: 0 };
        }

        const catMap = {};
        const dayMap = {};
        const monthMap = {};
        const dayOfWeekMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Sun-Sat
        const currencyMap = { ARS: 0, USD: 0 };

        let personalTotal = 0;
        let sharedTotal = 0;
        let installmentTotal = 0;
        let currentTotal = 0;
        let total = 0;

        // Process Expenses
        const processedExpenses = expenses.map(expense => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            const finalAmount = expense.is_shared ? amountInARS / 2 : amountInARS; // Costo real para el usuario

            // Totals
            total += finalAmount;
            if (expense.is_shared) sharedTotal += finalAmount;
            else personalTotal += finalAmount;

            if (expense.is_installment) installmentTotal += finalAmount;
            else currentTotal += finalAmount;

            if (expense.currency === 'USD') currencyMap.USD += finalAmount;
            else currencyMap.ARS += finalAmount;

            // Category Aggregation
            const cat = expense.category || 'General';
            catMap[cat] = (catMap[cat] || 0) + finalAmount;

            // Daily Aggregation (Last 7 Days Focus)
            const dateObj = new Date(expense.created_at);
            const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            dayMap[dateStr] = (dayMap[dateStr] || 0) + finalAmount;

            // Day of Week Aggregation
            const dayOfWeek = dateObj.getDay();
            dayOfWeekMap[dayOfWeek] += finalAmount;

            // Monthly Aggregation
            const monthStr = dateObj.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
            const monthKey = `${dateObj.getFullYear()} -${String(dateObj.getMonth() + 1).padStart(2, '0')} `;

            if (!monthMap[monthKey]) {
                monthMap[monthKey] = { name: monthStr, value: 0 };
            }
            monthMap[monthKey].value += finalAmount;

            return { ...expense, finalAmount, dateObj };
        });

        // 1. Category Data for Pie
        const categoryData = Object.keys(catMap).map(name => ({
            name,
            value: catMap[name]
        })).sort((a, b) => b.value - a.value);

        // 2. Daily Trend (Last 7 Days)
        const uniqueDates = [...new Set(expenses.map(e => new Date(e.created_at).setHours(0, 0, 0, 0)))].sort((a, b) => a - b);
        const last7Days = uniqueDates.slice(-7);
        const dailyData = last7Days.map(time => {
            const d = new Date(time);
            const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            return { date: dateStr, amount: dayMap[dateStr] || 0 };
        });

        // 3. Monthly Evolution
        const monthlyData = Object.keys(monthMap).sort().map(key => ({
            name: monthMap[key].name,
            amount: monthMap[key].value
        }));

        // 4. Shared vs Personal
        const sharedVsPersonalData = [
            { name: 'Personal', value: personalTotal },
            { name: 'Compartido', value: sharedTotal }
        ];

        // 5. Installment vs Current
        const installmentVsCurrentData = [
            { name: 'Cuotas', value: installmentTotal },
            { name: 'Al Día', value: currentTotal }
        ];

        // 6. Day of Week
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dayOfWeekData = Object.keys(dayOfWeekMap).map(key => ({
            subject: days[key],
            A: dayOfWeekMap[key],
            fullMark: Math.max(...Object.values(dayOfWeekMap)) * 1.1 // Scaling
        }));

        // 7. Currency Breakdown
        const currencyData = [
            { name: 'ARS', value: currencyMap.ARS },
            { name: 'USD', value: currencyMap.USD }
        ];

        // 8. Top 5 Expenses
        const topExpenses = [...processedExpenses]
            .sort((a, b) => b.finalAmount - a.finalAmount)
            .slice(0, 5);


        // Metrics
        const topCategory = categoryData.length > 0 ? categoryData[0] : null;

        // Daily Average & Projection Logic
        const sortedExpenses = [...expenses].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let daysSpan = 1;

        // Calculate Days Span
        if (sortedExpenses.length > 1) {
            const first = new Date(sortedExpenses[0].created_at);
            const last = new Date(sortedExpenses[sortedExpenses.length - 1].created_at);
            const diffTime = Math.abs(last - first);
            daysSpan = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        }


        // Smart Projection & Future Installments Logic
        let variableTotal = 0;
        let activeInstallmentSum = 0;
        const futureInstallmentsMap = {}; // Key: "Year-Month", Value: { label, amount, sortDate }

        const today = new Date();
        const currentMonthIndex = today.getMonth(); // 0-11
        const currentYear = today.getFullYear();

        // 1. First Pass: Separate totals and identify installment timelines
        // NOTE: We now calculate variableTotal based ONLY on the CURRENT MONTH to avoid unrealistic daily averages.
        expenses.forEach(expense => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            const finalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;
            const expenseDate = new Date(expense.created_at);

            if (expense.is_installment) {
                const current = expense.current_installment || 0;
                const totalInst = expense.total_installments || 1;
                const remaining = totalInst - current;

                // Only count as "Active Installment Sum" if it applies to NEXT month? 
                // Or if it's currently active in the current month? 
                // User said "Gasto Total Actual" which usually includes current installments.
                // So yes, sum it up.
                if (remaining > 0 || (current < totalInst)) {
                    activeInstallmentSum += finalAmount;
                }

                if (remaining > 0) {
                    // Accumulate installment cost for relevant future months
                    for (let i = 1; i <= remaining; i++) {
                        const targetDate = new Date(currentYear, currentMonthIndex + i, 1);
                        const monthKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}`;
                        const displayLabel = targetDate.toLocaleDateString('es-AR', { month: 'long', year: '2-digit' });

                        // We strictly sum installment costs here first
                        if (!futureInstallmentsMap[monthKey]) {
                            futureInstallmentsMap[monthKey] = { label: displayLabel, amount: 0, sortDate: targetDate };
                        }
                        futureInstallmentsMap[monthKey].amount += finalAmount;
                    }
                }
            } else {
                // Only add to variableTotal if it belongs to the CURRENT MONTH and YEAR
                if (expenseDate.getMonth() === currentMonthIndex && expenseDate.getFullYear() === currentYear) {
                    variableTotal += finalAmount;
                }
            }
        });

        // 2. Calculate Base Variable Projection (The "Standard of Living" cost)
        // OLD: const dailyAverageVariable = variableTotal / daysSpan;
        // OLD: const projectedVariable = dailyAverageVariable * 30;

        // NEW: We assume the user wants to see their CURRENT MONTH's variable spend projected forward.
        // If they just started using the app today, this might be low, but it's "Actual".
        const projectedVariable = variableTotal;

        const projectedMonthly = projectedVariable + activeInstallmentSum;
        const dailyAverage = total / daysSpan;

        // 3. Second Pass: Add Variable Base to Future Months & Fill Gaps
        // Determine how far we want to show. At least 6 months.
        const maxMonths = 6;
        const existingKeys = Object.keys(futureInstallmentsMap);

        // Ensure we have at least 'maxMonths' entries generated
        for (let i = 1; i <= maxMonths; i++) {
            const targetDate = new Date(currentYear, currentMonthIndex + i, 1);
            const monthKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}`;
            const displayLabel = targetDate.toLocaleDateString('es-AR', { month: 'long', year: '2-digit' });

            if (!futureInstallmentsMap[monthKey]) {
                futureInstallmentsMap[monthKey] = { label: displayLabel, amount: 0, sortDate: targetDate };
            }
        }

        // Add the Variable Base to ALL future months in the map
        Object.values(futureInstallmentsMap).forEach(month => {
            month.installmentOnly = month.amount; // Guardamos el valor limpio de solo cuotas
            month.amount += projectedVariable; // El valor default incluye la proyección
        });

        // Convert Map to Sorted Array
        const futureProjections = Object.values(futureInstallmentsMap)
            .sort((a, b) => a.sortDate - b.sortDate)
            // Optional: Filter out months waaaay in the future if we didn't cap it? 
            // We capped generation at 6, but installments might go further. That's fine.
            ;

        // Debt Calculator Logic
        const payers = [...new Set(expenses.filter(e => e.is_shared && e.payer_name).map(e => e.payer_name))].sort();

        // Ensure default selection if specific payers exist and likely just 2 people
        // (can be handled in useEffect but useMemo derived is safer for read-only)

        return {
            categoryData,
            dailyData,
            monthlyData,
            sharedVsPersonalData,
            installmentVsCurrentData,
            dayOfWeekData,
            currencyData,
            topExpenses,
            totalSpent: total,
            topCategory,
            dailyAverage,
            projectedTotal: projectedMonthly, // Current Month Projection
            activeInstallmentSum,
            futureProjections, // List for "Proyecciones Futuras"
            daysSpan, // Export for usage in UI info text
            payers
        };
    }, [expenses, dolarRate]);

    const debtCalculation = useMemo(() => {
        if (!payerA || !payerB || payerA === payerB) return null;

        let paidA = 0;
        let paidB = 0;
        let totalSharedBetween = 0;

        expenses.forEach(e => {
            if (!e.is_shared) return;

            // Normalize amounts to ARS for calculation
            const amount = e.currency === 'USD' && dolarRate ? e.amount * dolarRate : e.amount;

            if (e.payer_name === payerA) {
                paidA += amount;
                totalSharedBetween += amount;
            } else if (e.payer_name === payerB) {
                paidB += amount;
                totalSharedBetween += amount;
            }
        });

        const fairShare = totalSharedBetween / 2;
        const diff = paidA - paidB;
        // If diff > 0, A paid more, so B owes A.
        // Amount owed = (PaidA - PaidB) / 2  OR  PaidA - FairShare
        const amountOwed = Math.abs(diff) / 2;

        const debtor = diff > 0 ? payerB : payerA;
        const creditor = diff > 0 ? payerA : payerB;

        return {
            paidA,
            paidB,
            totalShared: totalSharedBetween,
            fairShare,
            amountOwed,
            debtor,
            creditor,
            isEven: Math.abs(diff) < 1 // tolerance
        };

    }, [expenses, dolarRate, payerA, payerB]);

    if (!expenses || expenses.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                <AlertCircle className="mx-auto text-slate-500 mb-4" size={48} />
                <h3 className="text-xl font-medium text-slate-300">No hay datos suficientes</h3>
                <p className="text-slate-500">Añade gastos para ver el análisis.</p>
            </div>
        );
    }

    // Auto-select payers if only 2 distinct ones exist and haven't selected yet
    // This is a bit side-effecty for render but convenient
    if (activeInstallmentSum && !payerA && !payerB) {
        // Placeholder logic if we wanted auto-selection, but controlled inputs are safer.
        // Let's rely on user selection.
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl z-50">
                    <p className="text-slate-300 font-medium mb-1">{label || payload[0].name}</p>
                    <p className="text-indigo-400 font-bold">
                        ${payload[0].value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

            {/* KPI Cards Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
                            <h3 className="text-xl font-bold text-slate-200">
                                ${totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Proyección Mensual</p>
                            <h3 className="text-xl font-bold text-slate-200">
                                ${projectedTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </h3>
                            <div className="flex flex-col">
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Base Var. (30d): <span className="text-slate-400">${(projectedTotal - activeInstallmentSum).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                </p>
                                <p className="text-[10px] text-slate-500">
                                    + Cuotas Activas: <span className="text-amber-500">${activeInstallmentSum.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Promedio Diario</p>
                            <h3 className="text-xl font-bold text-slate-200">
                                ${dailyAverage.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-1">Calculado sobre {daysSpan} días</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Cuotas vs. Al día</p>
                            <h3 className="text-xl font-bold text-slate-200">
                                {installmentVsCurrentData[0]?.value > 0
                                    ? `${Math.round((installmentVsCurrentData[0].value / totalSpent) * 100)}% `
                                    : '0%'}
                                <span className="text-xs text-slate-500 font-normal ml-1">en cuotas</span>
                            </h3>
                        </div>
                    </div>
                </div>

            </div>


            {/* Proyección de Gastos Futuros (Base Variable + Cuotas) */}
            {futureProjections && futureProjections.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <Calendar size={20} className="text-amber-500" />
                            Proyección de Gastos Futuros
                        </h3>

                        {/* Toggle Switch */}
                        <div className="flex items-center bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                            <button
                                onClick={() => setShowProjection(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showProjection
                                    ? 'bg-indigo-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Proyección Total
                            </button>
                            <button
                                onClick={() => setShowProjection(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showProjection
                                    ? 'bg-indigo-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Solo Cuotas
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {futureProjections.map((item, index) => {
                            const displayAmount = showProjection ? item.amount : item.installmentOnly;
                            const isZero = displayAmount === 0;

                            // Si estamos en modo "Solo Cuotas" y es 0, quizás queramos mostrarlo diferente o visualmente indicar que no hay cuotas
                            // Pero para mantener consistencia visual dejaremos el card.

                            return (
                                <div key={index} className="flex-shrink-0 bg-slate-900 border border-slate-700 rounded-xl p-4 w-48 text-center shadow-md hover:border-amber-500/50 transition-colors">
                                    <div className={`text-xs font-bold py-1 px-3 rounded-full mb-3 inline-block capitalize ${index === 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-300'
                                        }`}>
                                        {item.label}
                                    </div>
                                    <div className={`text-xl font-bold ${isZero ? 'text-slate-600' : 'text-slate-200'}`}>
                                        ${displayAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5">
                                        <span>{showProjection ? 'Base Variable + Cuotas' : 'Solo Cuotas Activas'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* DEBT CALCULATOR */}
            <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Users size={20} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Calculadora de Divisiones</h3>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Controls */}
                    <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5 ml-1">Persona A</label>
                                <select
                                    value={payerA}
                                    onChange={(e) => setPayerA(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">Seleccionar...</option>
                                    {/** Access 'payers' from useMemo logic? We didn't destructure it outside. Let's fix that context logic or duplicate simple extraction. 
                                         Ideally we return 'payers' from the big useMemo. I added it in the ReplacementChunk above. 
                                         So we need to destructure it here. */}
                                    {/* Wait, I cannot change the destructuring line 30 easily without re-writing the whole block. 
                                        Actually, I can just recalculate it simply here, it's cheap. */}
                                    {[...new Set(expenses.filter(e => e.is_shared && e.payer_name).map(e => e.payer_name))].sort().map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5 ml-1">Persona B</label>
                                <select
                                    value={payerB}
                                    onChange={(e) => setPayerB(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">Seleccionar...</option>
                                    {[...new Set(expenses.filter(e => e.is_shared && e.payer_name).map(e => e.payer_name))].sort().map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {(!payerA || !payerB) && (
                            <div className="text-center p-4 bg-slate-900/30 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm">
                                Selecciona dos personas para calcular balances.
                            </div>
                        )}

                        {(payerA && payerB && payerA === payerB) && (
                            <div className="text-center p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 text-sm">
                                Selecciona dos personas distintas.
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    {debtCalculation && (
                        <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700/50 p-4">
                            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-700/50">
                                <div>
                                    <span className="text-slate-500 text-xs uppercase block mb-1">Pagó {payerA}</span>
                                    <span className="text-slate-200 font-bold">${debtCalculation.paidA.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 text-xs uppercase block mb-1">Pagó {payerB}</span>
                                    <span className="text-slate-200 font-bold">${debtCalculation.paidB.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="text-center">
                                {debtCalculation.isEven ? (
                                    <div className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                                        <CheckCircle size={20} />
                                        <span>¡Están a mano!</span>
                                    </div>
                                ) : (
                                    <div className="animate-in zoom-in duration-300">
                                        <span className="text-slate-500 text-sm mb-1 block">Balance</span>
                                        <div className="flex items-center justify-center gap-3 text-lg">
                                            <span className="font-bold text-indigo-300">{debtCalculation.debtor}</span>
                                            <span className="text-slate-500 text-sm">le debe a</span>
                                            <span className="font-bold text-indigo-300">{debtCalculation.creditor}</span>
                                        </div>
                                        <div className="text-3xl font-bold text-white mt-2 flex items-center justify-center gap-2">
                                            <ArrowRightLeft className="text-indigo-500" size={24} />
                                            ${debtCalculation.amountOwed.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                        {onSettleDebt && (
                                            <button
                                                onClick={() => {
                                                    // Find expenses shared between these two
                                                    const expensesToSettle = expenses.filter(e =>
                                                        e.is_shared &&
                                                        (e.payer_name === payerA || e.payer_name === payerB)
                                                    );
                                                    const newPayerName = `${payerA} & ${payerB}`;
                                                    onSettleDebt(expensesToSettle, newPayerName);
                                                }}
                                                className="mt-4 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/30 transition-colors flex items-center gap-2 mx-auto"
                                            >
                                                <CheckCircle size={16} />
                                                Saldar Deuda (Cambiar a "{payerA} & {payerB}")
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Categorías (Pie) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Distribución por Categorías</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                    {categoryData.map((entry, index) => <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-slate-400 text-sm ml-1">{value}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Monthly Evolution (Bar) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Evolución Mensual</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000} k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {monthlyData.map((entry, index) => <Cell key={`cell - ${index} `} fill="#6366f1" />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Weekday Radar */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Gasto por Día de Semana</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dayOfWeekData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                <Radar name="Gasto" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Currency + Share Breakdown (Composite) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Composición</h3>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        {/* Currency */}
                        <div className="flex flex-col items-center justify-center">
                            <h4 className="text-sm text-slate-400 mb-2">Moneda</h4>
                            <div className="h-[120px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={currencyData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={5} dataKey="value">
                                            {currencyData.map((entry, index) => <Cell key={`cell - ${index} `} fill={CURRENCY_COLORS[index]} stroke="rgba(0,0,0,0)" />)}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex gap-4 text-xs mt-2">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>ARS</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>USD</div>
                            </div>
                        </div>

                        {/* Personal vs Shared */}
                        <div className="flex flex-col items-center justify-center border-l border-slate-700/50">
                            <h4 className="text-sm text-slate-400 mb-2">Tipo</h4>
                            <div className="h-[120px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={sharedVsPersonalData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={5} dataKey="value">
                                            {sharedVsPersonalData.map((entry, index) => <Cell key={`cell - ${index} `} fill={SHARED_COLORS[index]} stroke="rgba(0,0,0,0)" />)}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex gap-4 text-xs mt-2">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-700"></div>Pers.</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div>Comp.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Top 5 Gastos */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                        <ArrowUpRight size={20} className="text-red-400" />
                        Mayores Gastos del Periodo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topExpenses.map((expense, index) => (
                            <div key={expense.id || index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs">#{index + 1}</div>
                                    <div>
                                        <div className="font-medium text-slate-200 truncate max-w-[150px]">{expense.description}</div>
                                        <div className="text-xs text-slate-500">{new Date(expense.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-200">${expense.finalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                                        <span>{expense.category || 'General'}</span>
                                        {expense.is_installment && <span className="text-amber-500 font-medium">(Cuotas)</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ExpensesAnalysis;
