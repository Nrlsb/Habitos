import React, { useState, useMemo, useEffect } from 'react';
import { useExpenses } from './ExpensesContext';
import { getDolarRate } from '../../services/dolarApi';
import { Plus, Trash2, ArrowLeft, Edit2, Wallet, CheckCircle, Share2, Users, X, PieChart, BarChart3, List, Check, ArrowRightCircle, ChevronLeft, ChevronRight, Calendar, RefreshCcw, FileText } from 'lucide-react';
import ExpensesAnalysis from './ExpensesAnalysis';
import Subscriptions from './Subscriptions';
import BudgetTab from './BudgetTab';
import NotificationModal from '../../components/NotificationModal';
import PDFImporter from './PDFImporter';

function Expenses() {
    const {
        planillas,
        expenses,
        loading,
        addPlanilla,
        updatePlanilla, // Added this
        deletePlanilla,
        getExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        sharePlanilla,
        copyExpensesToPlanilla,
        performMonthRollover,
        categories,
        addCategory,
        deleteCategory,
        error // Added error
    } = useExpenses();

    const [selectedPlanillaId, setSelectedPlanillaId] = useState(null);
    const [newPlanillaName, setNewPlanillaName] = useState('');

    // Participants Modal State
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [tempParticipants, setTempParticipants] = useState([]);
    const [newParticipantName, setNewParticipantName] = useState('');

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareEmail, setShareEmail] = useState('');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [isDeletingExpense, setIsDeletingExpense] = useState(false);

    // Month Navigation State
    const [currentDate, setCurrentDate] = useState(new Date()); // Defaults to today -> Current Month View

    // Export State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportTargetId, setExportTargetId] = useState('');

    // Categories Modal State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('📦');

    // Rollover State

    // Rollover State
    const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
    const [isPDFImporterOpen, setIsPDFImporterOpen] = useState(false);
    const [rolloverCandidates, setRolloverCandidates] = useState([]);
    const [selectedRolloverIds, setSelectedRolloverIds] = useState(new Set());
    const [isLoadingRollover, setIsLoadingRollover] = useState(false);
    const [exportMessage, setExportMessage] = useState('');

    // Expense Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [esCompartido, setEsCompartido] = useState(false);
    const [enCuotas, setEnCuotas] = useState(false);
    const [totalCuotas, setTotalCuotas] = useState('');
    const [cuotaActual, setCuotaActual] = useState('');
    const [category, setCategory] = useState('General'); // New Category State
    const [paidBy, setPaidBy] = useState(''); // New Paid By State
    const [splitDetails, setSplitDetails] = useState([]); // [{ name: 'Lucas', amount: 0 }, { name: 'Gise', amount: 0 }]
    const [editingId, setEditingId] = useState(null);

    // Selection  State for Copying
    const [selectedExpenseIds, setSelectedExpenseIds] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const toggleExpenseSelection = (id) => {
        const newSelected = new Set(selectedExpenseIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedExpenseIds(newSelected);

        // Auto-enable selection mode if items selected, disable if empty (optional, but good UX)
        // setIsSelectionMode(newSelected.size > 0); 
    };

    const clearSelection = () => {
        setSelectedExpenseIds(new Set());
        setIsSelectionMode(false);
    };

    const handleSelectAll = () => {
        if (selectedExpenseIds.size === displayedExpenses.length) {
            clearSelection();
        } else {
            setSelectedExpenseIds(new Set(displayedExpenses.map(e => e.id)));
            setIsSelectionMode(true);
        }
    };


    const [notification, setNotification] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'analysis'
    const [searchQuery, setSearchQuery] = useState('');

    const [dolarRate, setDolarRate] = useState(null);

    useEffect(() => {
        const fetchDolar = async () => {
            const rate = await getDolarRate();
            setDolarRate(rate);
        };
        fetchDolar();
    }, []);

    useEffect(() => {
        if (selectedPlanillaId) {
            getExpenses(selectedPlanillaId);
        }
    }, [selectedPlanillaId, getExpenses]);

    // --- DERIVED STATE: Filtered Expenses by Month ---
    const filteredExpenses = useMemo(() => {
        if (!expenses) return [];
        return expenses.filter(e => {
            const expenseDate = new Date(e.created_at);
            return expenseDate.getMonth() === currentDate.getMonth() &&
                expenseDate.getFullYear() === currentDate.getFullYear();
        });
    }, [expenses, currentDate]);

    // Month Navigation Helpers
    const handlePrevMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return newDate;
        });
    };

    // Sync expenseDate with currentDate when navigating (only if not editing)
    useEffect(() => {
        if (!editingId) {
            setExpenseDate(currentDate.toISOString().split('T')[0]);
        }
    }, [currentDate, editingId]);


    const handleMonthRollover = () => {
        if (!selectedPlanillaId || !expenses) return;

        // 1. Calculate Previous Month
        const prevMonthDate = new Date(currentDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);

        // 2. Filter Candidates from EXISTING expenses list
        const candidates = expenses.filter(e => {
            const eDate = new Date(e.created_at);
            return eDate.getMonth() === prevMonthDate.getMonth() &&
                eDate.getFullYear() === prevMonthDate.getFullYear();
        });

        if (candidates.length === 0) {
            setNotification({
                isOpen: true,
                title: 'Información',
                message: 'No se encontraron gastos en el mes anterior.',
                type: 'info'
            });
            return;
        }

        // 3. Pre-select active installments
        const initialSelection = new Set();
        candidates.forEach(e => {
            if (e.is_installment) {
                // If it's an installment, select it only if not finished
                if (!e.total_installments || e.current_installment < e.total_installments) {
                    initialSelection.add(e.id);
                }
            }
        });

        setRolloverCandidates(candidates);
        setSelectedRolloverIds(initialSelection);
        setIsRolloverModalOpen(true);
    };

    const toggleRolloverSelection = (id) => {
        const newSet = new Set(selectedRolloverIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRolloverIds(newSet);
    };

    const confirmRollover = async () => {
        if (selectedRolloverIds.size === 0) return;

        setIsLoadingRollover(true);
        try {
            const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
            const result = await performMonthRollover(selectedPlanillaId, targetDate, Array.from(selectedRolloverIds));
            setIsRolloverModalOpen(false);
            setNotification({
                isOpen: true,
                title: '¡Éxito!',
                message: `Se importaron ${result.count} gastos exitosamente.`,
                type: 'success'
            });
        } catch (err) {
            setNotification({
                isOpen: true,
                title: 'Error',
                message: 'Error al importar: ' + err.message,
                type: 'error'
            });
        } finally {
            setIsLoadingRollover(false);
        }
    };


    const handleAddPlanilla = async (e) => {
        e.preventDefault();
        if (!newPlanillaName.trim()) return;
        await addPlanilla(newPlanillaName);
        setNewPlanillaName('');
    };

    // Participants Management Handlers
    const openParticipantsModal = () => {
        const currentPlanilla = planillas.find(p => p.id === selectedPlanillaId);
        if (currentPlanilla) {
            setTempParticipants(currentPlanilla.participants || ['Yo']);
            setShowParticipantsModal(true);
        }
    };

    const addParticipant = () => {
        if (newParticipantName.trim() && !tempParticipants.includes(newParticipantName.trim())) {
            setTempParticipants([...tempParticipants, newParticipantName.trim()]);
            setNewParticipantName('');
        }
    };

    const removeParticipant = (name) => {
        setTempParticipants(tempParticipants.filter(p => p !== name));
    };

    const saveParticipants = async () => {
        if (tempParticipants.length === 0) return alert("Debe haber al menos un participante");
        try {
            await updatePlanilla(selectedPlanillaId, { participants: tempParticipants });
            setShowParticipantsModal(false);
        } catch (error) {
            console.error("Error updating participants:", error);
            alert("Error al actualizar participantes");
        }
    };

    const handleDeletePlanilla = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de eliminar esta planilla?')) {
            await deletePlanilla(id);
            if (selectedPlanillaId === id) setSelectedPlanillaId(null);
        }
    };

    const handleExportExpenses = async () => {
        if (!selectedPlanillaId || !exportTargetId) return;

        try {
            // Updated to pass selectedExpenseIds (converted to array) if any are selected
            const idsToCopy = selectedExpenseIds.size > 0 ? Array.from(selectedExpenseIds) : [];

            await copyExpensesToPlanilla(selectedPlanillaId, exportTargetId, idsToCopy);

            const countMsg = idsToCopy.length > 0 ? `${idsToCopy.length} gastos seleccionados` : 'Todos los gastos';
            setExportMessage(`${countMsg} copiados exitosamente!`);

            // Clear selection if we copied
            if (idsToCopy.length > 0) {
                clearSelection();
            }

            setTimeout(() => {
                setIsExportModalOpen(false);
                setExportMessage('');
                setExportTargetId('');
            }, 1500);
        } catch (err) {
            setExportMessage('Error al copiar: ' + err.message);
        }
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCurrency('ARS');
        setCategory('General');

        // Use local date for the input
        const now = new Date();
        const isCurrentMonth = currentDate.getMonth() === now.getMonth() &&
            currentDate.getFullYear() === now.getFullYear();

        if (isCurrentMonth) {
            setExpenseDate(now.toISOString().split('T')[0]);
        } else {
            // If viewing another month, default to the 1st of that month in local time
            const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const year = firstOfMonth.getFullYear();
            const month = String(firstOfMonth.getMonth() + 1).padStart(2, '0');
            const day = String(firstOfMonth.getDate()).padStart(2, '0');
            setExpenseDate(`${year}-${month}-${day}`);
        }

        setEsCompartido(false);
        setEnCuotas(false);
        setCuotaActual('');
        setTotalCuotas('');
        setPaidBy('');
        setSplitDetails([]);
        setEditingId(null);
    };

    const addSplitDetail = () => {
        setSplitDetails([...splitDetails, { name: '', amount: '' }]);
    };

    const updateSplitDetail = (index, field, value) => {
        const newDetails = [...splitDetails];
        newDetails[index][field] = value;
        setSplitDetails(newDetails);
    };

    const removeSplitDetail = (index) => {
        const newDetails = [...splitDetails];
        newDetails.splice(index, 1);
        setSplitDetails(newDetails);
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount) return;

        // PARSE DATE LOCALLY: Avoid timezone shifting
        // expenseDate is "YYYY-MM-DD"
        const [year, month, day] = expenseDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);

        const expenseData = {
            description,
            amount: parseFloat(amount),
            currency,
            category,
            esCompartido,
            enCuotas,
            cuotaActual: enCuotas ? parseInt(cuotaActual) : null,
            totalCuotas: enCuotas ? parseInt(totalCuotas) : null,
            payer_name: esCompartido ? paidBy : null,
            date: localDate.toISOString(),
            split_details: (esCompartido && splitDetails.length > 0) ? splitDetails : null
        };

        if (editingId) {
            await updateExpense(selectedPlanillaId, editingId, expenseData);
        } else {
            await addExpense(selectedPlanillaId, expenseData);
        }
        resetForm();
    };

    const handleEditExpense = (expense) => {
        setEditingId(expense.id);
        setDescription(expense.description);
        setAmount(expense.amount);
        setCurrency(expense.currency || 'ARS');
        setCategory(expense.category || 'General');

        // Ensure date is formatted for input date (YYYY-MM-DD) in LOCAL time
        const dateObj = new Date(expense.created_at);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0'); // Database stores as UTC midnight often
        // However, if we want to be safe and it was created as local midnight...
        // Let's use the local month/day which is what the user expects to see.
        const localYear = dateObj.getFullYear();
        const localMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
        const localDay = String(dateObj.getDate()).padStart(2, '0');
        setExpenseDate(`${localYear}-${localMonth}-${localDay}`);

        setEsCompartido(expense.is_shared);
        setEnCuotas(expense.is_installment);
        setCuotaActual(expense.current_installment || '');
        setTotalCuotas(expense.total_installments || '');
        setPaidBy(expense.payer_name || '');
        setSplitDetails(expense.split_details || []);

        // Scroll to form only on mobile/desktop as needed
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };




    const handleDeleteExpense = async (id) => {
        if (window.confirm('¿Eliminar gasto?')) {
            await deleteExpense(selectedPlanillaId, id);
        }
    };

    const handleSettleDebt = async (expensesToSettle, newPayerName) => {
        if (!expensesToSettle || expensesToSettle.length === 0) return;

        if (!window.confirm(`¿Saldar deuda actualizando ${expensesToSettle.length} gastos a nombre de "${newPayerName}"?`)) return;

        try {
            await Promise.all(expensesToSettle.map(expense => {
                const updatedExpense = {
                    ...expense,
                    payer_name: newPayerName,
                    // Ensure backend required fields are present
                    date: expense.created_at,
                    cuotaActual: expense.current_installment,
                    totalCuotas: expense.total_installments,
                    enCuotas: expense.is_installment,
                    esCompartido: true // Should still be shared
                };
                return updateExpense(selectedPlanillaId, expense.id, updatedExpense);
            }));

            setNotification({
                isOpen: true,
                title: '¡Deuda Saldada!',
                message: 'Los gastos se han actualizado correctamente.',
                type: 'success'
            });
        } catch (err) {
            console.error('Error settling debt:', err);
            setNotification({
                isOpen: true,
                title: 'Error',
                message: 'Error al saldar deuda: ' + err.message,
                type: 'error'
            });
        }
    };

    const handleShareSubmit = async (e) => {
        e.preventDefault();
        if (isSharing) return;
        setShareError('');
        setShareSuccess('');
        setIsSharing(true);

        try {
            await sharePlanilla(selectedPlanillaId, shareEmail);
            setShareSuccess(`Invitación enviada a ${shareEmail}`);
            setShareEmail('');
            setTimeout(() => {
                setIsShareModalOpen(false);
                setShareSuccess('');
            }, 2000);
        } catch (err) {
            setShareError(err.message || 'Error al compartir');
        } finally {
            setIsSharing(false);
        }
    };

    const totalPersonalARS = useMemo(() => {
        if (!dolarRate) return 0;
        return filteredExpenses.reduce((acc, expense) => {
            const amountInARS = expense.currency === 'USD' ? expense.amount * dolarRate : expense.amount;
            const personalAmount = expense.is_shared ? amountInARS / 2 : amountInARS;
            return acc + personalAmount;
        }, 0);
    }, [filteredExpenses, dolarRate]);

    // Expenses filtered by month AND search query (used in list view only)
    const displayedExpenses = useMemo(() => {
        if (!searchQuery.trim()) return filteredExpenses;
        const q = searchQuery.toLowerCase();
        return filteredExpenses.filter(e =>
            e.description?.toLowerCase().includes(q) ||
            e.category?.toLowerCase().includes(q)
        );
    }, [filteredExpenses, searchQuery]);

    const exportToCSV = () => {
        if (!filteredExpenses.length) return;
        const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Moneda', 'Tipo', 'Pagado por'];
        const rows = filteredExpenses.map(e => [
            new Date(e.created_at).toLocaleDateString('es-AR'),
            `"${(e.description || '').replace(/"/g, '""')}"`,
            e.category || 'General',
            e.amount,
            e.currency || 'ARS',
            e.is_shared ? 'Compartido' : 'Personal',
            e.payer_name || ''
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const month = currentDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
        a.href = url;
        a.download = `gastos-${month}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const currentPlanilla = planillas.find(p => p.id === selectedPlanillaId);

    if (loading && !planillas.length) return <div className="text-center py-10 text-slate-400">Cargando...</div>;

    // Show error if fetching failed
    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 mb-4">
                    <p className="font-bold">Error de conexión</p>
                    <p className="text-sm">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    // VIEW: LIST OF PLANILLAS
    if (!selectedPlanillaId) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#131f18]/80 backdrop-blur-xl border-b border-white/5 px-4 pb-4 flex items-center justify-between pt-safe">
                    <div className="flex items-center gap-3">
                        <Wallet size={22} className="text-primary" />
                        <h1 className="text-xl font-bold tracking-tight">Mis Gastos</h1>
                    </div>
                </header>

                <div className="px-4 py-6 space-y-8">
                    {/* Nueva Planilla */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Plus size={16} className="text-primary" />
                            Nueva Planilla
                        </h2>
                        <form onSubmit={handleAddPlanilla} className="flex gap-3">
                            <input
                                type="text"
                                value={newPlanillaName}
                                onChange={(e) => setNewPlanillaName(e.target.value)}
                                placeholder="Ej: Enero 2026"
                                className="flex-1 bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 placeholder:text-slate-500 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!newPlanillaName.trim()}
                                className="min-w-[56px] w-14 h-auto bg-primary rounded-2xl flex items-center justify-center shrink-0 shadow-[var(--shadow-glow)] disabled:opacity-50 active-scale transition-all hover:bg-primary/90"
                            >
                                <Plus size={24} className="text-[#131f18]" />
                            </button>
                        </form>
                    </section>

                    {/* Planillas List */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tus planillas recientes</h2>
                        </div>

                        <div className="space-y-3">
                            {planillas.map(planilla => (
                                <div
                                    key={planilla.id}
                                    onClick={() => setSelectedPlanillaId(planilla.id)}
                                    className="glass-panel border-white/5 shadow-glass rounded-[24px] p-5 flex items-center justify-between cursor-pointer transition-all active-scale hover:bg-white/5"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner ${planilla.is_shared_with_me ? 'bg-blue-400/15 text-blue-400' : 'bg-primary/15 text-primary'}`}>
                                            {planilla.is_shared_with_me ? <Users size={22} /> : <Wallet size={22} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-100">{planilla.nombre}</h3>
                                                {planilla.is_shared_with_me && (
                                                    <span className="bg-blue-400/15 text-blue-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                                                        Compartida
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">{new Date(planilla.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    {!planilla.is_shared_with_me && (
                                        <button
                                            onClick={(e) => handleDeletePlanilla(planilla.id, e)}
                                            className="text-slate-600 hover:text-red-400 p-2 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {planillas.length === 0 && (
                                <div className="border-2 border-dashed border-primary/10 rounded-xl py-12 text-center">
                                    <p className="text-sm text-slate-500">No tienes planillas creadas.</p>
                                </div>
                            )}

                            {/* Info card */}
                            <div className="border-2 border-dashed border-primary/10 rounded-xl p-6 flex flex-col items-center text-center">
                                <ArrowRightCircle size={20} className="text-slate-500 mb-2" />
                                <p className="text-sm text-slate-500">Las planillas te ayudan a organizar tus gastos mensuales o eventos especiales.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    // VIEW: EXPENSE SHEET
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen overflow-x-hidden pb-24">
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />

            {/* PDF Importer Modal */}
            {isPDFImporterOpen && (
                <PDFImporter
                    planillaId={selectedPlanillaId}
                    planillaNombre={currentPlanilla?.nombre}
                    onClose={() => setIsPDFImporterOpen(false)}
                    onImported={() => getExpenses(selectedPlanillaId)}
                />
            )}

            {/* Share Modal */}
            {isShareModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131f18] border border-primary/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsShareModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Share2 className="text-primary" size={24} />
                            Compartir Planilla
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Invita a otros usuarios a colaborar en "{currentPlanilla?.nombre}".
                        </p>

                        <form onSubmit={handleShareSubmit}>
                            <div className="mb-4">
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Email del usuario</label>
                                <input
                                    type="email"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    placeholder="usuario@ejemplo.com"
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    required
                                />
                            </div>

                            {shareError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-2 rounded-lg">{shareError}</p>}
                            {shareSuccess && <p className="text-primary text-sm mb-4 bg-primary/10 p-2 rounded-lg">{shareSuccess}</p>}

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsShareModalOpen(false)}
                                    className="text-slate-300 hover:text-white px-4 py-2"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSharing}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSharing ? 'Enviando...' : 'Enviar Invitación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Manager Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131f18] border border-primary/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsCategoryModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <List className="text-primary" size={24} />
                            Gestionar Categorías
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Añade o elimina categorías personalizadas.
                        </p>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Nueva categoría..."
                                className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <input
                                type="text"
                                value={newCategoryIcon}
                                onChange={(e) => setNewCategoryIcon(e.target.value)}
                                placeholder="emoji"
                                className="w-20 bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <button
                                onClick={async () => {
                                    if (newCategoryName.trim()) {
                                        await addCategory({ name: newCategoryName, icon: newCategoryIcon, color: '#6366f1' });
                                        setNewCategoryName('');
                                    }
                                }}
                                disabled={!newCategoryName.trim()}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl disabled:opacity-50"
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-600 group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{cat.icon}</span>
                                        <span className="text-slate-200 font-medium">{cat.name}</span>
                                        {cat.is_default && <span className="text-[10px] bg-slate-700/50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-600">Default</span>}
                                    </div>
                                    {!cat.is_default && (
                                        <button
                                            onClick={() => {
                                                if (confirm(`¿Eliminar categoría ${cat.name}?`)) {
                                                    deleteCategory(cat.id);
                                                }
                                            }}
                                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-slate-700 rounded-lg"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131f18] border border-primary/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsExportModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <ArrowRightCircle className="text-primary" size={24} />
                            Copiar Gastos
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Copia todos los gastos de esta planilla a otra. Se duplicarán los gastos en el destino.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Planilla Destino</label>
                                <select
                                    value={exportTargetId}
                                    onChange={(e) => setExportTargetId(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <option value="">Seleccionar planilla...</option>
                                    {planillas.filter(p => p.id !== selectedPlanillaId).map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {exportMessage && (
                                <div className={`text-sm p-3 rounded-lg border ${exportMessage.includes('Error') ? 'bg-red-400/10 text-red-400 border-red-400/20' : 'bg-emerald-400/10 text-primary border-emerald-400/20'}`}>
                                    {exportMessage}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="text-slate-300 hover:text-white px-4 py-2"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExportExpenses}
                                    disabled={!exportTargetId}
                                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition-all"
                                >
                                    Copiar Gastos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Participants Modal (Detail View) */}
            {showParticipantsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131f18] border border-primary/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowParticipantsModal(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Users className="text-primary" size={24} />
                            Configurar Personas
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Define quiénes participan en esta planilla.
                        </p>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newParticipantName}
                                onChange={(e) => setNewParticipantName(e.target.value)}
                                placeholder="Nombre (ej. Lucas)"
                                className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-primary focus:outline-none"
                            />
                            <button
                                onClick={addParticipant}
                                className="bg-primary hover:bg-primary/90 text-white p-2 rounded-lg"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {tempParticipants.map((name, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <span className="text-slate-200">{name}</span>
                                    <button
                                        onClick={() => removeParticipant(name)}
                                        className="text-slate-500 hover:text-red-400"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowParticipantsModal(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveParticipants}
                                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setSelectedPlanillaId(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 font-medium px-4"
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
            >
                <ArrowLeft size={20} />
                <span>Planillas</span>
            </button>

            <div className="max-w-7xl mx-auto px-4 overflow-x-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-200">
                            {currentPlanilla?.nombre}
                        </h2>
                        {currentPlanilla?.is_shared_with_me && (
                            <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/30">
                                Compartido
                            </span>
                        )}
                    </div>

                    {!currentPlanilla?.is_shared_with_me && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setIsPDFImporterOpen(true)}
                                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl border border-primary/20 transition-all font-medium"
                            >
                                <FileText size={18} />
                                Importar PDF
                            </button>
                            <button
                                onClick={() => setIsExportModalOpen(true)}
                                className="flex items-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-primary px-4 py-2 rounded-xl border border-primary/20 transition-all font-medium"
                            >
                                <ArrowRightCircle size={18} />
                                Copiar
                            </button>
                            <button
                                onClick={openParticipantsModal}
                                className="flex items-center gap-2 bg-primary/10 hover:bg-indigo-900/50 text-primary px-4 py-2 rounded-xl border border-primary/20 transition-all font-medium"
                            >
                                <Users size={18} />
                                Personas
                            </button>
                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                className="flex items-center gap-2 bg-primary/10 hover:bg-indigo-900/50 text-primary px-4 py-2 rounded-xl border border-primary/20 transition-all font-medium"
                            >
                                <Share2 size={18} />
                                Compartir
                            </button>
                        </div>
                    )}
                </div>




                {/* ROLLOVER MODAL */}
                {isRolloverModalOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-[#131f18] border border-primary/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-primary/10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Importar Gastos del Mes Anterior</h3>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Selecciona los gastos de {new Date(new Date(currentDate).setMonth(currentDate.getMonth() - 1)).toLocaleString('es-AR', { month: 'long' })} que deseas copiar a {currentDate.toLocaleString('es-AR', { month: 'long' })}.
                                    </p>
                                </div>
                                <button onClick={() => setIsRolloverModalOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2">
                                {rolloverCandidates.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No hay gastos disponibles para importar.</div>
                                ) : (
                                    <table className="w-full text-sm text-left text-slate-400">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-800/50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-center w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRolloverIds.size === rolloverCandidates.length}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedRolloverIds(new Set(rolloverCandidates.map(c => c.id)));
                                                            } else {
                                                                setSelectedRolloverIds(new Set());
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-primary"
                                                    />
                                                </th>
                                                <th className="px-4 py-3">Descripción</th>
                                                <th className="px-4 py-3 text-right">Monto</th>
                                                <th className="px-4 py-3 text-center">Tipo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {rolloverCandidates.map(expense => {
                                                const isSelected = selectedRolloverIds.has(expense.id);
                                                return (
                                                    <tr key={expense.id} className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`} onClick={() => toggleRolloverSelection(expense.id)}>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => { }} // Handle click on row
                                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-primary pointer-events-none"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-slate-200">
                                                            {expense.description}
                                                            <div className="text-xs text-slate-500">{expense.category}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                                                            {expense.currency === 'USD' ? 'USD ' : '$'}
                                                            {expense.amount}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {expense.is_installment ? (
                                                                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full border border-primary/20">
                                                                    Cuota {expense.current_installment}/{expense.total_installments}
                                                                </span>
                                                            ) : (
                                                                <span className="bg-primary/5 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-600/30">
                                                                    Fijo/Único
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-6 border-t border-primary/10 flex justify-between items-center bg-white/5 rounded-b-3xl">
                                <div className="text-sm text-slate-400">
                                    <span className="font-bold text-white">{selectedRolloverIds.size}</span> seleccionados
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsRolloverModalOpen(false)}
                                        className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmRollover}
                                        disabled={selectedRolloverIds.size === 0 || isLoadingRollover}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-indigo-900/20 font-medium transition-all"
                                    >
                                        {isLoadingRollover ? 'Importando...' : 'Importar Seleccionados'}
                                        <ArrowRightCircle size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}




                {/* MONTH SELECTOR & ROLLOVER */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
                    <div className="flex items-center gap-4 bg-white/5 p-1.5 rounded-xl border border-primary/10 shadow-inner">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
                            <Calendar size={18} className="text-primary" />
                            <span className="text-lg font-semibold text-slate-200 capitalize">
                                {currentDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleMonthRollover}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-primary border border-primary/20 rounded-xl transition-all font-medium text-sm"
                    >
                        <ArrowRightCircle size={16} />
                        Importar Cuotas del Mes Anterior
                    </button>
                </div>

                {/* TOTAL HEADER */}
                <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary to-primary/80 p-6 mb-8 shadow-[var(--shadow-glow-strong)] group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity duration-700 group-hover:opacity-75"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 backdrop-blur-sm shadow-inner rounded-2xl text-[#131f18]">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <span className="text-[#131f18]/70 text-xs font-bold uppercase tracking-wider block mb-0.5">Gasto Personal Total</span>
                                <div className="text-3xl font-bold text-[#131f18] tabular-nums">
                                    ARS <span>${totalPersonalARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                        {dolarRate && (
                            <div className="text-right bg-white/5 px-4 py-2 rounded-lg border border-primary/10">
                                <span className="text-xs text-slate-500 uppercase block">Cotización Dólar</span>
                                <span className="text-primary font-mono font-medium">${dolarRate}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* TABS NAVIGATION */}
                <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl w-full border border-primary/10">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 min-w-0 ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <List size={16} />
                        Lista
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 min-w-0 ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <PieChart size={16} />
                        Análisis
                    </button>
                    <button
                        onClick={() => setActiveTab('subscriptions')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 min-w-0 ${activeTab === 'subscriptions' ? 'bg-indigo-600 text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <RefreshCcw size={16} />
                        Suscripciones
                    </button>
                    <button
                        onClick={() => setActiveTab('budget')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 min-w-0 ${activeTab === 'budget' ? 'bg-indigo-600 text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                    >
                        <Wallet size={16} />
                        Presupuesto
                    </button>
                </div>

                {activeTab === 'analysis' ? (
                    <ExpensesAnalysis
                        expenses={filteredExpenses}
                        dolarRate={dolarRate}
                        onSettleDebt={handleSettleDebt}
                        selectedDate={currentDate}
                        participants={currentPlanilla?.participants || ['Yo']}
                        currentPlanillaId={selectedPlanillaId}
                    />
                ) : activeTab === 'subscriptions' ? (
                    <Subscriptions currentPlanillaId={selectedPlanillaId} />
                ) : activeTab === 'budget' ? (
                    <BudgetTab
                        currentPlanillaId={selectedPlanillaId}
                        dolarRate={dolarRate}
                        expenses={filteredExpenses}
                        currentDate={currentDate}
                    />
                ) : (
                    <>
                        {/* ADD NEW EXPENSE FORM */}
                        <div className="glass-panel border-white/5 rounded-[32px] p-6 mb-8 shadow-glass transition-all duration-300">
                            <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <Plus size={20} className="text-primary" />
                                {editingId ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
                            </h3>
                            <form onSubmit={handleSubmitExpense}>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                                    <div className="md:col-span-5">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Descripción</label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Ej: Compra en el supermercado"
                                            className="w-full bg-white/5 border border-white/5 text-slate-100 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-500 text-base"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <div className="flex justify-between mb-1.5 ml-1">
                                            <label className="block text-xs text-slate-400 font-medium">Categoría</label>
                                            <button
                                                type="button"
                                                onClick={() => setIsCategoryModalOpen(true)}
                                                className="text-[10px] text-primary hover:text-primary flex items-center gap-1"
                                            >
                                                <Edit2 size={10} /> Gestionar
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none cursor-pointer"
                                            >
                                                {/* Always show General as fallback or first option if desired, or map context categories */}
                                                {categories.length > 0 ? (
                                                    categories.map(cat => (
                                                        <option key={cat.id || cat.value} value={cat.name || cat.value}>
                                                            {cat.name || cat.label} {cat.icon || ''}
                                                        </option>
                                                    ))
                                                ) : (
                                                    // Fallback if fetch fails but we want to show at least General
                                                    <option value="General">General 📝</option>
                                                )}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Monto</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600 tabular-nums"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Moneda</label>
                                        <div className="relative">
                                            <select
                                                value={currency}
                                                onChange={(e) => setCurrency(e.target.value)}
                                                className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="ARS">ARS 🇦🇷</option>
                                                <option value="USD">USD 🇺🇸</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Fecha</label>
                                        <input
                                            type="date"
                                            value={expenseDate}
                                            onChange={(e) => setExpenseDate(e.target.value)}
                                            className="w-full bg-white/5 border border-slate-600/50 hover:border-slate-500 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 mb-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${esCompartido ? 'bg-indigo-500 border-primary' : 'border-slate-600 bg-white/5 group-hover:border-slate-500'}`}>
                                            {esCompartido && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={esCompartido}
                                            onChange={(e) => setEsCompartido(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">Gasto Compartido</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${enCuotas ? 'bg-indigo-500 border-primary' : 'border-slate-600 bg-white/5 group-hover:border-slate-500'}`}>
                                            {enCuotas && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={enCuotas}
                                            onChange={(e) => setEnCuotas(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">Pagar en cuotas</span>
                                    </label>
                                </div>

                                {esCompartido && (
                                    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="block text-xs text-slate-400 mb-1.5 font-medium ml-1">Pagado por</label>
                                        <select
                                            value={paidBy}
                                            onChange={(e) => setPaidBy(e.target.value)}
                                            className="w-full md:w-1/2 bg-white/5 border border-slate-600/50 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none"
                                        >
                                            <option value="" disabled>Seleccionar Persona</option>
                                            {(planillas.find(p => p.id === selectedPlanillaId)?.participants || ['Yo']).map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            {!((planillas.find(p => p.id === selectedPlanillaId)?.participants || ['Yo']).includes(paidBy)) && paidBy && (
                                                <option value={paidBy}>{paidBy}</option>
                                            )}
                                        </select>

                                        {/* Division Personalizada */}
                                        <div className="mt-6 p-4 bg-slate-900/30 rounded-xl border border-slate-700/30">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-medium text-slate-300">División Personalizada</h4>
                                                <button
                                                    type="button"
                                                    onClick={addSplitDetail}
                                                    className="text-xs flex items-center gap-1 text-primary hover:text-primary transition-colors"
                                                >
                                                    <Plus size={14} /> Añadir Persona
                                                </button>
                                            </div>

                                            {splitDetails.length > 0 ? (
                                                <div className="space-y-3">
                                                    {/* Headers */}
                                                    <div className="flex gap-2 px-1 mb-1">
                                                        <span className="flex-1 text-xs text-slate-500 font-medium ml-1">Persona</span>
                                                        <span className="w-24 text-xs text-slate-500 font-medium text-right pr-2">Monto</span>
                                                        <span className="w-6"></span>
                                                    </div>

                                                    {splitDetails.map((detail, index) => (
                                                        <div key={index} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
                                                            <input
                                                                type="text"
                                                                list="participants-list" // Connect to datalist
                                                                placeholder="Persona (ej. Lucas)"
                                                                value={detail.name}
                                                                onChange={(e) => updateSplitDetail(index, 'name', e.target.value)}
                                                                className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-primary/40 focus:outline-none"
                                                            />
                                                            <div className="relative w-24">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={detail.amount}
                                                                    onChange={(e) => updateSplitDetail(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg pl-5 pr-2 py-2 focus:border-primary/40 focus:outline-none text-right"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSplitDetail(index)}
                                                                className="text-slate-500 hover:text-red-400 p-1"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <datalist id="participants-list">
                                                        {(planillas.find(p => p.id === selectedPlanillaId)?.participants || []).map(name => (
                                                            <option key={name} value={name} />
                                                        ))}
                                                    </datalist>
                                                    <div className="pt-2 border-t border-primary/10 text-right text-xs text-slate-500">
                                                        Total asignado: <span className="text-slate-300">${splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(2)}</span>
                                                        {amount && (
                                                            <span className="ml-3">
                                                                Resto a dividir: <span className="text-primary">${(parseFloat(amount) - splitDetails.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)).toFixed(2)}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500 italic">No hay asignaciones específicas. El monto total se dividirá en partes iguales.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {enCuotas && (
                                    <div className="flex gap-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
                                        <div className="w-32">
                                            <label className="block text-xs text-slate-500 mb-1.5 ml-1">Cuota Actual</label>
                                            <input
                                                type="number"
                                                value={cuotaActual}
                                                onChange={(e) => setCuotaActual(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-xs text-slate-500 mb-1.5 ml-1">Total Cuotas</label>
                                            <input
                                                type="number"
                                                value={totalCuotas}
                                                onChange={(e) => setTotalCuotas(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button type="submit" className="bg-primary hover:bg-primary/90 text-[#131f18] px-6 py-4 rounded-2xl font-bold transition-all shadow-[var(--shadow-glow)] active-scale flex-1 md:flex-none md:min-w-[150px]">
                                        {editingId ? 'Actualizar Gasto' : 'Añadir Gasto'}
                                    </button>
                                    {editingId && (
                                        <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors">
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* EXPENSES TABLE */}
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-200 mb-2">Historial de Gastos</h3>
                        </div>

                        {/* SELECTION ACTION BAR */}
                        <div className={`flex items-center justify-between gap-4 mb-4 bg-indigo-900/40 border border-primary/30 p-3 rounded-xl transition-all duration-300 ${selectedExpenseIds.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none absolute'}`}>
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                                    <CheckCircle size={20} />
                                </div>
                                <span className="text-indigo-200 font-medium text-sm">
                                    <span className="font-bold text-white">{selectedExpenseIds.size}</span> gastos seleccionados
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1.5 text-xs font-medium text-primary hover:text-white hover:bg-primary/20 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="flex items-center gap-2 bg-primary text-[#131f18] px-4 py-2 rounded-xl text-sm font-bold shadow-[var(--shadow-glow)] transition-all active-scale"
                                >
                                    <ArrowRightCircle size={18} />
                                    Copiar Seleccionados
                                </button>
                            </div>
                        </div>

                        {/* SEARCH + CSV TOOLBAR */}
                        <div className="flex gap-3 mb-4">
                            <div className="relative flex-1">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por descripción o categoría..."
                                    className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/5 text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-500 text-base shadow-inner"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={exportToCSV}
                                disabled={!filteredExpenses.length}
                                title="Exportar a CSV"
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-primary rounded-xl border border-primary/20 transition-all font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                <span className="hidden sm:inline">CSV</span>
                            </button>
                        </div>

                        {/* MOBILE CARD VIEW */}
                        <div className="block md:hidden space-y-4">
                            {expenses.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                                    No hay gastos registrados.
                                </div>
                            ) : (
                                displayedExpenses.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                                        {searchQuery ? 'No hay resultados para tu búsqueda.' : 'No hay gastos registrados en este mes.'}
                                    </div>
                                ) : (
                                    displayedExpenses.map((expense) => {
                                        const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                                        const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                                        // Calculate USD amount for display
                                        let montoUsdDisplay = null;
                                        if (expense.currency === 'USD') {
                                            montoUsdDisplay = `USD $${expense.amount.toFixed(2)}`;
                                        } else if (dolarRate) {
                                            montoUsdDisplay = `USD $${(expense.amount / dolarRate).toFixed(2)}`;
                                        }

                                        return (
                                            <div key={expense.id} className={`bg-primary/5 border border-primary/10 rounded-xl p-4 shadow-sm transition-all ${selectedExpenseIds.has(expense.id) ? 'border-primary/50 bg-primary/5' : ''}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedExpenseIds.has(expense.id)}
                                                            onChange={() => toggleExpenseSelection(expense.id)}
                                                            className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-primary cursor-pointer"
                                                        />
                                                        <div>
                                                            <h4 className="font-semibold text-slate-200 text-lg">{expense.description}</h4>
                                                            <p className="text-xs text-slate-500">{new Date(expense.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditExpense(expense)}
                                                            className="text-slate-500 hover:text-primary p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteExpense(expense.id)}
                                                            className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mb-4">
                                                    <div className="bg-white/5 p-2 rounded-lg">
                                                        <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">Monto Total</span>
                                                        <span className="font-medium text-slate-300 tabular-nums">${montoTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="bg-indigo-900/20 p-2 rounded-lg border border-primary/20">
                                                        <span className="text-primary text-[10px] uppercase tracking-wider block mb-0.5">Personal</span>
                                                        <span className="font-bold text-primary tabular-nums">${montoPersonalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {montoUsdDisplay && (
                                                        <div className="col-span-2 flex justify-between items-center border-t border-slate-700 pt-2 mt-1">
                                                            <span className="text-slate-500 text-xs">Equivalente USD</span>
                                                            <span className="text-slate-400 font-mono text-xs">{montoUsdDisplay}</span>
                                                        </div>
                                                    )}
                                                    {expense.is_installment && (
                                                        <div className="col-span-2">
                                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                                <span>Progreso Cuotas</span>
                                                                <span>{expense.current_installment}/{expense.total_installments}</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    style={{ width: `${(expense.current_installment / expense.total_installments) * 100}%` }}
                                                                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    {expense.is_shared ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-cyan-500/10 text-cyan-400 text-xs px-3 py-1.5 rounded-xl font-bold border border-cyan-500/20">Compartido</span>
                                                            {expense.payer_name && <span className="text-[10px] text-slate-400">Pagado por: <span className="text-slate-200 font-medium">{expense.payer_name}</span></span>}
                                                        </div>
                                                    ) : (
                                                        <span className="bg-white/5 text-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold border border-white/10">Personal</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>

                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden md:block bg-primary/5 border border-primary/10 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/80 border-b border-slate-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={displayedExpenses.length > 0 && selectedExpenseIds.size === displayedExpenses.length}
                                                    onChange={handleSelectAll}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-primary cursor-pointer"
                                                />
                                            </th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide">Descripción</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Monto Total (ARS)</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Categoría</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Monto Personal (ARS)</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Ref. USD</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Cuotas</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-center">Tipo</th>
                                            <th scope="col" className="px-6 py-4 font-semibold tracking-wide text-right">Fecha</th>
                                            <th scope="col" className="px-6 py-4 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {displayedExpenses.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                                    {searchQuery ? 'No hay resultados para tu búsqueda.' : 'No hay gastos registrados en este mes.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedExpenses.map((expense, index) => {
                                                const montoTotalArs = expense.currency === 'USD' && dolarRate ? expense.amount * dolarRate : expense.amount;
                                                const montoPersonalArs = expense.is_shared ? montoTotalArs / 2 : montoTotalArs;

                                                // Calculate USD amount for display
                                                let montoUsdDisplay = '-';
                                                if (expense.currency === 'USD') {
                                                    montoUsdDisplay = `$${expense.amount.toFixed(2)}`;
                                                } else if (dolarRate) {
                                                    montoUsdDisplay = `$${(expense.amount / dolarRate).toFixed(2)}`;
                                                }

                                                return (
                                                    <tr key={expense.id} className={`group hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/30'} ${selectedExpenseIds.has(expense.id) ? 'bg-primary/5' : ''}`}>
                                                        <td className="px-6 py-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedExpenseIds.has(expense.id)}
                                                                onChange={() => toggleExpenseSelection(expense.id)}
                                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-primary cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-slate-200">
                                                            {expense.description}
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-300">
                                                            {`$ ${montoTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md text-xs border border-slate-600/50">
                                                                {expense.category || 'General'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums font-semibold text-primary">
                                                            $ {montoPersonalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-500 font-mono text-xs">
                                                            {montoUsdDisplay}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {expense.is_installment ? (
                                                                <div className="w-24 mx-auto">
                                                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                                        <span>{expense.current_installment}/{expense.total_installments}</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                                        <div
                                                                            style={{ width: `${(expense.current_installment / expense.total_installments) * 100}%` }}
                                                                            className={`h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400`}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-slate-600">-</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {expense.is_shared ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="inline-flex items-center justify-center bg-cyan-500/10 text-cyan-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-cyan-500/20 tracking-wide">Shared</span>
                                                                    {expense.payer_name && <span className="text-[9px] text-slate-500 whitespace-nowrap">Por: {expense.payer_name}</span>}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-slate-700 tracking-wide">Personal</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                            {new Date(expense.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`flex justify-end gap-2 transition-opacity opacity-0 group-hover:opacity-100`}>
                                                                <button
                                                                    onClick={() => handleEditExpense(expense)}
                                                                    className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                                    className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div >
    );
}

export default Expenses;
