import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function Calendar({ completions, onDateClick, habitType, habitGoal }) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const getDaysInMonth = (date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const days = new Date(year, month + 1, 0).getDate()
        const firstDay = new Date(year, month, 1).getDay()
        return { days, firstDay }
    }

    const { days, firstDay } = getDaysInMonth(currentDate)

    // Adjust firstDay to start on Monday (0 = Monday, 6 = Sunday)
    // Standard JS getDay(): 0 = Sunday, 1 = Monday...
    // We want Monday as first column.
    const startDay = firstDay === 0 ? 6 : firstDay - 1

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const getDayState = (day) => {
        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0]
        const completion = completions.find(c => c.completed_date === dateStr)

        if (completion) return completion.state || 'completed' // Default to completed if state missing

        // Check if past
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (checkDate < today) return 'missed'
        return 'none'
    }

    const handleDayClick = (day) => {
        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0]
        onDateClick(dateStr)
    }

    const renderDays = () => {
        const daysArray = []

        // Empty slots for previous month
        for (let i = 0; i < startDay; i++) {
            daysArray.push(<div key={`empty-${i}`} className="h-10 w-10"></div>)
        }

        // Days of current month
        for (let i = 1; i <= days; i++) {
            const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toISOString().split('T')[0]
            const completion = completions.find(c => (c.completed_date || c) === dateStr)

            let state = 'none'
            let value = null

            const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const isPast = checkDate < today
            const isToday = checkDate.getTime() === today.getTime()

            if (completion) {
                value = completion.value
                if (habitType === 'counter') {
                    if (value >= habitGoal) {
                        state = 'completed'
                    } else {
                        // If it has value but less than goal, and it's past or today, show as missed/incomplete
                        // Unless user wants it green only if completed. User said: "solo aparesca en verde si se completo... de lo contrario rojo"
                        state = 'missed'
                    }
                } else {
                    state = completion.state || 'completed'
                }
            } else {
                if (isPast) state = 'missed'
            }

            let bgColor = 'bg-slate-800'
            let borderColor = 'border-slate-700'
            let textColor = 'text-slate-300'

            if (state === 'completed') {
                bgColor = 'bg-green-500/20'
                borderColor = 'border-green-500/50'
                textColor = 'text-green-400'
            } else if (state === 'missed' || state === 'failed') {
                bgColor = 'bg-red-500/10'
                borderColor = 'border-red-500/30'
                textColor = 'text-red-400'
            }

            daysArray.push(
                <button
                    key={i}
                    onClick={() => handleDayClick(i)}
                    className={`h-10 w-10 rounded-lg flex flex-col items-center justify-center text-sm font-medium border transition-all hover:scale-110 ${bgColor} ${borderColor} ${textColor} relative overflow-hidden`}
                >
                    <span className="z-10">{i}</span>
                    {value > 0 && (
                        <span className="text-[0.6rem] leading-none opacity-80 z-10">{value}</span>
                    )}
                </button>
            )
        }

        return daysArray
    }

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-200 capitalize">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                    <div key={index} className="text-xs font-medium text-slate-500 h-8 flex items-center justify-center">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {renderDays()}
            </div>

            <div className="mt-6 flex gap-4 justify-center text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    <span>Completado</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/10 border border-red-500/30"></div>
                    <span>No cumplido</span>
                </div>
            </div>
        </div>
    )
}

export default Calendar
