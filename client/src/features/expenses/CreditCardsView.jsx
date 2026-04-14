import React, { useState, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import { CreditCard, ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

function CreditCardsView({ onBack }) {
    const { creditCards, expenses, dailyExpenses, deleteCreditCard } = useExpenses();
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use available expenses (from current planilla or daily view)
    const allAvailableExpenses = expenses.length > 0 ? expenses : dailyExpenses;

    // Filter expenses by selected card
    const cardExpenses = useMemo(() => {
        if (!selectedCardId) return [];
        return allAvailableExpenses.filter(exp => exp.credit_card_id === selectedCardId);
    }, [selectedCardId, allAvailableExpenses]);

    // Get selected card details
    const selectedCard = creditCards.find(c => c.id === selectedCardId);

    // Calculate card total
    const cardTotal = useMemo(() => {
        return cardExpenses.reduce((sum, exp) => {
            const amount = parseFloat(exp.amount) || 0;
            return sum + amount;
        }, 0);
    }, [cardExpenses]);

    const handleDeleteCard = async (cardId) => {
        if (window.confirm('¿Eliminar esta tarjeta? Los gastos asociados no se borrarán.')) {
            setIsDeleting(true);
            try {
                await deleteCreditCard(cardId);
                toast.success('Tarjeta eliminada');
                if (selectedCardId === cardId) setSelectedCardId(null);
            } catch (err) {
                toast.error('Error al eliminar: ' + err.message);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="flex-1" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
            {/* Header */}
            <header className="sticky top-0 z-20 bg-[#131f18]/80 backdrop-blur-xl px-5 pb-4 pt-safe border-b border-white/5">
                <div className="flex items-center gap-4 mt-3">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full glass-panel flex items-center justify-center active-scale hover:bg-white/10"
                    >
                        <ChevronLeft size={20} className="text-slate-300" />
                    </button>
                    <h1 className="text-[2rem] font-extrabold text-white tracking-tight">
                        {selectedCardId ? 'Gastos por Tarjeta' : 'Tarjetas de Crédito'}
                    </h1>
                </div>
            </header>

            <div className="px-4 pt-3">
                {/* Cards List or Expense Details */}
                {!selectedCardId ? (
                    // CARDS LIST
                    <div className="space-y-3 pb-6">
                        {creditCards.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-primary/10 rounded-xl">
                                <CreditCard size={40} className="mx-auto text-primary/30 mb-3" />
                                <h3 className="font-semibold text-slate-300 mb-1">Sin tarjetas registradas</h3>
                                <p className="text-sm text-slate-500">Agrega una tarjeta en Finanzas</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mt-4">
                                    Total: {creditCards.length} Tarjetas
                                </p>
                                {creditCards.map((card) => {
                                    const cardExpenseCount = allAvailableExpenses.filter(e => e.credit_card_id === card.id).length;
                                    const cardTotal = allAvailableExpenses
                                        .filter(e => e.credit_card_id === card.id)
                                        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                                    return (
                                        <button
                                            key={card.id}
                                            onClick={() => setSelectedCardId(card.id)}
                                            className="w-full text-left p-4 rounded-[16px] glass-panel border-white/5 active-scale hover:bg-white/5 transition-all"
                                            style={{
                                                borderLeft: `4px solid ${card.color}`,
                                                background: `linear-gradient(135deg, rgba(46,204,112,0.05) 0%, rgba(46,204,112,0.02) 100%)`
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                        style={{ background: `${card.color}20` }}
                                                    >
                                                        <CreditCard size={18} style={{ color: card.color }} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-100">{card.name}</h3>
                                                        <p className="text-xs text-slate-500">
                                                            {card.last_digits && `•••• ${card.last_digits}`}
                                                            {card.bank && ` • ${card.bank}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCard(card.id);
                                                    }}
                                                    disabled={isDeleting}
                                                    className="text-slate-600 hover:text-red-400 p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">
                                                    {cardExpenseCount} gasto{cardExpenseCount !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-primary font-bold">
                                                    ARS ${cardTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                ) : (
                    // EXPENSES FOR SELECTED CARD
                    <div className="space-y-3 pb-6">
                        {/* Card Header */}
                        <div className="p-4 rounded-[16px] border" style={{ borderColor: `${selectedCard.color}30` }}>
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                                    style={{ background: `${selectedCard.color}20` }}
                                >
                                    <CreditCard size={24} style={{ color: selectedCard.color }} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-100">{selectedCard.name}</h2>
                                    <p className="text-xs text-slate-500">
                                        {selectedCard.last_digits && `•••• ${selectedCard.last_digits}`}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 mb-1">Total</p>
                                <p className="text-2xl font-bold text-primary">
                                    ARS ${cardTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Expenses List */}
                        {cardExpenses.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-primary/10 rounded-xl">
                                <CreditCard size={40} className="mx-auto text-primary/30 mb-3" />
                                <h3 className="font-semibold text-slate-300 mb-1">Sin gastos</h3>
                                <p className="text-sm text-slate-500">Esta tarjeta no tiene gastos registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                                    {cardExpenses.length} Gasto{cardExpenses.length !== 1 ? 's' : ''}
                                </p>
                                {cardExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className="p-3 rounded-[12px] glass-panel border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-slate-100 truncate">
                                                {expense.description}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase">
                                                    {expense.category}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {new Date(expense.created_at).toLocaleDateString('es-AR')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-3 shrink-0">
                                            <p className="text-sm font-bold text-slate-100">
                                                {expense.currency} ${parseFloat(expense.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                            {expense.is_paid && (
                                                <span className="text-[10px] text-emerald-400">✓ Pagado</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CreditCardsView;
