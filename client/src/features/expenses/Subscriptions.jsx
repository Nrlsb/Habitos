import { useState, useMemo } from 'react';
import { useExpenses } from './ExpensesContext';
import Modal from '../../components/Modal';
import { toast } from 'sonner';
import { Plus, Pause, Play, Trash2, Pencil, Bell, ChevronDown, ChevronUp } from 'lucide-react';

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

const FREQUENCIES = [
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'annual', label: 'Anual' },
];

const monthlyEquivalent = (sub) => {
    const amt = parseFloat(sub.amount) || 0;
    if (sub.frequency === 'annual') return amt / 12;
    if (sub.frequency === 'quarterly') return amt / 3;
    return amt;
};

const getDaysUntilBilling = (billingDay) => {
    if (!billingDay) return null;
    const today = new Date();
    const todayDay = today.getDate();
    const bd = parseInt(billingDay);
    if (isNaN(bd)) return null;
    if (bd >= todayDay) return bd - todayDay;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return (daysInMonth - todayDay) + bd;
};

const getCategoryEmoji = (catName) => {
    const found = SUBSCRIPTION_CATEGORIES.find(c => c.value === catName);
    return found ? found.emoji : '📦';
};

const fmt = (n) => (isNaN(n) ? '0' : Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

const Subscriptions = () => {
    const {
        subscriptions,
        addSubscription,
        deleteSubscription,
        updateSubscription,
        dolarOficial,
        dolarTarjeta,
        tarjetaFactor,
        setTarjetaFactor
    } = useExpenses();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState(null);
    const [showPaused, setShowPaused] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        currency: 'ARS',
        category_name: 'General',
        frequency: 'monthly',
        billing_date: ''
    });

    const safeSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
    const activeSubscriptions = safeSubscriptions.filter(s => s.active !== false);
    const pausedSubscriptions = safeSubscriptions.filter(s => s.active === false);

    const handleOpenModal = (subscription = null) => {
        if (subscription) {
            setEditingSubscription(subscription);
            setFormData({
                name: subscription.name,
                amount: subscription.amount,
                currency: subscription.currency,
                category_name: subscription.category_name || 'General',
                frequency: subscription.frequency || 'monthly',
                billing_date: subscription.billing_date || ''
            });
        } else {
            setEditingSubscription(null);
            setFormData({ name: '', amount: '', currency: 'ARS', category_name: 'General', frequency: 'monthly', billing_date: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); setEditingSubscription(null); };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, amount: parseFloat(formData.amount) };
            if (editingSubscription) {
                await updateSubscription(editingSubscription.id, payload);
                toast.success('Suscripción actualizada');
            } else {
                await addSubscription(payload);
                toast.success('Suscripción agregada');
            }
            handleCloseModal();
        } catch (error) {
            toast.error('Error al guardar suscripción');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar esta suscripción?')) {
            try {
                await deleteSubscription(id);
                toast.success('Suscripción eliminada');
            } catch {
                toast.error('Error al eliminar');
            }
        }
    };

    const handleTogglePause = async (sub) => {
        try {
            await updateSubscription(sub.id, { active: sub.active === false ? true : false });
            toast.success(sub.active === false ? 'Suscripción reactivada' : 'Suscripción pausada');
        } catch {
            toast.error('Error al actualizar');
        }
    };

    // Totales mensuales equivalentes (respetando frecuencia)
    const totalArsMonthly = useMemo(() =>
        activeSubscriptions
            .filter(s => s.currency === 'ARS')
            .reduce((acc, s) => acc + monthlyEquivalent(s), 0),
        [activeSubscriptions]);

    const totalUsdMonthly = useMemo(() =>
        activeSubscriptions
            .filter(s => s.currency === 'USD')
            .reduce((acc, s) => acc + monthlyEquivalent(s), 0),
        [activeSubscriptions]);

    const totalEstimadoArs = totalArsMonthly + (totalUsdMonthly * (dolarTarjeta || 0));

    // Agrupación por categoría
    const groupedByCategory = useMemo(() => {
        const map = {};
        activeSubscriptions.forEach(sub => {
            const cat = sub.category_name || 'General';
            if (!map[cat]) map[cat] = [];
            map[cat].push(sub);
        });
        return map;
    }, [activeSubscriptions]);

    return (
        <div className="space-y-5 animate-fade-in pb-24">

            {/* === RESUMEN TOTALES === */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Mensual ARS</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">${fmt(totalArsMonthly)}</p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Mensual USD</p>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">US${totalUsdMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-500 mt-1">Dólar Tarjeta: ${dolarTarjeta ? dolarTarjeta.toFixed(2) : '---'}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-500">Factor impuesto:</span>
                        <input
                            type="number" min="1" step="0.01" value={tarjetaFactor}
                            onChange={(e) => setTarjetaFactor(e.target.value)}
                            className="w-16 bg-white/5 border border-white/10 text-slate-200 text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                    </div>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
                    <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-1">Total Estimado Final</p>
                    <p className="text-2xl font-bold text-white tabular-nums">${fmt(totalEstimadoArs)}</p>
                    <p className="text-xs text-slate-500 mt-1">Mensual · Con impuestos incluidos</p>
                </div>
            </div>

            {/* === LISTA POR CATEGORÍA === */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-base font-bold text-white">Mis Suscripciones
                        <span className="ml-2 text-xs font-normal text-slate-400">({activeSubscriptions.length} activas)</span>
                    </h2>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 bg-primary text-[#131f18] px-4 py-2 rounded-xl text-sm font-bold transition-all hover:bg-primary/90"
                    >
                        <Plus size={16} /> Nueva
                    </button>
                </div>

                {activeSubscriptions.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 text-sm">
                        No tenés suscripciones activas aún.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {Object.entries(groupedByCategory).map(([catName, subs]) => (
                            <div key={catName}>
                                <div className="px-5 py-2.5 bg-white/3 flex items-center gap-2">
                                    <span className="text-base">{getCategoryEmoji(catName)}</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{catName}</span>
                                </div>
                                {subs.map(sub => {
                                    const daysLeft = getDaysUntilBilling(sub.billing_date);
                                    const vencePronto = daysLeft !== null && daysLeft <= 7;
                                    const monthlyAmt = monthlyEquivalent(sub);
                                    const freqLabel = FREQUENCIES.find(f => f.value === (sub.frequency || 'monthly'))?.label || 'Mensual';
                                    return (
                                        <div key={sub.id} className="px-5 py-4 hover:bg-white/3 transition-colors flex justify-between items-center group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                                    ${sub.currency === 'USD' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-primary/15 text-primary'}`}>
                                                    {sub.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-medium text-white text-sm truncate">{sub.name}</h3>
                                                        {vencePronto && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                <Bell size={9} />
                                                                {daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        {freqLabel}{sub.billing_date ? ` · Día ${sub.billing_date}` : ''}
                                                        {sub.frequency !== 'monthly' && (
                                                            <span className="ml-1 text-slate-600">≈ ${fmt(monthlyAmt)}/mes</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <p className="font-bold text-white text-sm tabular-nums">
                                                        {sub.currency === 'USD' ? 'US$' : '$'}{parseFloat(sub.amount).toLocaleString()}
                                                    </p>
                                                    {sub.currency === 'USD' && dolarTarjeta > 0 && (
                                                        <p className="text-[10px] text-slate-500 tabular-nums">
                                                            ≈ ${fmt(monthlyAmt * dolarTarjeta)}/mes
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleTogglePause(sub)}
                                                        className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors" title="Pausar">
                                                        <Pause size={14} />
                                                    </button>
                                                    <button onClick={() => handleOpenModal(sub)}
                                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Editar">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(sub.id)}
                                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors" title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* === PAUSADAS === */}
            {pausedSubscriptions.length > 0 && (
                <div className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowPaused(p => !p)}
                        className="w-full px-5 py-3.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <span className="text-sm font-medium">Pausadas ({pausedSubscriptions.length})</span>
                        {showPaused ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showPaused && (
                        <div className="divide-y divide-white/5 border-t border-white/5">
                            {pausedSubscriptions.map(sub => (
                                <div key={sub.id} className="px-5 py-4 flex justify-between items-center group opacity-50 hover:opacity-80 transition-opacity">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                                            {sub.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-slate-300 text-sm line-through">{sub.name}</h3>
                                            <p className="text-xs text-slate-600">{sub.category_name || 'General'} · Pausada</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm text-slate-500 tabular-nums">
                                            {sub.currency === 'USD' ? 'US$' : '$'}{parseFloat(sub.amount).toLocaleString()}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleTogglePause(sub)}
                                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-white/5 rounded-lg transition-colors" title="Reactivar">
                                                <Play size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(sub.id)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* === MODAL === */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingSubscription ? 'Editar Suscripción' : 'Nueva Suscripción'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del servicio</label>
                        <input type="text" name="name" required value={formData.name} onChange={handleChange}
                            placeholder="Netflix, Spotify, etc."
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder-slate-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto</label>
                            <input type="number" name="amount" required step="0.01" min="0" value={formData.amount} onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Moneda</label>
                            <select name="currency" value={formData.currency} onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40">
                                <option value="ARS">Pesos (ARS)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Frecuencia</label>
                            <select name="frequency" value={formData.frequency} onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40">
                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Día de cobro</label>
                            <input type="number" name="billing_date" min="1" max="31" value={formData.billing_date} onChange={handleChange}
                                placeholder="Ej: 15"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder-slate-600" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría</label>
                        <select name="category_name" value={formData.category_name} onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40">
                            {SUBSCRIPTION_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={handleCloseModal}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-xl font-medium transition-colors">
                            Cancelar
                        </button>
                        <button type="submit"
                            className="flex-1 bg-primary hover:bg-primary/90 text-[#131f18] py-3 rounded-xl font-bold transition-colors">
                            {editingSubscription ? 'Guardar Cambios' : 'Agregar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Subscriptions;
