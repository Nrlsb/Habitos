import { useEffect, useRef } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

// Puente con StepCounterService (nativo Android)
const StepService = registerPlugin('StepService')

/**
 * Hook que integra el pedómetro nativo con la lista de hábitos.
 * En Android usa StepCounterService (foreground service) para contar pasos
 * incluso con la app en segundo plano. Los pasos se guardan en SharedPreferences
 * y se leen mediante polling cada 30 segundos.
 *
 * Detección: un hábito se considera "de pasos" si type === 'counter'
 * y su unit contiene la palabra "pasos" (case-insensitive).
 *
 * @param {Array} habits - Lista de hábitos del estado
 * @param {Function} setHabits - Setter del estado de hábitos
 * @param {Function} getLocalDateString - Función que retorna la fecha local YYYY-MM-DD
 */
export function usePedometer(habits, setHabits, getLocalDateString) {
  const stepHabitKey = habits
    .filter(h => h.type === 'counter' && h.unit?.toLowerCase().includes('pasos'))
    .map(h => h.id)
    .join(',')

  const pollRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!stepHabitKey) return

    const stepHabit = habits.find(
      h => h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')
    )

    const updateHabits = (totalSteps) => {
      setHabits(prev => prev.map(h => {
        if (h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')) {
          if (h.today_value === totalSteps) return h
          return {
            ...h,
            today_value: totalSteps,
            today_state: totalSteps >= h.goal ? 'completed' : 'none'
          }
        }
        return h
      }))
    }

    const setup = async () => {
      try {
        // 1. Solicitar permisos nativamente (ACTIVITY_RECOGNITION + POST_NOTIFICATIONS)
        try {
          const perms = await StepService.requestPermissions()
          console.log('[PEDOMETER] Permisos:', JSON.stringify(perms))
          if (perms.activity === 'denied') {
            console.warn('[PEDOMETER] Permiso ACTIVITY_RECOGNITION denegado')
          }
        } catch (e) {
          console.error('[PEDOMETER] Error solicitando permisos:', e)
        }

        // 2. Guardar el goal en SharedPreferences para el widget
        if (stepHabit?.goal) {
          try {
            await StepService.setGoal({ goal: stepHabit.goal })
          } catch (e) {
            console.error('[PEDOMETER] Error en setGoal:', e)
          }
        }

        // 3. Arrancar el servicio de fondo
        await StepService.startService()

        // 4. Lectura inicial
        const { steps, date } = await StepService.getStepCount()
        if (date === getLocalDateString() && steps > 0) {
          updateHabits(steps)
        }

        // 5. Polling cada 30s
        pollRef.current = setInterval(async () => {
          try {
            const { steps: s, date: d } = await StepService.getStepCount()
            if (d === getLocalDateString()) {
              updateHabits(s)
            }
          } catch (e) { /* ignore */ }
        }, 30000)
      } catch (e) {
        console.error('[PEDOMETER] StepService no disponible:', e)
      }
    }

    setup()

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [stepHabitKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
