import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

const ExpensesAnalysis = ({ expenses, dolarRate }) => {

    const { categoryData, dailyData, totalSpent, topCategory } = useMemo(() => {
        if (!expenses || expenses.length === 0) {
            return { categoryData: [], dailyData: [], totalSpent: 0, topCategory: null };
        }

        const catMap = {};
        const dayMap = {};
        let total = 0;

        expenses.forEach(expense => {
            const amountInARS = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
            // Only count personal share if shared? Or full? 
            // Usually analysis wants to know "How much I spent".
            // If check logic in Expenses.jsx:
            // const personalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;
            const finalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;

            total += finalAmount;

            // Category Aggregation
            const cat = expense.category || 'General';
            catMap[cat] = (catMap[cat] || 0) + finalAmount;

            // Daily Aggregation
            const date = new Date(expense.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            dayMap[date] = (dayMap[date] || 0) + finalAmount;
        });

        // Format for Pie Chart
        const categoryData = Object.keys(catMap).map(name => ({
            name,
            value: catMap[name]
        })).sort((a, b) => b.value - a.value);

        // Format for Bar Chart (Sort by date?)
        // Simple sort by string DD/MM usually works if same year, but safer to rely on timestamp if available.
        // For now, let's just accept the object keys order or sort them.
        const dailyData = Object.keys(dayMap).map(date => ({
            date,
            amount: dayMap[date]
        })).reverse().slice(0, 7).reverse(); // Last 7 days present

        const topCategory = categoryData.length > 0 ? categoryData[0] : null;

        return { categoryData, dailyData, totalSpent: total, topCategory };
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

    // Custom Tooltip for Recharts
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
                            <h3 className="text-2xl font-bold text-slate-200">
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
                            <p className="text-slate-500 text-sm font-medium">Categoría Principal</p>
                            <h3 className="text-2xl font-bold text-slate-200">
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
                            <p className="text-slate-500 text-sm font-medium">Días Registrados</p>
                            <h3 className="text-2xl font-bold text-slate-200">
                                {Object.keys(dailyData).length}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Pie Chart - Categories */}
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

                {/* Bar Chart - Daily Trend */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6">Gastos Últimos 7 Días</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="date"
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
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {dailyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ExpensesAnalysis;
