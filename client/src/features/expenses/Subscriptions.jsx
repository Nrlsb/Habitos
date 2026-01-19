import { useState } from 'react';
import { useExpenses } from './ExpensesContext';
import Modal from '../../components/Modal';

const Subscriptions = () => {
    const {
        subscriptions,
        addSubscription,
        removeSubscription,
        updateSubscription,
        dolarOficial,
        dolarTarjeta
    } = useExpenses();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        currency: 'ARS', // ARS o USD
        billing_date: ''
    });

    // --- CORRECCIÓN DE SEGURIDAD ---
    // Si 'subscriptions' es null o undefined (cargando), usamos un array vacío []
    // Esto previene el error "Cannot read properties of undefined (reading 'reduce/map')"
    const safeSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];

    const handleOpenModal = (subscription = null) => {
        if (subscription) {
            setEditingSubscription(subscription);
            setFormData({
                name: subscription.name,
                amount: subscription.amount,
                currency: subscription.currency,
                billing_date: subscription.billing_date || ''
            });
        } else {
            setEditingSubscription(null);
            setFormData({
                name: '',
                amount: '',
                currency: 'ARS',
                billing_date: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubscription(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSubscription) {
                await updateSubscription(editingSubscription.id, {
                    ...formData,
                    amount: parseFloat(formData.amount)
                });
            } else {
                await addSubscription({
                    ...formData,
                    amount: parseFloat(formData.amount)
                });
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error al guardar suscripción:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta suscripción?')) {
            try {
                await removeSubscription(id);
            } catch (error) {
                console.error("Error al eliminar:", error);
            }
        }
    };

    // Cálculos de totales usando la lista segura 'safeSubscriptions'
    const totalArs = safeSubscriptions
        .filter(sub => sub.currency === 'ARS')
        .reduce((acc, sub) => acc + (parseFloat(sub.amount) || 0), 0);

    const totalUsd = safeSubscriptions
        .filter(sub => sub.currency === 'USD')
        .reduce((acc, sub) => acc + (parseFloat(sub.amount) || 0), 0);

    // Estimación total en ARS (usando dolarTarjeta si hay gastos en USD)
    const totalEstimadoArs = totalArs + (totalUsd * (dolarTarjeta || 0));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Resumen de Costos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-1">Total Mensual (ARS)</h3>
                    <p className="text-2xl font-bold text-white">
                        ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-1">Total Mensual (USD)</h3>
                    <p className="text-2xl font-bold text-emerald-400">
                        US${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        Dólar Tarjeta: ${dolarTarjeta ? dolarTarjeta.toFixed(2) : '---'}
                    </p>
                </div>
                <div className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30">
                    <h3 className="text-indigo-300 text-sm mb-1">Total Estimado Final (ARS)</h3>
                    <p className="text-2xl font-bold text-indigo-100">
                        ${totalEstimadoArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-indigo-300/60 mt-1">
                        (Incluyendo impuestos país/ganancias para USD)
                    </p>
                </div>
            </div>

            {/* Lista de Suscripciones */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white">Mis Suscripciones</h2>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        + Nueva Suscripción
                    </button>
                </div>

                <div className="divide-y divide-slate-700">
                    {safeSubscriptions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            No tienes suscripciones registradas aún.
                        </div>
                    ) : (
                        safeSubscriptions.map((sub) => (
                            <div key={sub.id} className="p-4 hover:bg-slate-700/50 transition-colors flex justify-between items-center group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                    ${sub.currency === 'USD' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                        {sub.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">{sub.name}</h3>
                                        <p className="text-sm text-slate-400">
                                            Vence el día {sub.billing_date || '?'} • {sub.currency}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="font-bold text-white">
                                            {sub.currency === 'USD' ? 'US$' : '$'}
                                            {parseFloat(sub.amount).toLocaleString()}
                                        </p>
                                        {sub.currency === 'USD' && (
                                            <p className="text-xs text-slate-500">
                                                ≈ ${(sub.amount * dolarTarjeta).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal(sub)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg"
                                            title="Editar"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sub.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-lg"
                                            title="Eliminar"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Agregar/Editar */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingSubscription ? "Editar Suscripción" : "Nueva Suscripción"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del servicio</label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Netflix, Spotify, etc."
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Monto</label>
                            <input
                                type="number"
                                name="amount"
                                required
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={handleChange}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Moneda</label>
                            <select
                                name="currency"
                                value={formData.currency}
                                onChange={handleChange}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="ARS">Pesos (ARS)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Día de cobro (mensual)</label>
                        <input
                            type="number"
                            name="billing_date"
                            min="1"
                            max="31"
                            value={formData.billing_date}
                            onChange={handleChange}
                            placeholder="Ej: 15"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                        >
                            {editingSubscription ? "Guardar Cambios" : "Agregar Suscripción"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Subscriptions;