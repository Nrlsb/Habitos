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

  console.log('[PEDOMETER] Hábitos totales:', habits.length,
    '| stepHabitKey:', stepHabitKey || '(vacío - no se detectó hábito de pasos)',
    '| Hábitos counter:', habits.filter(h => h.type === 'counter').map(h => ({ id: h.id, unit: h.unit, type: h.type }))
  )

  const pollRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PEDOMETER] No es plataforma nativa, saliendo')
      return
    }
    if (!stepHabitKey) {
      console.log('[PEDOMETER] No se encontró hábito de pasos (stepHabitKey vacío), saliendo')
      return
    }

    const stepHabit = habits.find(
      h => h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')
    )
    console.log('[PEDOMETER] Hábito de pasos encontrado:', JSON.stringify({ id: stepHabit?.id, title: stepHabit?.title, unit: stepHabit?.unit, goal: stepHabit?.goal }))

    const updateHabits = (totalSteps) => {
      console.log('[PEDOMETER] updateHabits llamado con totalSteps:', totalSteps)
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
        console.log('[PEDOMETER] === INICIO setup() ===')

        // Solicitar permiso ACTIVITY_RECOGNITION antes de arrancar el servicio
        try {
          console.log('[PEDOMETER] Paso 1: Importando @capgo/capacitor-pedometer...')
          const { CapacitorPedometer } = await import('@capgo/capacitor-pedometer')
          console.log('[PEDOMETER] Paso 1: Import exitoso')

          // Solicitar permisos de actividad
          console.log('[PEDOMETER] Paso 2: Solicitando permisos de actividad...')
          const perm = await CapacitorPedometer.requestPermissions()
          console.log('[PEDOMETER] Paso 2: Resultado permisos actividad:', JSON.stringify(perm))
          if (perm.activityRecognition === 'denied') {
            console.warn('[PEDOMETER] ⚠️ Permiso ACTIVITY_RECOGNITION DENEGADO')
          }

          // En Android 13+, las notificaciones requieren permiso explícito para servicios foreground
          if (Capacitor.getPlatform() === 'android') {
            console.log('[PEDOMETER] Paso 3: Solicitando permisos de notificación...')
            const { LocalNotifications } = await import('@capacitor/local-notifications')
            const notifPerm = await LocalNotifications.requestPermissions()
            console.log('[PEDOMETER] Paso 3: Resultado permisos notificación:', JSON.stringify(notifPerm))
            if (notifPerm.display === 'denied') {
              console.warn('[PEDOMETER] ⚠️ Permiso de notificación DENEGADO - El foreground service puede fallar')
            }
          }
        } catch (e) {
          console.error('[PEDOMETER] ❌ Error solicitando permisos:', e.message, e)
        }

        // Guardar el goal en SharedPreferences para que el widget lo muestre
        console.log('[PEDOMETER] Paso 4: setGoal - stepHabit.goal =', stepHabit?.goal)
        if (stepHabit?.goal) {
          try {
            await StepService.setGoal({ goal: stepHabit.goal })
            console.log('[PEDOMETER] Paso 4: ✅ setGoal exitoso con goal:', stepHabit.goal)
          } catch (e) {
            console.error('[PEDOMETER] ❌ setGoal falló:', e.message, e)
          }
        } else {
          console.warn('[PEDOMETER] ⚠️ stepHabit.goal es falsy, no se llamó setGoal')
        }

        // Arrancar el servicio de fondo (si ya está corriendo, no hace nada)
        console.log('[PEDOMETER] Paso 5: Arrancando StepService.startService()...')
        await StepService.startService()
        console.log('[PEDOMETER] Paso 5: ✅ startService exitoso')

        // Lectura inicial
        console.log('[PEDOMETER] Paso 6: Leyendo StepService.getStepCount()...')
        const { steps, date } = await StepService.getStepCount()
        console.log('[PEDOMETER] Paso 6: ✅ getStepCount → steps:', steps, '| date:', date, '| localDate:', getLocalDateString())
        if (date === getLocalDateString() && steps > 0) {
          console.log('[PEDOMETER] Paso 6: Actualizando hábitos con', steps, 'pasos')
          updateHabits(steps)
        } else {
          console.log('[PEDOMETER] Paso 6: No se actualizó - date match:', date === getLocalDateString(), '| steps > 0:', steps > 0)
        }

        // Polling cada 30s para reflejar los pasos mientras la app está abierta
        console.log('[PEDOMETER] Paso 7: Iniciando polling cada 30s')
        pollRef.current = setInterval(async () => {
          try {
            const { steps: s, date: d } = await StepService.getStepCount()
            console.log('[PEDOMETER] Poll → steps:', s, '| date:', d)
            if (d === getLocalDateString()) {
              updateHabits(s)
            }
          } catch (e) {
            console.error('[PEDOMETER] ❌ Error en polling:', e.message)
          }
        }, 30000)

        console.log('[PEDOMETER] === FIN setup() - Todo OK ===')
      } catch (e) {
        console.error('[PEDOMETER] ❌ StepService no disponible:', e.message, e)
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
