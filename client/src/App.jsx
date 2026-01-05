import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle, Circle, Calendar, Wallet } from 'lucide-react'
import HabitStats from './HabitStats'
import Expenses from './features/expenses/Expenses'
import { ExpensesProvider } from './features/expenses/ExpensesContext'

function App() {
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

  useEffect(() => {
    if (view === 'habits') {
      fetchHabits()
    }
  }, [view])

  const fetchHabits = async () => {
    try {
      const response = await fetch(`${API_URL}/api/habits`)
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
        },
        body: JSON.stringify({
          title: newHabitTitle,
          type: habitType,
          goal: habitType === 'counter' ? parseInt(habitGoal) || 0 : 0,
          unit: habitType === 'counter' ? habitUnit : '',
          category: habitCategory
        }),
      })
      const newHabit = await response.json()
      setHabits([newHabit, ...habits])
      setNewHabitTitle('')
      setHabitType('boolean')
      setHabitGoal('')
      setHabitUnit('')
      setHabitCategory('General')
    } catch (error) {
      console.error('Error al agregar hábito:', error)
    }
  }

  const deleteHabit = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este hábito?')) return

    try {
      await fetch(`${API_URL}/api/habits/${id}`, {
        method: 'DELETE',
      })
      setHabits(habits.filter(h => h.id !== id))
      if (selectedHabitId === id) setSelectedHabitId(null)
    } catch (error) {
      console.error('Error al eliminar hábito:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-12">
        <header className="mb-6 md:mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
            Mis Hábitos & Gastos
          </h1>
          <p className="text-slate-400 text-lg">Construye tu mejor versión, día a día.</p>

          {/* Navigation */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setView('habits')}
              className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${view === 'habits'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
              <CheckCircle size={18} />
              Hábitos
            </button>
            <button
              onClick={() => setView('expenses')}
              className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${view === 'expenses'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
              <Wallet size={18} />
              Gastos
            </button>
          </div>
        </header>

        {view === 'expenses' ? (
          <ExpensesProvider>
            <Expenses />
          </ExpensesProvider>
        ) : selectedHabitId ? (
          <HabitStats habitId={selectedHabitId} onBack={() => setSelectedHabitId(null)} />
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
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                          <Circle size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-slate-200 group-hover:text-white transition-colors">
                              {habit.title}
                            </h3>
                            {habit.category && habit.category !== 'General' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                                {habit.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">Creado el {new Date(habit.created_at).toLocaleDateString('es-ES')}</p>
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

export default App
