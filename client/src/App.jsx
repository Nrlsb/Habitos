import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import {
  Plus, Trash2, CheckCircle, Circle, Calendar, Wallet, LogOut,
  Layout, Utensils, Check, ChevronDown, Ban, Activity, Droplets,
  Dumbbell, Heart, Briefcase, BookOpen, Star, Download, X,
  Home, BarChart2, User, ChevronRight, Settings, ShoppingCart
} from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'

import { usePedometer } from './hooks/usePedometer'
import { useActivityDetection } from './hooks/useActivityDetection'
import { ExpensesProvider } from './features/expenses/ExpensesContext'
import { PlanningProvider } from './features/planning/PlanningContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import UpdateChecker from './components/UpdateChecker'
import HabitCoachingBanner from './components/ai/HabitCoachingBanner'

const HabitStats = lazy(() => import('./HabitStats'))
const Expenses = lazy(() => import('./features/expenses/Expenses'))
const DailyExpenses = lazy(() => import('./features/expenses/DailyExpenses'))
const CreditCardsView = lazy(() => import('./features/expenses/CreditCardsView'))
const Planning = lazy(() => import('./features/planning/Planning'))
const Meals = lazy(() => import('./features/meals/Meals'))
const ShoppingList = lazy(() => import('./features/shopping/ShoppingList'))

const LazySpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
)

// Derive icon + color from habit category/title/unit
const getHabitVisuals = (habit) => {
  const title = habit.title?.toLowerCase() || ''
  const unit = habit.unit?.toLowerCase() || ''
  const category = habit.category || 'General'

  if (title.startsWith('sin ') || title.startsWith('no ') || title.includes('alcohol') || title.includes('fumar')) {
    return { IconComp: Ban, colorClass: 'bg-red-500/15 text-red-400' }
  }
  if (unit.includes('paso') || title.includes('caminat') || title.includes('corr') || title.includes('paso')) {
    return { IconComp: Activity, colorClass: 'bg-primary/15 text-primary' }
  }
  if (unit.includes('litro') || unit.includes('ml') || title.includes('agua') || title.includes('hidrat')) {
    return { IconComp: Droplets, colorClass: 'bg-blue-400/15 text-blue-400' }
  }
  if (title.includes('rutina') || title.includes('ejercicio') || title.includes('gym') || title.includes('gimnas') || title.includes('pesas')) {
    return { IconComp: Dumbbell, colorClass: 'bg-amber-400/15 text-amber-400' }
  }
  switch (category) {
    case 'Salud': return { IconComp: Heart, colorClass: 'bg-primary/15 text-primary' }
    case 'Trabajo': return { IconComp: Briefcase, colorClass: 'bg-blue-400/15 text-blue-400' }
    case 'Estudio': return { IconComp: BookOpen, colorClass: 'bg-amber-400/15 text-amber-400' }
    case 'Espiritualidad': return { IconComp: Star, colorClass: 'bg-purple-400/15 text-purple-400' }
    default: return { IconComp: Star, colorClass: 'bg-slate-500/15 text-slate-400' }
  }
}

// ── Dashboard View ──────────────────────────────────────────────────────────
function DashboardView({ habits, loading, toggleHabitDay, setView, setShowAddModal }) {
  const completedCount = habits.filter(h => h.today_state === 'completed').length
  const totalCount = habits.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const circumference = 2 * Math.PI * 26

  const now = new Date()
  const monthName = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <header className="px-5 pt-safe pb-2 mt-3">
        <h1 className="text-[2rem] font-extrabold text-white tracking-tight">Dashboard Principal</h1>
      </header>

      <div className="px-4 pt-3 space-y-5">
        {/* Finance card */}
        <button
          onClick={() => setView('expenses')}
          className="w-full text-left p-5 rounded-[20px] border active-scale"
          style={{ background: 'rgba(46,204,112,0.06)', borderColor: 'rgba(46,204,112,0.18)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm capitalize mb-0.5">{monthName}</p>
              <p className="text-white font-bold text-lg">Mis Finanzas</p>
            </div>
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(46,204,112,0.15)' }}>
              <BarChart2 size={20} className="text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-primary text-sm font-semibold">
            <span>Ver detalles</span>
            <ChevronRight size={15} />
          </div>
        </button>

        {/* Habit completion ring */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center gap-4 px-1">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke="#2ecc70" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct / 100)}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-white font-semibold text-base">{completedCount} de {totalCount} completados</p>
              <p className="text-slate-500 text-sm">Progreso de hoy</p>
            </div>
          </div>
        )}

        {/* Hábitos de hoy */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-white">Hábitos de Hoy</h2>
            <button
              onClick={() => setView('habits')}
              className="text-primary text-sm font-semibold flex items-center gap-0.5 active-scale"
            >
              Ver todos <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-primary/10 rounded-2xl">
              <p className="text-slate-500 text-sm">No hay hábitos. ¡Crea el primero!</p>
              <button
                onClick={() => { setView('habits'); setShowAddModal(true) }}
                className="mt-3 text-primary text-sm font-semibold"
              >
                + Agregar hábito
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {habits.map(habit => {
                const { IconComp, colorClass } = getHabitVisuals(habit)
                const isCompleted = habit.today_state === 'completed'
                return (
                  <div
                    key={habit.id}
                    className={`flex items-center gap-3 p-4 rounded-[18px] border transition-all duration-200 ${isCompleted
                      ? 'border-primary/20'
                      : 'glass-panel border-white/5'
                      }`}
                    style={isCompleted ? { background: 'rgba(46,204,112,0.07)' } : {}}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                      <IconComp size={18} />
                    </div>
                    <p className={`flex-1 font-medium text-[15px] ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {habit.title}
                    </p>
                    <button
                      onClick={(e) => toggleHabitDay(e, habit)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 shrink-0 active-scale ${isCompleted
                        ? 'bg-primary border-primary text-[#131f18]'
                        : 'border-slate-600'
                        }`}
                    >
                      {isCompleted && <Check size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Perfil View ──────────────────────────────────────────────────────────────
function PerfilView({ user, signOut, exportBackupJSON, setView }) {
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'

  const extraViews = [
    { v: 'meals', icon: Utensils, label: 'Comidas', desc: 'Registro y seguimiento de comidas' },
    { v: 'daily-expenses', icon: Calendar, label: 'Diario de Gastos', desc: 'Gastos del día a día' },
    { v: 'credit-cards', icon: Wallet, label: 'Tarjetas', desc: 'Gastos por tarjeta de crédito' },
    { v: 'planning', icon: Layout, label: 'Planificación', desc: 'Plan financiero y presupuestos' },
    { v: 'shopping', icon: ShoppingCart, label: 'Lista del Super', desc: 'Lista de compras del supermercado' },
  ]

  return (
    <div className="flex-1" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
      <header className="px-5 pt-safe pb-2 mt-3">
        <h1 className="text-[2rem] font-extrabold text-white tracking-tight">Perfil</h1>
      </header>

      <div className="px-4 pt-3 space-y-5">
        {/* User card */}
        <div
          className="p-5 rounded-[20px] border flex items-center gap-4"
          style={{ background: 'rgba(46,204,112,0.05)', borderColor: 'rgba(46,204,112,0.14)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(46,204,112,0.18)' }}>
            <span className="text-primary font-extrabold text-xl">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-base truncate">{user?.email}</p>
            <p className="text-slate-500 text-sm mt-0.5">Cuenta activa</p>
          </div>
        </div>

        {/* Extra features */}
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Más funciones</p>
          <div className="space-y-2">
            {extraViews.map(({ v, icon: Icon, label, desc }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="w-full flex items-center gap-4 p-4 rounded-[16px] glass-panel border-white/5 active-scale text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(46,204,112,0.10)' }}>
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-[15px]">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
                <ChevronRight size={18} className="text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Account actions */}
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Cuenta</p>
          <div className="space-y-2">
            <button
              onClick={exportBackupJSON}
              className="w-full flex items-center gap-4 p-4 rounded-[16px] glass-panel border-white/5 active-scale"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Download size={18} className="text-slate-300" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium text-[15px]">Exportar Backup</p>
                <p className="text-slate-500 text-xs mt-0.5">Descargar hábitos en JSON</p>
              </div>
            </button>

            <button
              onClick={signOut}
              className="w-full flex items-center gap-4 p-4 rounded-[16px] active-scale"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.10)' }}>
                <LogOut size={18} className="text-red-400" />
              </div>
              <p className="flex-1 text-left text-red-400 font-medium text-[15px]">Cerrar Sesión</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const getLocalDateString = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const { user, session, loading: authLoading, signOut } = useAuth()
  const [view, setView] = useState('inicio')
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [selectedHabitId, setSelectedHabitId] = useState(null)

  const [habitType, setHabitType] = useState('boolean')
  const [habitGoal, setHabitGoal] = useState('')
  const [habitUnit, setHabitUnit] = useState('')
  const [habitCategory, setHabitCategory] = useState('General')
  const [showAddModal, setShowAddModal] = useState(false)
  const [lastSync, setLastSync] = useState('')
  const [manualDuration, setManualDuration] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // Keep Render server alive (free tier sleeps after 15 min inactivity)
  useEffect(() => {
    const ping = () => fetch(`${API_URL}/ping`).catch(() => { })
    ping()
    const id = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [API_URL])

  const activity = useActivityDetection(session, API_URL)

  const dragIndexRef = useRef(null)

  useEffect(() => {
    if (!authLoading) {
      const hideSplash = async () => {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen')
          await SplashScreen.hide()
        } catch (e) { }
      }
      hideSplash()
    }
  }, [authLoading])

  useEffect(() => {
    const setupDeepLinks = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        CapApp.addListener('appUrlOpen', (event) => {
          const url = new URL(event.url);
          if (url.protocol === 'mishabitos:' && url.host === 'add-expense') {
            setView('expenses');
          }
        });
      } catch (e) { }
    };
    setupDeepLinks();
  }, [view, user])

  useEffect(() => {
    const checkLaunchUrl = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const launchUrl = await CapApp.getLaunchUrl();
        if (launchUrl && launchUrl.url) {
          const url = new URL(launchUrl.url);
          if (url.protocol === 'mishabitos:' && url.host === 'add-expense') {
            setView('expenses');
          }
        }
      } catch (e) { }
    };
    checkLaunchUrl();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const requestNotificationPermission = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        await LocalNotifications.requestPermissions()
      } catch (e) { }
    }
    requestNotificationPermission()
  }, [])

  const scheduleReminderNotification = async (currentHabits) => {
    if (!Capacitor.isNativePlatform()) return
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const allCompleted = currentHabits.every(h => h.today_state === 'completed')
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] })
      if (!allCompleted && currentHabits.length > 0) {
        const now = new Date()
        const reminder = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0)
        if (reminder > now) {
          await LocalNotifications.schedule({
            notifications: [{
              id: 1001,
              title: 'Mis Hábitos',
              body: '¡Todavía tienes hábitos pendientes hoy! 💪',
              schedule: { at: reminder },
              smallIcon: 'ic_stat_icon_config_sample',
              sound: null,
              actionTypeId: '',
              extra: null
            }]
          })
        }
      }
    } catch (e) { }
  }

  useEffect(() => {
    if (session?.user && !authLoading) {
      fetchHabits()
      fetchStatus()
    }
  }, [session, authLoading])

  const fetchStatus = async () => {
    if (!session) return
    try {
      const response = await fetch(`${API_URL}/api/habits/status`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Status API error (${response.status}):`, errorText);
        return;
      }
      const data = await response.json()
      if (data && data.value) setLastSync(data.value)
    } catch (e) {
      console.error('Error fetching status:', e)
    }
  }

  useEffect(() => {
    if (habits.length > 0) {
      scheduleReminderNotification(habits)
    }
  }, [habits])

  usePedometer(habits, setHabits, getLocalDateString, session, API_URL)

  useEffect(() => {
    if (!habits.length || !user) return
    const savedOrder = localStorage.getItem(`habits_order_${user.id}`)
    if (!savedOrder) return
    try {
      const orderIds = JSON.parse(savedOrder)
      const ordered = [...habits].sort((a, b) => {
        const ia = orderIds.indexOf(a.id)
        const ib = orderIds.indexOf(b.id)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      const changed = ordered.some((h, i) => h.id !== habits[i]?.id)
      if (changed) setHabits(ordered)
    } catch (e) { }
  }, [habits.length, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStart = (index) => { dragIndexRef.current = index }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    const reordered = [...habits]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(index, 0, moved)
    dragIndexRef.current = index
    setHabits(reordered)
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    if (user) {
      localStorage.setItem(`habits_order_${user.id}`, JSON.stringify(habits.map(h => h.id)))
    }
  }

  const exportBackupJSON = async () => {
    try {
      const habitsRes = await fetch(`${API_URL}/api/habits?date=${getLocalDateString()}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const habitsData = await habitsRes.json()
      const backup = { exportedAt: new Date().toISOString(), user: user.email, habits: habitsData }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-habitos-backup-${getLocalDateString()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup exportado')
    } catch (e) {
      toast.error('Error al exportar backup')
    }
  }

  const fetchHabits = async () => {
    if (!session) return
    try {
      const response = await fetch(`${API_URL}/api/habits?date=${getLocalDateString()}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await response.json()
      setHabits(data)
    } catch (error) {
      console.error('Error al obtener hábitos:', error)
    } finally {
      setLoading(false)
    }
  }

  const addHabit = async (e) => {
    e.preventDefault()
    if (!newHabitTitle.trim()) return
    try {
      const response = await fetch(`${API_URL}/api/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: newHabitTitle,
          type: habitType,
          goal: habitType === 'counter' ? parseInt(habitGoal) || 0 : 0,
          unit: habitType === 'counter' ? habitUnit : '',
          category: habitCategory
        }),
      })
      if (!response.ok) throw new Error('Error al agregar hábito')
      const newHabit = await response.json()
      setHabits([newHabit, ...habits])
      setNewHabitTitle('')
      setHabitType('boolean')
      setHabitGoal('')
      setHabitUnit('')
      setHabitCategory('General')
      setShowAddModal(false)
      toast.success('Hábito agregado')
    } catch (error) {
      toast.error('No se pudo agregar el hábito')
    }
  }

  const deleteHabit = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este hábito?')) return
    try {
      const response = await fetch(`${API_URL}/api/habits/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!response.ok) throw new Error('Error al eliminar hábito')
      setHabits(habits.filter(h => h.id !== id))
      if (selectedHabitId === id) setSelectedHabitId(null)
      toast.success('Hábito eliminado')
    } catch (error) {
      toast.error('No se pudo eliminar el hábito')
    }
  }

  const toggleHabitDay = async (e, habit) => {
    e.stopPropagation()
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch (e) { }

    const today = getLocalDateString()
    const isCompleted = habit.today_state === 'completed'
    const isCounter = habit.type === 'counter'
    let newStatus = isCompleted ? 'none' : 'completed'
    let newValue = habit.today_value || 0

    if (isCounter) {
      newValue = (habit.today_value || 0) + 1
      newStatus = newValue >= habit.goal ? 'completed' : 'none'
    }

    setHabits(habits.map(h =>
      h.id === habit.id ? { ...h, today_state: newStatus, today_value: newValue } : h
    ))

    try {
      const body = { date: today }
      if (isCounter) {
        body.value = newValue
        body.state = 'completed'
      } else {
        body.state = newStatus
      }
      const response = await fetch(`${API_URL}/api/habits/${habit.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Failed to toggle')
    } catch (error) {
      fetchHabits()
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#131f18] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const navTabs = [
    { v: 'inicio', icon: Home, label: 'Inicio' },
    { v: 'habits', icon: CheckCircle, label: 'Hábitos' },
    { v: 'expenses', icon: BarChart2, label: 'Finanzas' },
    { v: 'perfil', icon: User, label: 'Perfil' },
  ]

  const activeView = selectedHabitId ? 'habits' : (['meals', 'daily-expenses', 'credit-cards', 'planning', 'shopping'].includes(view) ? 'perfil' : view)

  return (
    <div className="h-screen flex flex-col bg-[#131f18] text-slate-100 overflow-hidden">
      <UpdateChecker />

      {/* Content area with bottom padding for nav */}
      <div className="flex-1 w-full overflow-y-auto pb-nav-safe">
        {view === 'inicio' ? (
          <DashboardView
            habits={habits}
            loading={loading}
            toggleHabitDay={toggleHabitDay}
            setView={setView}
            setShowAddModal={setShowAddModal}
          />
        ) : view === 'perfil' ? (
          <PerfilView
            user={user}
            signOut={signOut}
            exportBackupJSON={exportBackupJSON}
            setView={setView}
          />
        ) : view === 'planning' ? (
          <ErrorBoundary>
            <Suspense fallback={<LazySpinner />}>
              <PlanningProvider>
                <Planning />
              </PlanningProvider>
            </Suspense>
          </ErrorBoundary>
        ) : view === 'meals' ? (
          <ErrorBoundary>
            <Suspense fallback={<LazySpinner />}>
              <Meals />
            </Suspense>
          </ErrorBoundary>
        ) : view === 'shopping' ? (
          <ErrorBoundary>
            <Suspense fallback={<LazySpinner />}>
              <ShoppingList />
            </Suspense>
          </ErrorBoundary>
        ) : view === 'expenses' || view === 'daily-expenses' || view === 'credit-cards' ? (
          <ErrorBoundary>
            <Suspense fallback={<LazySpinner />}>
              <ExpensesProvider>
                {view === 'expenses' ? <Expenses /> : view === 'daily-expenses' ? <DailyExpenses /> : <CreditCardsView onBack={() => setView('perfil')} />}
              </ExpensesProvider>
            </Suspense>
          </ErrorBoundary>
        ) : selectedHabitId ? (
          <ErrorBoundary>
            <Suspense fallback={<LazySpinner />}>
              <HabitStats habitId={selectedHabitId} onBack={() => setSelectedHabitId(null)} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          /* ── Habits View ── */
          <>
            {/* Sticky Header */}
            <header className="sticky top-0 z-10 bg-[#131f18]/80 backdrop-blur-xl px-5 pb-4 pt-safe border-b border-white/5">
              <div className="flex items-center justify-between mt-3">
                <div className="flex flex-col">
                  <h1 className="text-[2rem] font-extrabold tracking-tight text-white">Mis Hábitos</h1>
                  {lastSync && (
                    <span className="text-[10px] text-primary/70 font-bold uppercase tracking-widest mt-0.5">
                      Actualizado: {lastSync}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setView('perfil')}
                  className="w-10 h-10 rounded-full glass-panel flex items-center justify-center active-scale"
                  title="Perfil"
                >
                  <Settings size={18} className="text-slate-400" />
                </button>
              </div>
            </header>

            {/* Habits List */}
            <main className="flex-1 px-4 py-4 space-y-3">
              {!loading && habits.length > 0 && (
                <HabitCoachingBanner
                  habits={habits}
                  token={session?.access_token}
                />
              )}
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : habits.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-primary/10 rounded-xl mt-4">
                  <Calendar size={40} className="mx-auto text-primary/30 mb-3" />
                  <h3 className="font-semibold text-slate-300 mb-1">No hay hábitos aún</h3>
                  <p className="text-sm text-slate-500">¡Agrega tu primer hábito arriba!</p>
                </div>
              ) : (
                habits.map((habit, index) => {
                  const { IconComp, colorClass } = getHabitVisuals(habit)
                  const isCompleted = habit.today_state === 'completed'
                  const isCounter = habit.type === 'counter'
                  const pct = isCounter ? Math.min(((habit.today_value || 0) / habit.goal) * 100, 100) : 0
                  const progressColor = colorClass.includes('blue') ? '#60a5fa'
                    : colorClass.includes('amber') ? '#fbbf24'
                      : colorClass.includes('red') ? '#f87171'
                        : colorClass.includes('purple') ? '#c084fc'
                          : '#2ecc70'

                  const isStepHabit = isCounter && habit.unit?.toLowerCase().includes('paso')
                  return isCounter ? (
                    /* Counter habit card */
                    <div
                      key={habit.id}
                      onClick={() => setSelectedHabitId(habit.id)}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative overflow-hidden p-5 rounded-[24px] cursor-pointer active-scale transition-all duration-300 border ${isCompleted
                        ? 'bg-primary/10 border-primary/20 shadow-[var(--shadow-glow)]'
                        : 'glass-panel border-white/5 shadow-glass hover:bg-white/5'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 items-start">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                            <IconComp size={22} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{habit.title}</h3>
                            {habit.category && habit.category !== 'General' && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mt-1">
                                {habit.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className="text-right cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); toggleHabitDay(e, habit) }}
                        >
                          <span className="text-2xl font-bold" style={{ color: progressColor }}>
                            {habit.today_value || 0}
                          </span>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">{habit.unit}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Progreso</span>
                          <span>{habit.today_value || 0} / {habit.goal} {habit.unit}</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all duration-500 relative"
                            style={{ width: `${pct}%`, backgroundColor: progressColor, boxShadow: `0 0 10px ${progressColor}80` }}
                          >
                            <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent to-white/30 rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id) }}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isStepHabit && Capacitor.isNativePlatform() && (
                          <button
                            onClick={(e) => { e.stopPropagation(); activity.isTracking ? activity.stopTracking() : activity.startTracking() }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active-scale ${activity.isTracking ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary/15 text-primary border border-primary/20'}`}
                          >
                            <Activity size={12} />
                            {activity.isTracking ? 'Detener caminata' : 'Iniciar caminata'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Boolean habit card */
                    <div
                      key={habit.id}
                      onClick={() => setSelectedHabitId(habit.id)}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative overflow-hidden p-4 rounded-[24px] flex items-center gap-4 cursor-pointer active-scale transition-all duration-300 border ${isCompleted
                        ? 'bg-primary/10 border-primary/20 shadow-[var(--shadow-glow)]'
                        : 'glass-panel border-white/5 shadow-glass hover:bg-white/5'
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                        <IconComp size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-base ${isCompleted ? 'text-slate-400 line-through' : ''}`}>
                          {habit.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isCompleted ? '¡Completado hoy!' : 'Pendiente hoy'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id) }}
                          className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={(e) => toggleHabitDay(e, habit)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 active-scale shrink-0 ${isCompleted
                            ? 'bg-primary border-primary text-[#131f18] shadow-[var(--shadow-glow)]'
                            : 'border-slate-500 text-transparent hover:border-slate-400'
                            }`}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </main>
          </>
        )}
      </div>

      {/* FAB (Only show in habits view) */}
      {view === 'habits' && !selectedHabitId && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed right-6 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-[var(--shadow-glow-strong)] active-scale z-40 animate-fade-in"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
        >
          <Plus size={30} className="text-[#131f18]" />
        </button>
      )}

      {/* Walking Tracking Modal */}
      {activity.isTracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-[#131f18] border border-primary/30 rounded-[32px] w-full max-w-sm p-8 shadow-[var(--shadow-glow-strong)] text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-glow)]">
                <Activity size={40} className="text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Registrando caminata</h2>
              <p className="text-slate-400 text-sm">Sigue caminando para registrar tu actividad</p>
            </div>

            {/* Timer display */}
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 mb-6">
              <div className="text-5xl font-bold text-primary font-mono">
                {String(Math.floor(activity.elapsedSeconds / 60)).padStart(2, '0')}:
                {String(activity.elapsedSeconds % 60).padStart(2, '0')}
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-2 font-bold">Duración</p>
            </div>

            {/* Manual duration input */}
            <div className="mb-6">
              <label className="block text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">Duración manual (minutos) - Opcional</label>
              <input
                type="number"
                min="0"
                value={manualDuration || ''}
                onChange={(e) => setManualDuration(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Dejar en blanco para usar automático"
                className="w-full bg-white/5 border border-primary/20 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-center"
              />
            </div>

            <button
              onClick={() => {
                activity.stopTracking(manualDuration)
                setManualDuration(null)
              }}
              className="w-full bg-primary hover:bg-primary/90 text-[#131f18] py-4 rounded-2xl font-bold shadow-[var(--shadow-glow)] transition-all active-scale"
            >
              Detener caminata
            </button>
          </div>
        </div>
      )}

      {/* Add Habit Bottom Sheet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)} />
          <div
            className="bg-[#131f18] w-full max-w-md rounded-t-[32px] border-t border-white/10 p-6 animate-slide-up relative z-10 shadow-glass"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Nuevo Hábito</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active-scale"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addHabit} className="space-y-4">
              <input
                type="text"
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                placeholder="¿Qué nuevo hábito quieres comenzar?"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                autoFocus
              />

              <div className="flex p-1 bg-white/5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setHabitType('boolean')}
                  className={`flex-1 text-center py-3 text-sm font-semibold rounded-xl transition-all ${habitType === 'boolean' ? 'bg-primary text-[#131f18] shadow-[var(--shadow-glow)]' : 'text-slate-400'}`}
                >
                  Simple (Sí/No)
                </button>
                <button
                  type="button"
                  onClick={() => setHabitType('counter')}
                  className={`flex-1 text-center py-3 text-sm font-semibold rounded-xl transition-all ${habitType === 'counter' ? 'bg-primary text-[#131f18] shadow-[var(--shadow-glow)]' : 'text-slate-400'}`}
                >
                  Contador
                </button>
              </div>

              <div className="relative">
                <select
                  value={habitCategory}
                  onChange={(e) => setHabitCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-base appearance-none text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                >
                  <option value="General">General</option>
                  <option value="Salud">Salud</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Estudio">Estudio</option>
                  <option value="Espiritualidad">Espiritualidad</option>
                  <option value="Otro">Otro</option>
                </select>
                <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {habitType === 'counter' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 px-1">Meta diaria</label>
                    <input
                      type="number"
                      min="0"
                      value={habitGoal}
                      onChange={(e) => setHabitGoal(e.target.value)}
                      placeholder="Ej. 10000"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 px-1">Unidad</label>
                    <input
                      type="text"
                      value={habitUnit}
                      onChange={(e) => setHabitUnit(e.target.value)}
                      placeholder="Ej. pasos"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!newHabitTitle.trim()}
                className="w-full py-4 mt-2 bg-primary rounded-2xl font-bold text-[#131f18] text-lg disabled:opacity-50 active-scale transition-all hover:shadow-[var(--shadow-glow-strong)]"
              >
                Crear Hábito
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#131f18]/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex justify-around items-stretch h-16">
          {navTabs.map(({ v, icon: Icon, label }) => {
            const isActive = activeView === v
            return (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedHabitId(null) }}
                className="flex flex-col items-center justify-center flex-1 gap-1 min-w-0 active-scale"
              >
                <div className={`flex items-center justify-center w-12 h-8 rounded-2xl transition-all duration-300 ${isActive ? 'bg-primary/15' : ''}`}>
                  <Icon
                    size={22}
                    className={`transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-500'}`}
                  />
                </div>
                <span className={`text-[10px] font-semibold leading-none transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-600'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
