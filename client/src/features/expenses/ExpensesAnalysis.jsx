
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Wallet, TrendingUp, Calendar, AlertCircle, ArrowUpRight, CreditCard } from 'lucide-react';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const SHARED_COLORS = ['#3f46e4', '#06b6d4']; // Personal (Indigo), Shared (Cyan)
const INSTALLMENT_COLORS = ['#f59e0b', '#10b981']; // Installments (Amber), Current (Emerald)
const CURRENCY_COLORS = ['#6366f1', '#22c55e']; // ARS (Indigo), USD (Green)

const ExpensesAnalysis = ({ expenses, dolarRate }) => {

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
        expenses.forEach(expense => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            const finalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;

            if (expense.is_installment) {
                const current = expense.current_installment || 0;
                const totalInst = expense.total_installments || 1;
                const remaining = totalInst - current;

                if (remaining > 0) {
                    activeInstallmentSum += finalAmount;

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
                variableTotal += finalAmount;
            }
        });

        // 2. Calculate Base Variable Projection (The "Standard of Living" cost)
        const dailyAverageVariable = variableTotal / daysSpan;
        const projectedVariable = dailyAverageVariable * 30;
        const projectedMonthly = projectedVariable + activeInstallmentSum;
        const dailyAverage = total / daysSpan;

        // 3. Second Pass: Add Variable Base to Future Months & Fill Gaps
        // Determine how far we want to show. At least 6 months, or up to max installment.
        // If map is empty (no installments), create 6 months of just variable.
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
            month.amount += projectedVariable;
        });

        // Convert Map to Sorted Array
        const futureProjections = Object.values(futureInstallmentsMap)
            .sort((a, b) => a.sortDate - b.sortDate)
            // Optional: Filter out months waaaay in the future if we didn't cap it? 
            // We capped generation at 6, but installments might go further. That's fine.
            ;


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
            daysSpan // Export for usage in UI info text
        };
    }, [expenses, dolarRate]);

    if (!expenses || expenses.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                <AlertCircle className="mx-auto text-slate-500 mb-4" size={48} />
                <h3 className="text-xl font-medium text-slate-300">No hay datos suficientes</h3>
                <p className="text-slate-500">Añade gastos para ver el análisis.</p>
            </div>
        );
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
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                        <Calendar size={20} className="text-amber-500" />
                        Proyección de Gastos Futuros
                    </h3>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {futureProjections.map((item, index) => (
                            <div key={index} className="flex-shrink-0 bg-slate-900 border border-slate-700 rounded-xl p-4 w-48 text-center shadow-md hover:border-amber-500/50 transition-colors">
                                <div className="bg-slate-800 text-slate-300 text-xs font-bold py-1 px-3 rounded-full mb-3 inline-block capitalize">
                                    {item.label}
                                </div>
                                <div className="text-xl font-bold text-slate-200">
                                    ${item.amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5">
                                    <span>Base Variable + Cuotas</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
