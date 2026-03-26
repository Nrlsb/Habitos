import { useEffect, useRef } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

// Puente con StepCounterService (nativo Android)
const StepService = registerPlugin('StepService')

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

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
 * @param {Object} session - Sesión Supabase (para Authorization header)
 * @param {string} API_URL - URL base de la API
 */
export function usePedometer(habits, setHabits, getLocalDateString, session, API_URL) {
  const stepHabitKey = habits
    .filter(h => h.type === 'counter' && h.unit?.toLowerCase().includes('paso'))
    .map(h => h.id)
    .join(',')

  const pollRef = useRef(null)
  const lastSavedRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!stepHabitKey) return

    const stepHabit = habits.find(
      h => h.type === 'counter' && h.unit?.toLowerCase().includes('paso')
    )

    const persistSteps = async (habitId, totalSteps) => {
      if (!session?.access_token || !API_URL) return
      if (lastSavedRef.current === totalSteps) return
      try {
        const response = await fetch(`${API_URL}/api/habits/${habitId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ date: getLocalDateString(), value: totalSteps, state: 'completed' })
        })
        if (response.ok) lastSavedRef.current = totalSteps
      } catch (e) {
        console.error('[PEDOMETER] Error guardando pasos:', e)
      }
    }

    const updateHabits = (totalSteps) => {
      let changedHabitId = null
      setHabits(prev => prev.map(h => {
        if (h.type === 'counter' && h.unit?.toLowerCase().includes('paso')) {
          if (h.today_value === totalSteps) return h
          changedHabitId = h.id
          return {
            ...h,
            today_value: totalSteps,
            today_state: totalSteps >= (h.goal || 0) ? 'completed' : 'none'
          }
        }
        return h
      }))
      if (changedHabitId) {
        persistSteps(changedHabitId, totalSteps)
      }
    }

    const setup = async () => {
      try {
        // 1. Solicitar permisos nativamente (ACTIVITY_RECOGNITION + POST_NOTIFICATIONS)
        try {
          const perms = await withTimeout(StepService.requestPermissions(), 5000)
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
            await withTimeout(StepService.setGoal({ goal: stepHabit.goal }), 5000)
          } catch (e) {
            console.error('[PEDOMETER] Error en setGoal:', e)
          }
        }

        // 3. Arrancar el servicio de fondo (timeout 8s para no colgar la app)
        try {
          await withTimeout(StepService.startService(), 8000)
        } catch (e) {
          console.warn('[PEDOMETER] startService timeout o error, continuando con polling:', e)
        }

        // 4. Lectura inicial
        try {
          const { steps, date } = await withTimeout(StepService.getStepCount(), 5000)
          if (date === getLocalDateString() && steps > 0) {
            updateHabits(steps)
          }
        } catch (e) {
          console.error('[PEDOMETER] Error en lectura inicial:', e)
        }

        // 5. Polling cada 10s (mejorado para evitar fugas)
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(async () => {
          try {
            const { steps: s, date: d } = await withTimeout(StepService.getStepCount(), 5000)
            if (d === getLocalDateString()) {
              updateHabits(s)
            }
          } catch (e) { /* ignore */ }
        }, 10000)
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
