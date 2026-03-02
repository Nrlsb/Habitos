import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, CheckCircle, Circle, Calendar, Wallet, LogOut, Layout, Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'
import HabitStats from './HabitStats'
import Expenses from './features/expenses/Expenses'
import DailyExpenses from './features/expenses/DailyExpenses'
import Planning from './features/planning/Planning'
import Meals from './features/meals/Meals'
import { ExpensesProvider } from './features/expenses/ExpensesContext'
import { PlanningProvider } from './features/planning/PlanningContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const getLocalDateString = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const { user, session, loading: authLoading, signOut } = useAuth()
  const [view, setView] = useState('habits') // 'habits' | 'expenses'
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [selectedHabitId, setSelectedHabitId] = useState(null)

  // New state for habit types
  const [habitType, setHabitType] = useState('boolean') // 'boolean' or 'counter'
  const [habitGoal, setHabitGoal] = useState('')
  const [habitUnit, setHabitUnit] = useState('')
  const [habitCategory, setHabitCategory] = useState('General')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // Splash Screen: ocultar cuando auth esté listo
  useEffect(() => {
    if (!authLoading) {
      const hideSplash = async () => {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen')
          await SplashScreen.hide()
        } catch (e) {
          // No disponible en web, ignorar
        }
      }
      hideSplash()
    }
  }, [authLoading])

  useEffect(() => {
    // Escuchar Deep Links de Capacitor (ej: desde el Widget)
    const setupDeepLinks = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        CapApp.addListener('appUrlOpen', (event) => {
          const url = new URL(event.url);
          if (url.protocol === 'mishabitos:' && url.host === 'add-expense') {
            setView('expenses');
          }
        });
      } catch (e) {
        console.log('Capacitor not available or error setting up deep links');
      }
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
      } catch (e) {
        console.log('Error checking launch URL', e);
      }
    };
    checkLaunchUrl();
  }, []);

  // Notificaciones locales: pedir permiso al iniciar en nativo
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const requestNotificationPermission = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        await LocalNotifications.requestPermissions()
      } catch (e) {
        console.log('Local notifications not available', e)
      }
    }
    requestNotificationPermission()
  }, [])

  // Programar notificación de recordatorio a las 21:00 si hay hábitos sin completar
  const scheduleReminderNotification = async (currentHabits) => {
    if (!Capacitor.isNativePlatform()) return
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const allCompleted = currentHabits.every(h => h.today_state === 'completed')

      // Cancelar notificación previa
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] })

      if (!allCompleted && currentHabits.length > 0) {
        const now = new Date()
        const reminder = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0)
        // Si ya pasaron las 21:00, no programar para hoy
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
    } catch (e) {
      console.log('Error scheduling notification', e)
    }
  }

  // Efecto para cargar hábitos al iniciar
  useEffect(() => {
    if (session?.user && !authLoading) {
      fetchHabits()
    }
  }, [session, authLoading])

  // Reprogramar notificación cuando cambien los hábitos
  useEffect(() => {
    if (habits.length > 0) {
      scheduleReminderNotification(habits)
    }
  }, [habits])

  // Efecto para el Podómetro — implementación robusta con polling y baseline diario
  useEffect(() => {
    const stepHabitIds = habits
      .filter(h => h.type === 'counter' && h.unit?.toLowerCase().includes('pasos'))
      .map(h => h.id)

    if (stepHabitIds.length === 0) return

    let intervalId = null

    const setupPedometer = async () => {
      try {
        const { Pedometer } = await import('@capgo/capacitor-pedometer')

        // Pedir permiso ACTIVITY_RECOGNITION
        try {
          await Pedometer.requestPermission?.()
        } catch (e) {
          console.log('requestPermission not available or already granted', e)
        }

        const today = getLocalDateString()
        const STORAGE_KEY = 'pedometer_baseline'

        // Leer o inicializar baseline del día
        let baselineData = null
        try {
          const stored = localStorage.getItem(STORAGE_KEY)
          if (stored) baselineData = JSON.parse(stored)
        } catch (e) { /* ignore */ }

        // Función de polling
        const poll = async () => {
          try {
            const result = await Pedometer.getStepCount()
            const currentCount = result?.count ?? result?.steps ?? 0

            // Verificar si es un nuevo día
            const storedToday = baselineData?.date === today
            if (!storedToday) {
              // Nuevo día: establecer baseline
              baselineData = { date: today, baseline: currentCount }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(baselineData))
            }

            const delta = Math.max(0, currentCount - (baselineData?.baseline ?? currentCount))

            setHabits(prev => prev.map(h => {
              if (h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')) {
                if (h.today_value === delta) return h // sin cambio
                return {
                  ...h,
                  today_value: delta,
                  today_state: delta >= h.goal ? 'completed' : 'none'
                }
              }
              return h
            }))
          } catch (e) {
            console.error('Error polling steps', e)
          }
        }

        await poll() // Primera lectura inmediata
        intervalId = setInterval(poll, 10000) // Polling cada 10 segundos
      } catch (e) {
        console.error('Pedometer not available', e)
      }
    }

    setupPedometer()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [habits.filter(h => h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')).map(h => h.id).join(',')])


  const fetchHabits = async () => {
    if (!session) return
    try {
      const response = await fetch(`${API_URL}/api/habits?date=${getLocalDateString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
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
      toast.success('Hábito agregado')
    } catch (error) {
      console.error('Error al agregar hábito:', error)
      toast.error('No se pudo agregar el hábito')
    }
  }

  const deleteHabit = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este hábito?')) return

    try {
      const response = await fetch(`${API_URL}/api/habits/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!response.ok) throw new Error('Error al eliminar hábito')
      setHabits(habits.filter(h => h.id !== id))
      if (selectedHabitId === id) setSelectedHabitId(null)
      toast.success('Hábito eliminado')
    } catch (error) {
      console.error('Error al eliminar hábito:', error)
      toast.error('No se pudo eliminar el hábito')
    }
  }

  const toggleHabitDay = async (e, habit) => {
    e.stopPropagation()

    // Haptic feedback en Android
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch (e) {
      // No disponible en web, ignorar
    }

    const today = getLocalDateString()

    // Optimistic Update
    const isCompleted = habit.today_state === 'completed'
    const isCounter = habit.type === 'counter'

    let newStatus = isCompleted ? 'none' : 'completed'
    let newValue = habit.today_value || 0

    if (isCounter) {
      newValue = (habit.today_value || 0) + 1
      newStatus = newValue >= habit.goal ? 'completed' : 'none'
    }

    // Update local state immediately
    setHabits(habits.map(h =>
      h.id === habit.id
        ? { ...h, today_state: newStatus, today_value: newValue }
        : h
    ))

    try {
      const body = { date: today }
      if (isCounter) {
        body.value = newValue
        body.state = 'completed' // Always mark active
      } else {
        body.state = newStatus
      }

      const response = await fetch(`${API_URL}/api/habits/${habit.id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to toggle')

    } catch (error) {
      console.error('Error toggling habit:', error)
      // Revert on error
      fetchHabits()
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Gradients/Blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
      </div>

      <div className={`mx-auto px-4 py-8 md:py-12 relative z-10 transition-all duration-300 ${view === 'expenses' ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <header className="mb-6 md:mb-10 text-center relative">
          <div className="absolute top-0 right-0">
            <button
              onClick={signOut}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
            Mis Hábitos & Gastos
          </h1>
          <p className="text-slate-400 text-lg">Construye tu mejor versión, día a día.</p>

          {/* Navigation */}
          <div className="flex justify-start md:justify-center gap-2 md:gap-3 mt-6 md:mt-8 bg-slate-900/50 p-1.5 rounded-full border border-slate-800 backdrop-blur-sm w-full md:w-fit mx-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setView('habits')}
              className={`shrink-0 px-4 md:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 font-medium whitespace-nowrap ${view === 'habits'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <CheckCircle size={18} />
              Hábitos
            </button>
            <button
              onClick={() => setView('meals')}
              className={`shrink-0 px-4 md:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 font-medium whitespace-nowrap ${view === 'meals'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <Utensils size={18} />
              Comidas
            </button>
            <button
              onClick={() => setView('expenses')}
              className={`shrink-0 px-4 md:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 font-medium whitespace-nowrap ${view === 'expenses'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <Wallet size={18} />
              Gastos
            </button>
            <button
              onClick={() => setView('daily-expenses')}
              className={`shrink-0 px-4 md:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 font-medium whitespace-nowrap ${view === 'daily-expenses'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <Calendar size={18} />
              Diario
            </button>
            <button
              onClick={() => setView('planning')}
              className={`shrink-0 px-4 md:px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 font-medium whitespace-nowrap ${view === 'planning'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <Layout size={18} />
              Planificación
            </button>
          </div>
        </header>

        {view === 'planning' ? (
          <ErrorBoundary>
            <PlanningProvider>
              <Planning />
            </PlanningProvider>
          </ErrorBoundary>
        ) : view === 'meals' ? (
          <ErrorBoundary>
            <Meals />
          </ErrorBoundary>
        ) : view === 'expenses' || view === 'daily-expenses' ? (
          <ErrorBoundary>
            <ExpensesProvider>
              {view === 'expenses' ? <Expenses /> : <DailyExpenses />}
            </ExpensesProvider>
          </ErrorBoundary>
        ) : selectedHabitId ? (
          <ErrorBoundary>
            <HabitStats habitId={selectedHabitId} onBack={() => setSelectedHabitId(null)} />
          </ErrorBoundary>
        ) : (
          <>
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6 mb-8">
              <form onSubmit={addHabit} className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newHabitTitle}
                    onChange={(e) => setNewHabitTitle(e.target.value)}
                    placeholder="¿Qué nuevo hábito quieres comenzar?"
                    className="flex-1 bg-slate-900/50 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!newHabitTitle.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    <Plus size={20} />
                    <span className="hidden sm:inline">Agregar</span>
                  </button>
                </div>

                <div className="flex gap-4 items-center text-sm text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="habitType"
                      checked={habitType === 'boolean'}
                      onChange={() => setHabitType('boolean')}
                      className="text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span>Simple (Sí/No)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="habitType"
                      checked={habitType === 'counter'}
                      onChange={() => setHabitType('counter')}
                      className="text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span>Contador (Pasos, Litros...)</span>
                  </label>

                  <select
                    value={habitCategory}
                    onChange={(e) => setHabitCategory(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="Salud">Salud 🍎</option>
                    <option value="Trabajo">Trabajo 💼</option>
                    <option value="Estudio">Estudio 📚</option>
                    <option value="Espiritualidad">Espiritualidad 🧘</option>
                    <option value="Otro">Otro ⚡</option>
                  </select>
                </div>

                {habitType === 'counter' && (
                  <div className="flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">Meta Diaria</label>
                      <input
                        type="number"
                        min="0"
                        value={habitGoal}
                        onChange={(e) => setHabitGoal(e.target.value)}
                        placeholder="Ej. 10000"
                        className="w-full bg-slate-900/50 border border-slate-700 text-slate-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">Unidad</label>
                      <input
                        type="text"
                        value={habitUnit}
                        onChange={(e) => setHabitUnit(e.target.value)}
                        placeholder="Ej. pasos"
                        className="w-full bg-slate-900/50 border border-slate-700 text-slate-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                  <p className="text-slate-400">Cargando tus hábitos...</p>
                </div>
              ) : habits.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/30 border-dashed">
                  <Calendar size={48} className="mx-auto text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">No hay hábitos aún</h3>
                  <p className="text-slate-500">¡Comienza agregando tu primer objetivo arriba!</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {habits.map((habit) => (
                    <li
                      key={habit.id}
                      onClick={() => setSelectedHabitId(habit.id)}
                      className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:shadow-lg hover:border-slate-600 hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Status Icon / Button */}
                        <div onClick={(e) => toggleHabitDay(e, habit)}>
                          {habit.type === 'counter' ? (
                            <div className="flex flex-col items-center justify-center w-12 cursor-pointer group/counter">
                              <div className="text-[10px] text-indigo-300 font-bold mb-0.5">
                                {habit.today_value || 0}
                              </div>
                              <div className="h-8 w-8 rounded-full bg-slate-700/50 border border-slate-600 relative overflow-hidden group-hover/counter:border-indigo-500/50 transition-colors">
                                <div
                                  className="absolute bottom-0 left-0 w-full bg-indigo-500 transition-all duration-300"
                                  style={{ height: `${Math.min(((habit.today_value || 0) / habit.goal) * 100, 100)}%` }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/counter:opacity-100 transition-opacity bg-black/20 text-white font-bold text-lg">
                                  +
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${habit.today_state === 'completed'
                                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20 scale-105'
                                : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300 border border-slate-600 hover:border-slate-500'
                                }`}
                            >
                              {habit.today_state === 'completed' ? <CheckCircle size={22} /> : <Circle size={22} />}
                            </button>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-lg font-medium transition-colors truncate ${habit.today_state === 'completed' && habit.type !== 'counter' ? 'text-green-100/70 line-through decoration-green-500/30' : 'text-slate-200 group-hover:text-white'}`}>
                              {habit.title}
                            </h3>
                            {habit.category && habit.category !== 'General' && (
                              <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                                {habit.category}
                              </span>
                            )}
                          </div>
                          {habit.type === 'counter' && (
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(((habit.today_value || 0) / habit.goal) * 100, 100)}%` }}
                              ></div>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-slate-500">
                              {habit.type === 'counter'
                                ? `${habit.today_value || 0} / ${habit.goal} ${habit.unit}`
                                : (habit.today_state === 'completed' ? '¡Completado hoy!' : 'Pendiente hoy')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteHabit(habit.id)
                        }}
                        className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 opacity-100"
                        title="Eliminar hábito"
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
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
