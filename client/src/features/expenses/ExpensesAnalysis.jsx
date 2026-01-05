import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, Calendar, AlertCircle, Users, ArrowUpRight } from 'lucide-react';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const SHARED_COLORS = ['#3f46e4', '#06b6d4']; // Personal (Indigo), Shared (Cyan)

const ExpensesAnalysis = ({ expenses, dolarRate }) => {

    const {
        categoryData,
        dailyData,
        monthlyData,
        sharedVsPersonalData,
        topExpenses,
        totalSpent,
        topCategory,
        dailyAverage
    } = useMemo(() => {
        if (!expenses || expenses.length === 0) {
            return { categoryData: [], dailyData: [], monthlyData: [], sharedVsPersonalData: [], topExpenses: [], totalSpent: 0, topCategory: null, dailyAverage: 0 };
        }

        const catMap = {};
        const dayMap = {};
        const monthMap = {};
        let personalTotal = 0;
        let sharedTotal = 0;
        let total = 0;

        // Process Expenses
        const processedExpenses = expenses.map(expense => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            const finalAmount = expense.is_shared ? amountInARS / 2 : amountInARS; // Costo real para el usuario

            // Totals
            total += finalAmount;
            if (expense.is_shared) {
                sharedTotal += finalAmount;
            } else {
                personalTotal += finalAmount;
            }

            // Category Aggregation
            const cat = expense.category || 'General';
            catMap[cat] = (catMap[cat] || 0) + finalAmount;

            // Daily Aggregation (Last 7 Days Focus usually, but we map all for average)
            const dateObj = new Date(expense.created_at);
            const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            dayMap[dateStr] = (dayMap[dateStr] || 0) + finalAmount;

            // Monthly Aggregation
            const monthStr = dateObj.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }); // E.g., "ene. 2026"
            // Use Sortable Key YYYY-MM
            const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

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
        // Sort dates correctly? dateStr is DD/MM, distinct.
        // Let's filter distinct dates from expenses to sort them chronologically
        const uniqueDates = [...new Set(expenses.map(e => new Date(e.created_at).setHours(0, 0, 0, 0)))].sort((a, b) => a - b);
        const last7Days = uniqueDates.slice(-7);

        const dailyData = last7Days.map(time => {
            const d = new Date(time);
            const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            return {
                date: dateStr,
                amount: dayMap[dateStr] || 0
            };
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

        // 5. Top 5 Expenses
        const topExpenses = [...processedExpenses]
            .sort((a, b) => b.finalAmount - a.finalAmount)
            .slice(0, 5);

        // 6. Metrics
        const topCategory = categoryData.length > 0 ? categoryData[0] : null;

        // Daily Average (Total / Days Range or Distinct Days?)
        // Let's use Span of Days (First expense to Last expense)
        const sortedExpenses = [...expenses].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let daysSpan = 1;
        if (sortedExpenses.length > 1) {
            const first = new Date(sortedExpenses[0].created_at);
            const last = new Date(sortedExpenses[sortedExpenses.length - 1].created_at);
            const diffTime = Math.abs(last - first);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysSpan = diffDays || 1;
        }
        const dailyAverage = total / daysSpan;

        return {
            categoryData,
            dailyData,
            monthlyData,
            sharedVsPersonalData,
            topExpenses,
            totalSpent: total,
            topCategory,
            dailyAverage
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
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl">
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

            {/* KPI Cards */}
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
                            <p className="text-slate-500 text-sm font-medium">Categoría Top</p>
                            <h3 className="text-xl font-bold text-slate-200 truncate max-w-[120px]">
                                {topCategory ? topCategory.name : '-'}
                            </h3>
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
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Compartido</p>
                            <h3 className="text-xl font-bold text-slate-200">
                                {sharedVsPersonalData[1]?.value > 0
                                    ? `${Math.round((sharedVsPersonalData[1].value / totalSpent) * 100)}%`
                                    : '0%'}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Categorías (Pie Chart) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Distribución por Categorías</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-slate-400 text-sm ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Evolución Mensual (Bar Chart) - Replaces/Compliments Daily */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Evolución Mensual</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value / 1000}k`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Shared vs Personal (Donut Chart) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Personal vs. Compartido</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sharedVsPersonalData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {sharedVsPersonalData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={SHARED_COLORS[index]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-slate-400 text-sm ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Top 5 Gastos (List) */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                        <ArrowUpRight size={20} className="text-red-400" />
                        Mayores Gastos del Periodo
                    </h3>
                    <div className="space-y-4">
                        {topExpenses.map((expense, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="text-slate-500 font-mono text-sm">#{index + 1}</div>
                                    <div>
                                        <div className="font-medium text-slate-200">{expense.description}</div>
                                        <div className="text-xs text-slate-500">{new Date(expense.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-200">${expense.finalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                    <div className="text-xs text-slate-500">{expense.category || 'General'}</div>
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
