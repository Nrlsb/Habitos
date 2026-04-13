import React, { useState } from 'react';
import { useExpenses } from './ExpensesContext';
import { Plus, Trash2, Edit2, X, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

function CreditCardsManager() {
    const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard } = useExpenses();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', last_digits: '', bank: '', color: '#2ecc70' });

    const resetForm = () => {
        setFormData({ name: '', last_digits: '', bank: '', color: '#2ecc70' });
        setIsEditing(null);
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('El nombre de la tarjeta es requerido');
            return;
        }
        try {
            await addCreditCard(formData);
            toast.success('Tarjeta agregada exitosamente');
            resetForm();
        } catch (err) {
            toast.error('Error al agregar tarjeta: ' + err.message);
        }
    };

    const handleEditCard = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('El nombre de la tarjeta es requerido');
            return;
        }
        try {
            await updateCreditCard(isEditing, formData);
            toast.success('Tarjeta actualizada exitosamente');
            resetForm();
        } catch (err) {
            toast.error('Error al actualizar tarjeta: ' + err.message);
        }
    };

    const handleDeleteCard = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta tarjeta de crédito?')) {
            try {
                await deleteCreditCard(id);
                toast.success('Tarjeta eliminada exitosamente');
            } catch (err) {
                toast.error('Error al eliminar tarjeta: ' + err.message);
            }
        }
    };

    const handleEditClick = (card) => {
        setFormData({
            name: card.name,
            last_digits: card.last_digits || '',
            bank: card.bank || '',
            color: card.color || '#2ecc70'
        });
        setIsEditing(card.id);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all font-medium text-sm"
            >
                <CreditCard size={16} />
                Gestionar Tarjetas
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel border-white/5 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <CreditCard size={24} className="text-primary" />
                        Gestionar Tarjetas de Crédito
                    </h3>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            resetForm();
                        }}
                        className="text-slate-400 hover:text-white p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* FORM */}
                <form onSubmit={isEditing ? handleEditCard : handleAddCard} className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/30 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium ml-1">Nombre de la Tarjeta</label>
                            <input
                                type="text"
                                placeholder="Ej: Visa Santander"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium ml-1">Últimos 4 Dígitos</label>
                            <input
                                type="text"
                                placeholder="Ej: 4242"
                                value={formData.last_digits}
                                onChange={(e) => setFormData({ ...formData, last_digits: e.target.value })}
                                className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium ml-1">Banco (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Ej: Santander"
                                value={formData.bank}
                                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                                className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium ml-1">Color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="h-10 w-16 rounded-lg cursor-pointer border border-slate-600"
                                />
                                <span className="text-xs text-slate-500">{formData.color}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-primary hover:bg-primary/90 text-[#131f18] px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active-scale"
                        >
                            {isEditing ? 'Actualizar Tarjeta' : 'Agregar Tarjeta'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>

                {/* LIST */}
                <div>
                    <h4 className="text-lg font-semibold text-slate-200 mb-3">Tus Tarjetas</h4>
                    {creditCards.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                            No tienes tarjetas de crédito registradas.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {creditCards.map((card) => (
                                <div
                                    key={card.id}
                                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors group"
                                    style={{ borderLeftColor: card.color, borderLeftWidth: '4px' }}
                                >
                                    <div className="flex-1">
                                        <h5 className="font-semibold text-slate-200 flex items-center gap-2">
                                            <CreditCard size={16} style={{ color: card.color }} />
                                            {card.name}
                                        </h5>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {card.last_digits && `•••• ${card.last_digits}`}
                                            {card.bank && ` • ${card.bank}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditClick(card)}
                                            className="text-slate-400 hover:text-primary p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCard(card.id)}
                                            className="text-slate-400 hover:text-red-400 p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="mt-6 pt-6 border-t border-slate-700/30 flex justify-end">
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            resetForm();
                        }}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreditCardsManager;
