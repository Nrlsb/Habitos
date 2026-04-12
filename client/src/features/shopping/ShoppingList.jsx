import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ShoppingList = () => {
    const { session } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newQty, setNewQty] = useState('');
    const [adding, setAdding] = useState(false);
    const [deletingChecked, setDeletingChecked] = useState(false);
    const inputRef = useRef(null);

    const authHeader = () => ({ Authorization: `Bearer ${session.access_token}` });

    useEffect(() => {
        if (session) fetchItems();
    }, [session]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/shopping`, { headers: authHeader() });
            const data = await res.json();
            if (!data.error) setItems(data);
        } catch {
            toast.error('Error al cargar la lista');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const res = await fetch(`${API_URL}/api/shopping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ name: newName, quantity: newQty }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setItems(prev => [data, ...prev]);
            setNewName('');
            setNewQty('');
            inputRef.current?.focus();
        } catch {
            toast.error('Error al agregar el ítem');
        } finally {
            setAdding(false);
        }
    };

    const handleToggle = async (item) => {
        // Optimistic update
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
        try {
            const res = await fetch(`${API_URL}/api/shopping/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ checked: !item.checked }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            // Re-sort: unchecked first
            setItems(prev => {
                const updated = prev.map(i => i.id === data.id ? data : i);
                return [...updated.filter(i => !i.checked), ...updated.filter(i => i.checked)];
            });
        } catch {
            // Revert
            setItems(prev => prev.map(i => i.id === item.id ? item : i));
            toast.error('Error al actualizar');
        }
    };

    const handleDelete = async (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
        try {
            const res = await fetch(`${API_URL}/api/shopping/${id}`, {
                method: 'DELETE',
                headers: authHeader(),
            });
            if (!res.ok) throw new Error();
        } catch {
            toast.error('Error al eliminar');
            fetchItems();
        }
    };

    const handleClearChecked = async () => {
        const checkedCount = items.filter(i => i.checked).length;
        if (checkedCount === 0) return;
        setDeletingChecked(true);
        try {
            const res = await fetch(`${API_URL}/api/shopping/checked`, {
                method: 'DELETE',
                headers: authHeader(),
            });
            if (!res.ok) throw new Error();
            setItems(prev => prev.filter(i => !i.checked));
            toast.success(`${checkedCount} ${checkedCount === 1 ? 'ítem eliminado' : 'ítems eliminados'}`);
        } catch {
            toast.error('Error al limpiar');
        } finally {
            setDeletingChecked(false);
        }
    };

    const unchecked = items.filter(i => !i.checked);
    const checked = items.filter(i => i.checked);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-safe flex flex-col min-h-0" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
            {/* Header */}
            <header className="px-5 pt-4 pb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(46,204,112,0.15)' }}>
                    <ShoppingCart size={20} className="text-primary" />
                </div>
                <div>
                    <h1 className="text-[1.6rem] font-extrabold text-white tracking-tight leading-tight">Lista del Super</h1>
                    <p className="text-slate-500 text-xs font-semibold">
                        {unchecked.length} pendiente{unchecked.length !== 1 ? 's' : ''}
                        {checked.length > 0 && ` · ${checked.length} completado${checked.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
            </header>

            {/* Add item form */}
            <form onSubmit={handleAdd} className="mx-4 mb-4">
                <div className="flex gap-2 p-3 rounded-[20px] glass-panel border-white/5">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Agregar producto..."
                        className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 text-sm font-medium outline-none"
                        autoComplete="off"
                    />
                    <input
                        type="text"
                        value={newQty}
                        onChange={e => setNewQty(e.target.value)}
                        placeholder="Cant."
                        className="w-16 bg-transparent text-slate-100 placeholder:text-slate-600 text-sm font-medium outline-none text-center"
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={adding || !newName.trim()}
                        className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center active-scale disabled:opacity-40 shrink-0 transition-opacity"
                    >
                        {adding
                            ? <div className="w-4 h-4 border-2 border-[#131f18]/30 border-t-[#131f18] rounded-full animate-spin" />
                            : <Plus size={18} className="text-[#131f18]" strokeWidth={2.5} />
                        }
                    </button>
                </div>
            </form>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-sm">Cargando lista...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-600 px-8 text-center">
                    <ShoppingCart size={48} className="mb-4 opacity-30" />
                    <p className="font-semibold text-base">La lista está vacía</p>
                    <p className="text-sm mt-1 opacity-70">Agregá los productos que necesitás comprar</p>
                </div>
            ) : (
                <div className="px-4 space-y-2">
                    {/* Unchecked items */}
                    {unchecked.map(item => (
                        <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
                    ))}

                    {/* Divider + checked items */}
                    {checked.length > 0 && (
                        <>
                            <div className="flex items-center gap-3 py-2">
                                <div className="flex-1 h-px bg-white/5" />
                                <button
                                    onClick={handleClearChecked}
                                    disabled={deletingChecked}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest hover:text-red-400 active-scale transition-colors disabled:opacity-50"
                                >
                                    <Trash2 size={12} />
                                    Limpiar completados
                                </button>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>
                            {checked.map(item => (
                                <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

function ItemRow({ item, onToggle, onDelete }) {
    return (
        <div className={`flex items-center gap-3 p-4 rounded-[16px] glass-panel border-white/5 transition-opacity duration-200 ${item.checked ? 'opacity-40' : ''}`}>
            <button
                onClick={() => onToggle(item)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active-scale ${item.checked
                    ? 'bg-primary border-primary'
                    : 'border-white/20 hover:border-primary/60'
                    }`}
            >
                {item.checked && <Check size={13} className="text-[#131f18]" strokeWidth={3} />}
            </button>

            <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-snug ${item.checked ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {item.name}
                </p>
                {item.quantity && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.quantity}</p>
                )}
            </div>

            <button
                onClick={() => onDelete(item.id)}
                className="w-8 h-8 rounded-xl hover:bg-red-500/10 flex items-center justify-center active-scale text-slate-600 hover:text-red-400 transition-colors shrink-0"
            >
                <X size={15} />
            </button>
        </div>
    );
}

export default ShoppingList;
