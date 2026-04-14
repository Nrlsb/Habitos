import React, { useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { RefreshCcw, Zap } from 'lucide-react';

const SUBSCRIPTION_CATEGORIES = [
    { value: 'Entretenimiento', emoji: '🎬' },
    { value: 'Música', emoji: '🎵' },
    { value: 'Trabajo', emoji: '💼' },
    { value: 'Salud', emoji: '🏥' },
    { value: 'Educación', emoji: '📚' },
    { value: 'Nube / Software', emoji: '☁️' },
    { value: 'Juegos', emoji: '🎮' },
    { value: 'General', emoji: '📦' },
];

const monthlyEquivalent = (sub) => {
    const amt = parseFloat(sub.amount) || 0;
    if (sub.frequency === 'annual') return amt / 12;
    if (sub.frequency === 'quarterly') return amt / 3;
    return amt;
};

const getCategoryEmoji = (catName) => {
    const found = SUBSCRIPTION_CATEGORIES.find(c => c.value === catName);
    return found ? found.emoji : '📦';
};

const fmt = (n) => (isNaN(n) ? '0' : Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

const CombinedItems = ({ expenses = [], subscriptions = [], dolarRate, currentPlanillaId }) => {
    const safeSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(s => s.active !== false) : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    // Create unified list with type identifiers
    const combinedItems = useMemo(() => {
        const items = [];

        // Add expenses
        safeExpenses.forEach(expense => {
            items.push({
                id: `expense-${expense.id}`,
                type: 'expense',
                data: expense,
                date: new Date(expense.created_at),
                sortDate: new Date(expense.created_at).getTime()
            });
        });

        // Add subscriptions
        safeSubscriptions.forEach(sub => {
            items.push({
                id: `subscription-${sub.id}`,
                type: 'subscription',
                data: sub,
                date: new Date(),
                sortDate: new Date().getTime()
            });
        });

        // Sort by date (newest first)
        return items.sort((a, b) => b.sortDate - a.sortDate);
    }, [safeExpenses, safeSubscriptions]);

    if (combinedItems.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                <p className="text-sm">No hay gastos ni suscripciones registrados.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {combinedItems.map((item) => {
                if (item.type === 'expense') {
                    const expense = item.data;
                    const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                    const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                    return (
                        <div key={item.id} className="bg-primary/5 border border-primary/10 rounded-xl p-4 hover:bg-primary/8 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
                                    <Zap size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-semibold text-slate-200 truncate">{expense.description}</h4>
                                        <span className="text-xs font-medium text-slate-400 shrink-0">
                                            {new Date(expense.created_at).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded-lg">{expense.category}</span>
                                        {expense.is_shared && (
                                            <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-lg border border-cyan-500/20">
                                                Compartido
                                            </span>
                                        )}
                                        {expense.is_installment && (
                                            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg border border-indigo-500/20">
                                                {expense.current_installment}/{expense.total_installments}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-slate-200 tabular-nums">
                                        ${montoPersonalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{expense.currency}</p>
                                </div>
                            </div>
                        </div>
                    );
                } else if (item.type === 'subscription') {
                    const sub = item.data;
                    const monthlyAmt = monthlyEquivalent(sub);
                    const freqLabel = {
                        'monthly': 'Mensual',
                        'quarterly': 'Trimestral',
                        'annual': 'Anual'
                    }[sub.frequency] || 'Mensual';

                    return (
                        <div key={item.id} className="bg-emerald-900/15 border border-emerald-500/20 rounded-xl p-4 hover:bg-emerald-900/20 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg shrink-0">
                                    <RefreshCcw size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-semibold text-slate-200 truncate">{sub.name}</h4>
                                        <span className="text-xs font-medium text-slate-400 shrink-0">{freqLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded-lg">
                                            {getCategoryEmoji(sub.category_name || 'General')} {sub.category_name || 'General'}
                                        </span>
                                        {sub.billing_date && (
                                            <span className="text-xs text-slate-500">Día {sub.billing_date}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-slate-200 tabular-nums">
                                        {sub.currency === 'USD' ? 'US$' : '$'}{parseFloat(sub.amount).toLocaleString('es-AR')}
                                    </p>
                                    {sub.frequency !== 'monthly' && (
                                        <p className="text-xs text-slate-500 mt-0.5">≈ ${fmt(monthlyAmt)}/mes</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    );
};

export default CombinedItems;
