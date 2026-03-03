import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Hook que integra el pedómetro nativo con la lista de hábitos.
 * Hace polling cada 10s y actualiza el today_value de hábitos de tipo 'pasos'.
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!stepHabitKey) return

    let intervalId = null

    const setupPedometer = async () => {
      try {
        const { Pedometer } = await import('@capgo/capacitor-pedometer')

        try {
          await Pedometer.requestPermission?.()
        } catch (e) {
          // Ya concedido o no disponible
        }

        const today = getLocalDateString()
        const STORAGE_KEY = 'pedometer_baseline'

        let baselineData = null
        try {
          const stored = localStorage.getItem(STORAGE_KEY)
          if (stored) baselineData = JSON.parse(stored)
        } catch (e) { /* ignore */ }

        const poll = async () => {
          try {
            const result = await Pedometer.getStepCount()
            const currentCount = result?.count ?? result?.steps ?? 0

            const storedToday = baselineData?.date === today
            if (!storedToday) {
              baselineData = { date: today, baseline: currentCount }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(baselineData))
            }

            const delta = Math.max(0, currentCount - (baselineData?.baseline ?? currentCount))

            setHabits(prev => prev.map(h => {
              if (h.type === 'counter' && h.unit?.toLowerCase().includes('pasos')) {
                if (h.today_value === delta) return h
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

        await poll()
        intervalId = setInterval(poll, 10000)
      } catch (e) {
        console.error('Pedometer not available', e)
      }
    }

    setupPedometer()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [stepHabitKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
