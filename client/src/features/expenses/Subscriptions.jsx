import React, { useState, useEffect } from 'react';
import { useExpenses } from './ExpensesContext';
import { Plus, Trash2, Calendar, RefreshCcw, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

const Subscriptions = ({ currentPlanillaId }) => {
    const {
        subscriptions,
        fetchSubscriptions,
        addSubscription,
        deleteSubscription,
        generateSubscriptionExpense,
        categories,
        loading
    } = useExpenses();

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newSub, setNewSub] = useState({
        name: '',
        amount: '',
        currency: 'ARS',
        category_name: 'General',
        frequency: 'monthly'
    });
    const [generatingId, setGeneratingId] = useState(null);

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    const handleAddSubscription = async (e) => {
        e.preventDefault();
        if (!newSub.name || !newSub.amount) return;

        await addSubscription({
            ...newSub,
            amount: parseFloat(newSub.amount)
        });
        setIsAddModalOpen(false);
        setNewSub({ name: '', amount: '', currency: 'ARS', category_name: 'General', frequency: 'monthly' });
    };

    const handleGenerate = async (sub) => {
        if (!currentPlanillaId) {
            alert("Selecciona una planilla primero para generar el gasto.");
            return;
        }
        setGeneratingId(sub.id);
        try {
            const today = new Date().toISOString().split('T')[0];
            await generateSubscriptionExpense(sub.id, today, currentPlanillaId);
            // Optional: Success feedback could be added here
        } catch (error) {
            console.error(error);
            alert("Error generando el gasto. Intenta nuevamente.");
        } finally {
            setGeneratingId(null);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-200">Suscripciones Recurrentes</h2>
                    <p className="text-slate-400 text-sm">Gestiona tus gastos fijos mensuales.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={18} />
                    Nueva Suscripción
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {subscriptions.map(sub => (
                    <div key={sub.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/80 transition-colors group relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                                    <RefreshCcw size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-200">{sub.name}</h3>
                                    <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded-full border border-slate-600/30">
                                        {sub.category_name}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold text-slate-200 text-lg">
                                    {sub.currency === 'USD' ? 'USD' : '$'} {sub.amount}
                                </div>
                                <div className="text-xs text-slate-500 capitalize">{sub.frequency === 'monthly' ? 'Mensual' : sub.frequency}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                            <div className="text-xs text-slate-500">
                                Último cobro: <span className="text-slate-400">{sub.last_generated_date ? new Date(sub.last_generated_date).toLocaleDateString() : 'Nunca'}</span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => deleteSubscription(sub.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Eliminar suscripción"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleGenerate(sub)}
                                    disabled={generatingId === sub.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all text-xs font-medium border border-indigo-500/20"
                                >
                                    {generatingId === sub.id ? (
                                        <RefreshCcw size={14} className="animate-spin" />
                                    ) : (
                                        <CheckCircle size={14} />
                                    )}
                                    Generar Gasto
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {subscriptions.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/20">
                        <p>No tienes suscripciones activas.</p>
                    </div>
                )}
            </div>

            {/* Modal Nueva Suscripción */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6">Nueva Suscripción</h3>
                        <form onSubmit={handleAddSubscription} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 ml-1">Nombre del servicio</label>
                                <input
                                    type="text"
                                    value={newSub.name}
                                    onChange={e => setNewSub({ ...newSub, name: e.target.value })}
                                    placeholder="Netflix, Spotify, Internet..."
                                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 ml-1">Monto</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newSub.amount}
                                        onChange={e => setNewSub({ ...newSub, amount: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 ml-1">Moneda</label>
                                    <select
                                        value={newSub.currency}
                                        onChange={e => setNewSub({ ...newSub, currency: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="ARS">ARS</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 ml-1">Categoría</label>
                                <select
                                    value={newSub.category_name}
                                    onChange={e => setNewSub({ ...newSub, category_name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                                >
                                    {(categories.length > 0 ? categories : [{ name: 'General' }]).map(cat => (
                                        <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all">
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subscriptions;
