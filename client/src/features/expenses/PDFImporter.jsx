import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CATEGORIES = [
    "General", "Comida", "Transporte", "Servicios", "Alquiler",
    "Supermercado", "Mascota", "Hogar", "Viandas", "Alcohol",
    "Ocio", "Salud", "Ropa", "Educación", "Otros"
];

// Auto-assign a category based on keywords in the description
function guessCategoryFromDescription(desc) {
    if (!desc) return 'General';
    const d = desc.toLowerCase();
    if (/super|walmart|carrefour|coto|dia\b|jumbo|disco|vea|toledo|chango|lider/.test(d)) return 'Supermercado';
    if (/rappi|pedidos ya|pedidosya|mcdonald|burger|kentucky|pizza|sushi|restaurant|resto|cafe|cafeteria|starbucks|mostaza|beto|pollo/.test(d)) return 'Comida';
    if (/cabify|uber|taxi|colect|subte|tren|bus|combustible|nafta|ypf|shell|axion|edenor|metrogas/.test(d)) return 'Transporte';
    if (/edenor|edesur|metrogas|aguas|arnet|fibertel|telecentro|personal|movistar|claro|internet|telefon/.test(d)) return 'Servicios';
    if (/netflix|disney|spotify|hbo|prime|youtube|play|suscripci|membresía|membresia/.test(d)) return 'Ocio';
    if (/farmacia|farmac|droguería|clinica|medico|doctor|salud|hospital|laboratorio|optica/.test(d)) return 'Salud';
    if (/zara|h&m|forever|ropa|indumentaria|camiseta|zapatilla|nike|adidas|falabella/.test(d)) return 'Ropa';
    if (/udemy|coursera|libro|libros|librería|colegio|academia|estudio|escuela|universidad/.test(d)) return 'Educación';
    if (/alquiler|expensa|consorcio|inmobiliaria/.test(d)) return 'Alquiler';
    if (/veterinaria|petshop|mascota|perro|gato/.test(d)) return 'Mascota';
    if (/mercado pago|mercadopago|mp \*/.test(d)) return 'General';
    return 'General';
}

export default function PDFImporter({ planillaId, planillaNombre, onClose, onImported }) {
    const { session } = useAuth();
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [detectedBank, setDetectedBank] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const handleFile = useCallback(async (file) => {
        if (!file || file.type !== 'application/pdf') {
            setError('Por favor seleccioná un archivo PDF');
            return;
        }
        setError(null);
        setIsLoading(true);
        setTransactions([]);
        setSelectedIds(new Set());

        try {
            const formData = new FormData();
            formData.append('pdf', file);

            const res = await fetch(`${API_URL}/api/parse-pdf`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al procesar el PDF');

            setDetectedBank(data.bank);

            if (!data.transactions || data.transactions.length === 0) {
                setError('No se detectaron transacciones en el PDF. Es posible que el formato no sea compatible o el archivo esté escaneado como imagen.');
                return;
            }

            // Enrich with auto-category
            const enriched = data.transactions.map((t, i) => ({
                ...t,
                id: i,
                category: guessCategoryFromDescription(t.description),
                currency: 'ARS',
                include: true
            }));

            setTransactions(enriched);
            setSelectedIds(new Set(enriched.map(t => t.id)));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    };

    const updateTransaction = (id, field, value) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const removeTransaction = (id) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    };

    const handleImport = async () => {
        const toImport = transactions.filter(t => selectedIds.has(t.id));
        if (toImport.length === 0) {
            toast.error('Seleccioná al menos un movimiento para importar');
            return;
        }

        setIsImporting(true);
        setImportProgress(0);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < toImport.length; i++) {
            const t = toImport[i];
            try {
                const [year, month, day] = t.date.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);

                const res = await fetch(`${API_URL}/api/planillas/${planillaId}/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        description: t.description,
                        amount: t.amount,
                        currency: t.currency,
                        category: t.category,
                        date: localDate.toISOString(),
                        esCompartido: false,
                        enCuotas: false,
                        cuotaActual: null,
                        totalCuotas: null,
                        payer_name: null,
                        split_details: null
                    })
                });

                if (res.ok) successCount++;
                else failCount++;
            } catch {
                failCount++;
            }
            setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
        }

        setIsImporting(false);

        if (successCount > 0) {
            toast.success(`${successCount} movimiento${successCount > 1 ? 's' : ''} importado${successCount > 1 ? 's' : ''} correctamente`);
            onImported?.();
            onClose();
        }
        if (failCount > 0) {
            toast.error(`${failCount} movimiento${failCount > 1 ? 's' : ''} no se pudo${failCount > 1 ? 'ron' : ''} importar`);
        }
    };

    const selectedCount = selectedIds.size;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#131f18] border border-primary/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText size={20} className="text-primary" />
                            Importar desde PDF
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Planilla: {planillaNombre}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Upload area — only show if no transactions yet */}
                    {transactions.length === 0 && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
                                ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/20 hover:border-primary/40 hover:bg-white/5'}`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={e => handleFile(e.target.files[0])}
                            />
                            {isLoading ? (
                                <>
                                    <Loader2 size={36} className="text-primary animate-spin" />
                                    <p className="text-slate-400 text-sm">Procesando PDF...</p>
                                </>
                            ) : (
                                <>
                                    <Upload size={36} className="text-primary/60" />
                                    <p className="text-slate-300 font-medium">Arrastrá o tocá para subir el PDF</p>
                                    <p className="text-slate-500 text-xs text-center">
                                        Resúmenes de Galicia, BBVA, Santander, Naranja, Mercado Pago y otros.
                                        Máx. 20 MB.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Bank detected badge + re-upload link */}
                    {transactions.length > 0 && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-primary" />
                                <span className="text-sm text-slate-300">
                                    {transactions.length} movimiento{transactions.length !== 1 ? 's' : ''} detectado{transactions.length !== 1 ? 's' : ''}
                                    {detectedBank && detectedBank !== 'generic' && (
                                        <span className="ml-1 text-primary font-medium capitalize">• {detectedBank}</span>
                                    )}
                                </span>
                            </div>
                            <button
                                onClick={() => { setTransactions([]); setSelectedIds(new Set()); setError(null); setDetectedBank(null); }}
                                className="text-xs text-slate-500 hover:text-primary transition-colors underline"
                            >
                                Cargar otro PDF
                            </button>
                        </div>
                    )}

                    {/* Transactions table */}
                    {transactions.length > 0 && (
                        <div className="space-y-2">
                            {/* Select all row */}
                            <div className="flex items-center gap-3 px-1 pb-1 border-b border-white/5">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                                    onChange={toggleSelectAll}
                                    className="accent-primary w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs text-slate-500 uppercase tracking-wider">
                                    {selectedIds.size === transactions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                    {selectedIds.size > 0 && ` (${selectedIds.size})`}
                                </span>
                            </div>

                            {transactions.map(t => (
                                <div
                                    key={t.id}
                                    className={`rounded-xl border p-3 flex gap-3 items-start transition-all
                                        ${selectedIds.has(t.id)
                                            ? 'bg-primary/5 border-primary/20'
                                            : 'bg-white/3 border-white/5 opacity-50'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(t.id)}
                                        onChange={() => toggleSelect(t.id)}
                                        className="accent-primary w-4 h-4 mt-1 shrink-0 cursor-pointer"
                                    />

                                    <div className="flex-1 grid grid-cols-1 gap-2 min-w-0">
                                        {/* Date + Amount row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <input
                                                type="date"
                                                value={t.date}
                                                onChange={e => updateTransaction(t.id, 'date', e.target.value)}
                                                className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                                            />
                                            <div className="flex items-center gap-1 ml-auto">
                                                <select
                                                    value={t.currency}
                                                    onChange={e => updateTransaction(t.id, 'currency', e.target.value)}
                                                    className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                >
                                                    <option value="ARS">ARS</option>
                                                    <option value="USD">USD</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    value={t.amount}
                                                    min="0"
                                                    onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="bg-white/5 border border-white/10 text-slate-100 text-sm font-semibold rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-primary/40 text-right"
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <input
                                            type="text"
                                            value={t.description}
                                            onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                                            className="bg-white/5 border border-white/10 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 w-full"
                                        />

                                        {/* Category */}
                                        <select
                                            value={t.category}
                                            onChange={e => updateTransaction(t.id, 'category', e.target.value)}
                                            className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40 w-full"
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => removeTransaction(t.id)}
                                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {transactions.length > 0 && (
                    <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
                        {isImporting ? (
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Loader2 size={14} className="animate-spin text-primary" />
                                    <span className="text-xs text-slate-400">Importando... {importProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${importProgress}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4 py-2 transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={selectedCount === 0}
                                    className="bg-primary text-[#131f18] font-semibold px-6 py-2.5 rounded-xl text-sm disabled:opacity-40 transition-all hover:bg-primary/90 active:scale-95"
                                >
                                    Importar {selectedCount > 0 ? `${selectedCount} movimiento${selectedCount !== 1 ? 's' : ''}` : ''}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
