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
        // Solicitar permiso ACTIVITY_RECOGNITION antes de arrancar el servicio
        try {
          const { CapacitorPedometer } = await import('@capgo/capacitor-pedometer')
          
          // Solicitar permisos de actividad
          const perm = await CapacitorPedometer.requestPermissions()
          if (perm.activityRecognition === 'denied') {
            console.warn('Pedometer activity permission denied')
          }

          // En Android 13+, las notificaciones requieren permiso explícito para servicios foreground
          if (Capacitor.getPlatform() === 'android') {
            const { LocalNotifications } = await import('@capacitor/local-notifications')
            const notifPerm = await LocalNotifications.requestPermissions()
            if (notifPerm.display === 'denied') {
              console.warn('Notification permission denied - Foreground service may fail')
            }
          }
        } catch (e) {
          console.error('Error requesting permissions', e)
        }

        // Guardar el goal en SharedPreferences para que el widget lo muestre
        if (stepHabit?.goal) {
          await StepService.setGoal({ goal: stepHabit.goal }).catch(() => {})
        }

        // Arrancar el servicio de fondo (si ya está corriendo, no hace nada)
        await StepService.startService()

        // Lectura inicial
        const { steps, date } = await StepService.getStepCount()
        if (date === getLocalDateString() && steps > 0) {
          updateHabits(steps)
        }

        // Polling cada 30s para reflejar los pasos mientras la app está abierta
        pollRef.current = setInterval(async () => {
          try {
            const { steps: s, date: d } = await StepService.getStepCount()
            if (d === getLocalDateString()) {
              updateHabits(s)
            }
          } catch (e) { /* ignore */ }
        }, 30000)
      } catch (e) {
        console.error('StepService not available', e)
      }
    }

    setup()

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      // El servicio sigue corriendo en background intencionalmente
    }
  }, [stepHabitKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
