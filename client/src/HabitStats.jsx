import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { ArrowLeft, Calendar as CalendarIcon, Trophy, Flame, CheckCircle, Settings, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Calendar from './Calendar'

function HabitStats({ habitId, onBack }) {
    const [habit, setHabit] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(null)
    const [inputValue, setInputValue] = useState('')
    const [mounted, setMounted] = useState(false)

    const [userHeight, setUserHeight] = useState(() => localStorage.getItem('userHeight') || '170')
    const [showHeightSettings, setShowHeightSettings] = useState(false)
    const { session } = useAuth()

    useEffect(() => {
        if (userHeight) localStorage.setItem('userHeight', userHeight)
    }, [userHeight])

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 500) // Delay chart render to avoid width(-1) warning
        return () => clearTimeout(timer)
    }, [])

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

    useEffect(() => {
        if (session) {
            fetchHabitDetails()
        }
    }, [habitId, session])

    const fetchHabitDetails = async () => {
        try {
            const response = await fetch(`${API_URL}/api/habits/${habitId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            const data = await response.json()
            setHabit(data)
        } catch (error) {
            console.error('Error fetching habit details:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (completions) => {
        if (!completions || completions.length === 0) return { currentStreak: 0, longestStreak: 0 }

        // Extract date strings if completions are objects
        const dateStrings = completions.map(c => c.completed_date || c)
        const sortedDates = [...dateStrings].sort((a, b) => new Date(b) - new Date(a))
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Current Streak
        let currentStreak = 0
        let checkDate = new Date(today)

        // Check if completed today
        const todayStr = checkDate.toISOString().split('T')[0]
        if (sortedDates.includes(todayStr)) {
            currentStreak++
            checkDate.setDate(checkDate.getDate() - 1)
        } else {
            // If not today, check yesterday (streak might still be active if just missed today)
            checkDate.setDate(checkDate.getDate() - 1)
            const yesterdayStr = checkDate.toISOString().split('T')[0]
            if (!sortedDates.includes(yesterdayStr)) {
                currentStreak = 0
            }
        }

        // Continue counting backwards
        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0]
            if (sortedDates.includes(dateStr)) {
                // If we haven't counted this day yet (e.g. if we started from yesterday)
                if (dateStr !== todayStr) {
                    currentStreak++
                }
                checkDate.setDate(checkDate.getDate() - 1)
            } else {
                break
            }
        }

        // Longest Streak
        let longestStreak = 0
        let tempStreak = 0
        if (sortedDates.length > 0) {
            tempStreak = 1
            longestStreak = 1
            for (let i = 0; i < sortedDates.length - 1; i++) {
                const curr = new Date(sortedDates[i])
                const next = new Date(sortedDates[i + 1])
                const diffTime = Math.abs(curr - next)
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                if (diffDays === 1) {
                    tempStreak++
                } else {
                    tempStreak = 1
                }
                if (tempStreak > longestStreak) longestStreak = tempStreak
            }
        }

        return { currentStreak, longestStreak }
    }

    const calculateCompletionRate = (completions, days) => {
        if (!completions || completions.length === 0) return 0
        const now = new Date()
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - days)

        const count = completions.filter(c => {
            const d = new Date(c.completed_date || c)
            return d >= cutoff && d <= now
        }).length

        return Math.round((count / days) * 100)
    }

    const calculateDayOfWeekStats = (successfulComps, allComps, type) => {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

        // If Counter: Use ALL completions (effort) to calculate Average Value
        if (type === 'counter') {
            const totals = new Array(7).fill(0)
            const counts = new Array(7).fill(0)

            allComps.forEach(c => {
                const date = new Date(c.completed_date || c)
                const dayIndex = date.getDay()
                totals[dayIndex] += (c.value || 0)
                counts[dayIndex]++
            })

            return days.map((day, index) => ({
                name: day,
                value: counts[index] > 0 ? Math.round(totals[index] / counts[index]) : 0,
                tooltip: 'Promedio'
            }))
        }

        // If Boolean: Use SUCCESSFUL completions to calculate Frequency
        const stats = new Array(7).fill(0)
        successfulComps.forEach(c => {
            const date = new Date(c.completed_date || c)
            stats[date.getDay()]++
        })

        return days.map((day, index) => ({
            name: day,
            value: stats[index],
            tooltip: 'Completados'
        }))
    }

    const calculateMonthlyStats = (completions) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const currentYear = new Date().getFullYear()

        // Initialize with all months
        const stats = months.map(m => ({ name: m, count: 0 }))

        completions.forEach(c => {
            const date = new Date(c.completed_date || c)
            if (date.getFullYear() === currentYear) {
                stats[date.getMonth()].count++
            }
        })

        return stats
    }

    const calculateComparison = (completions, days) => {
        const now = new Date()
        const currentStart = new Date(now)
        currentStart.setDate(now.getDate() - days)

        const previousStart = new Date(currentStart)
        previousStart.setDate(previousStart.getDate() - days)

        const currentPeriod = completions.filter(c => {
            const d = new Date(c.completed_date || c)
            return d >= currentStart && d <= now
        })

        const previousPeriod = completions.filter(c => {
            const d = new Date(c.completed_date || c)
            return d >= previousStart && d < currentStart
        })

        // Metric: Sum of values for counter, Count for boolean
        const getMetric = (arr) => {
            if (habit.type === 'counter') return arr.reduce((acc, curr) => acc + (curr.value || 0), 0)
            return arr.length
        }

        const currentMetric = getMetric(currentPeriod)
        const previousMetric = getMetric(previousPeriod)

        if (previousMetric === 0) return { change: 100, trend: 'up', infinite: true }

        const change = ((currentMetric - previousMetric) / previousMetric) * 100
        return {
            change: Math.abs(Math.round(change)),
            trend: change > 0 ? 'up' : change < 0 ? 'down' : 'equal',
            value: change
        }
    }

    const calculatePersonalRecord = (completions) => {
        if (habit.type !== 'counter' || !completions.length) return null
        const max = completions.reduce((prev, current) => (prev.value || 0) > (current.value || 0) ? prev : current, { value: 0 })
        return {
            value: max.value,
            date: max.completed_date
        }
    }

    const calculateProjection = (completions) => {
        const now = new Date()
        const startOfYear = new Date(now.getFullYear(), 0, 1)
        const daysPassed = Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24)) || 1

        let currentTotal = 0
        if (habit.type === 'counter') {
            currentTotal = completions.filter(c => new Date(c.completed_date || c).getFullYear() === now.getFullYear())
                .reduce((acc, curr) => acc + (curr.value || 0), 0)
        } else {
            currentTotal = completions.filter(c => new Date(c.completed_date || c).getFullYear() === now.getFullYear()).length
        }

        const dailyAvg = currentTotal / daysPassed
        const daysRemaining = 365 - daysPassed
        const projectedAdditional = dailyAvg * daysRemaining

        return {
            total: Math.round(currentTotal + projectedAdditional),
            avg: dailyAvg.toFixed(1)
        }
    }

    const isStepHabit = habit?.unit?.toLowerCase().includes('paso') || habit?.unit?.toLowerCase().includes('step')

    const calculateKm = (steps) => {
        if (!steps || !userHeight) return 0
        // Formula: Steps * (Height(cm) * 0.414) = Distance(cm)
        const strideCm = parseInt(userHeight) * 0.414
        const distanceKm = (steps * strideCm) / 100000
        return distanceKm.toFixed(2)
    }

    const calculateHeatmapData = (completions) => {
        const year = new Date().getFullYear()
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 31)
        const days = []
        let current = new Date(start)

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0]
            const completion = completions.find(c => (c.completed_date || c) === dateStr)

            let level = 0
            if (completion) {
                if (habit.type === 'counter') {
                    // Normalize intensity 1-4 based on goal
                    const val = completion.value || 0
                    if (val >= habit.goal) level = 4
                    else if (val >= habit.goal * 0.75) level = 3
                    else if (val >= habit.goal * 0.5) level = 2
                    else if (val > 0) level = 1
                } else {
                    level = completion.state === 'completed' ? 4 : 0
                }
            }

            days.push({ date: dateStr, level })
            current.setDate(current.getDate() + 1)
        }
        return days
    }

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
    )

    if (!habit) return <div className="text-center text-slate-400 py-12">No se encontró el hábito</div>
    if (habit.error) return <div className="text-center text-red-400 py-12">Error: {habit.error}</div>
    if (!habit.completions) return <div className="text-center text-slate-400 py-12">No se pudieron cargar los datos</div>

    const getSuccessfulCompletions = () => {
        if (!habit || !habit.completions) return []
        return habit.completions.filter(c => {
            if (habit.type === 'counter') {
                return (c.value || 0) >= (habit.goal || 0)
            }
            return (c.state || 'completed') === 'completed'
        })
    }

    const successfulCompletions = getSuccessfulCompletions()
    const { currentStreak, longestStreak } = calculateStats(successfulCompletions)

    const handleDateClick = (date) => {
        setSelectedDate(date)
        const existingCompletion = habit.completions.find(c => (c.completed_date || c) === date)
        if (habit.type === 'counter') {
            setInputValue(existingCompletion ? existingCompletion.value : '')
        }
    }

    const handleSaveCompletion = async () => {
        if (!selectedDate) return

        let method = 'POST'
        let body = { date: selectedDate }

        // Ensure completion endpoints are correct based on backend implementation
        // Assuming POST /api/habits/:id/completion to toggle/add
        // For 'counter' type, we need to send the value

        if (habit.type === 'counter') {
            body.value = parseInt(inputValue)
        }

        try {
            const response = await fetch(`${API_URL}/api/habits/${habitId}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            })

            if (response.ok) {
                fetchHabitDetails()
                setSelectedDate(null)
                setInputValue('')
            } else {
                console.error('Failed to save completion')
            }
        } catch (error) {
            console.error('Error saving completion:', error)
        }
    }

    // Prepare chart data
    const chartData = habit.completions
        .map(c => ({
            date: new Date(c.completed_date || c).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            fullDate: c.completed_date || c,
            value: c.value || 0
        }))
        .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate))
        .slice(-30) // Last 30 entries

    // Calculate Advanced Stats
    const stats7 = calculateComparison(habit.completions, 7) // Use ALL completions for volume comparison
    const stats30 = calculateComparison(habit.completions, 30)
    const personalRecord = calculatePersonalRecord(habit.completions)
    const projection = calculateProjection(habit.completions)
    const heatmapData = calculateHeatmapData(habit.completions)

    const renderTrend = (stat) => {
        if (stat.trend === 'equal') return <div className="flex items-center text-slate-400 text-xs mt-1"><Minus size={12} className="mr-1" /> 0% vs prev</div>
        const Color = stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
        const Icon = stat.trend === 'up' ? TrendingUp : TrendingDown
        return (
            <div className={`flex items-center ${Color} text-xs mt-1`}>
                <Icon size={12} className="mr-1" />
                {stat.infinite ? 'N/A' : `${stat.change}%`} vs prev
            </div>
        )
    }



    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group"
            >
                <div className="p-2 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors">
                    <ArrowLeft size={20} />
                </div>
                <span className="font-medium">Volver a mis hábitos</span>
            </button>

            <header className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">{habit.title}</h2>
                        <div className="flex items-center gap-2 mb-2">
                            {habit.category && habit.category !== 'General' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {habit.category}
                                </span>
                            )}
                            <p className="text-slate-400">{habit.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                    {isStepHabit && (
                        <div className="relative">
                            <button
                                onClick={() => setShowHeightSettings(!showHeightSettings)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                                title="Configurar altura para cálculo de Km"
                            >
                                <Settings size={20} />
                            </button>
                            {showHeightSettings && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-4 z-20 animate-in fade-in zoom-in-50 duration-200">
                                    <label className="block text-xs text-slate-400 mb-2">Tu altura (cm)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={userHeight}
                                            onChange={(e) => setUserHeight(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="170"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">Usado para estimar Km</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {habit.type === 'counter' && (
                    <div className="inline-block bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm font-medium border border-slate-700">
                        Meta: {habit.goal} {habit.unit} / día
                    </div>
                )}
                <p className="text-sm text-slate-500 mt-2">Creado el {new Date(habit.created_at).toLocaleDateString('es-ES')}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                        <CheckCircle size={24} />
                    </div>
                    <span className="text-3xl font-bold text-white mb-1">{successfulCompletions.length}</span>
                    <span className="text-sm text-slate-400">Total Completado</span>
                    {isStepHabit && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 w-full text-center">
                            <span className="text-indigo-400 font-medium text-lg">
                                {calculateKm(habit.completions.reduce((acc, curr) => acc + (curr.value || 0), 0))}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">Km Totales</span>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 mb-3">
                        <Trophy size={24} />
                    </div>
                    <span className="text-3xl font-bold text-white mb-1">{longestStreak}</span>
                    <span className="text-sm text-slate-400">Mejor Racha (días)</span>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-3">
                        <Flame size={24} />
                    </div>
                    <span className="text-3xl font-bold text-white mb-1">{calculateCompletionRate(successfulCompletions, 7)}%</span>
                    <span className="text-sm text-slate-400">Últimos 7 días</span>
                    {renderTrend(stats7)}
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                        <CalendarIcon size={24} />
                    </div>
                    <span className="text-3xl font-bold text-white mb-1">{calculateCompletionRate(successfulCompletions, 30)}%</span>
                    <span className="text-sm text-slate-400">Últimos 30 días</span>
                    {renderTrend(stats30)}
                </div>

                {habit.type === 'counter' && personalRecord && (
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                        <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                            <Trophy size={24} />
                        </div>
                        <span className="text-2xl font-bold text-white mb-1">{personalRecord.value}</span>
                        <div className="flex flex-col">
                            <span className="text-sm text-slate-400">Récord Personal</span>
                            <span className="text-[10px] text-slate-500">{new Date(personalRecord.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        </div>
                    </div>
                )}

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800/60 transition-colors">
                    <div className="h-12 w-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 mb-3">
                        <TrendingUp size={24} />
                    </div>
                    <span className="text-2xl font-bold text-white mb-1">{projection.total}</span>
                    <span className="text-sm text-slate-400">Proyección {new Date().getFullYear()}</span>
                    <span className="text-[10px] text-slate-500">Basado en prom. {projection.avg}/día</span>
                </div>
            </div>

            {/* Heatmap Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl overflow-x-auto">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Consistencia Anual</h3>
                <div className="flex gap-1 min-w-max pb-2">
                    <div className="grid grid-rows-7 grid-flow-col gap-1">
                        {heatmapData.map((day) => {
                            let color = 'bg-slate-800'
                            if (day.level === 1) color = 'bg-green-900/40' // very low
                            if (day.level === 2) color = 'bg-green-700/60' // low
                            if (day.level === 3) color = 'bg-green-500/80' // medium
                            if (day.level === 4) color = 'bg-green-400'    // high

                            return (
                                <div
                                    key={day.date}
                                    className={`w-3 h-3 rounded-sm ${color}`}
                                    title={`${day.date}: ${day.level > 0 ? 'Activo' : 'Sin actividad'}`}
                                ></div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Analytics Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Day of Week Chart */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Día más Productivo</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={calculateDayOfWeekStats(successfulCompletions, habit.completions, habit.type)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    formatter={(value, name, props) => [value, props.payload.tooltip]}
                                />
                                <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} name={habit.type === 'counter' ? 'Promedio' : 'Completados'} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Chart */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Progreso Mensual ({new Date().getFullYear()})</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={calculateMonthlyStats(successfulCompletions)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                />
                                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Completados" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {habit.type === 'counter' && chartData.length > 0 && mounted && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Progreso Reciente</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                    itemStyle={{ color: '#818cf8' }}
                                    cursor={{ stroke: '#4f46e5', strokeWidth: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#818cf8' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <Calendar
                completions={habit.completions}
                onDateClick={handleDateClick}
                habitType={habit.type}
                habitGoal={habit.goal}
            />

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <CalendarIcon size={20} className="text-indigo-400" />
                    Historial Reciente
                </h3>
                {habit.completions.length === 0 ? (
                    <p className="text-slate-500 italic">No hay actividad registrada aún.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {habit.completions.slice(0, 30).map(completion => (
                            <div key={completion.completed_date || completion} className="bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-lg text-sm border border-indigo-500/20">
                                {new Date(completion.completed_date || completion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                {habit.type === 'counter' && completion.value > 0 && (
                                    <span className="ml-2 text-xs opacity-70">
                                        ({completion.value} {isStepHabit && `• ${calculateKm(completion.value)} km`})
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Modal for adding/editing completion */}
            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h3>

                        {habit.type === 'counter' ? (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Cantidad ({habit.unit})
                                </label>
                                <input
                                    type="number"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    placeholder={`Meta: ${habit.goal}`}
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <p className="text-slate-300 mb-6">
                                ¿Marcaste este hábito como completado?
                            </p>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedDate(null)}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCompletion}
                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/25"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default HabitStats
