
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { supabase } from '../services/supabaseClient'
import { Toaster, toast } from 'sonner'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Verificar sesión inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Escuchar cambios de sesión
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        // DEBUG: Mostrar configuración de Supabase al iniciar
        const key = supabase.supabaseKey || 'NO_KEY'
        const url = supabase.supabaseUrl || 'NO_URL'
        toast.info(`Config: URL=${url.substring(0, 10)}... Key=${key.substring(0, 5)}...`)

        // Escuchar Deep Links en móvil
        if (Capacitor.isNativePlatform()) {
            App.addListener('appUrlOpen', async (event) => {
                try {
                    // toast.info(`Link recibido: ${event.url.substring(0, 30)}...`)
                    // La URL viene como com.mishabitos.app://google-auth#access_token=...&refresh_token=...
                    const url = new URL(event.url)

                    // Supabase a veces manda los tokens en el hash (#)
                    let params = new URLSearchParams(url.hash.substring(1)) // Quitar el #

                    // Si no están en el hash, probar en search (?)
                    if (!params.get('access_token')) {
                        params = new URLSearchParams(url.search)
                    }

                    const access_token = params.get('access_token')
                    const refresh_token = params.get('refresh_token')

                    toast.info(`Tokens: ${access_token ? 'OK' : 'Falta Access'} | ${refresh_token ? 'OK' : 'Falta Refresh'}`)

                    if (access_token && refresh_token) {
                        const { error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token
                        })
                        if (error) throw error
                        toast.success('¡Sesión establecida!')
                    }
                } catch (error) {
                    const keyStatus = supabase.supabaseKey ? `Key=${supabase.supabaseKey.substring(0, 3)}...` : 'NO_KEY'
                    const urlStatus = supabase.supabaseUrl ? `URL=${supabase.supabaseUrl.substring(8, 15)}...` : 'NO_URL'
                    toast.error(`Error: ${error.message}. ${keyStatus} ${urlStatus}`)
                    console.error('Error procesando deep link:', error)
                }
            })
        }
    }, [])

    const signInWithGoogle = async () => {
        try {
            const redirectTo = Capacitor.isNativePlatform()
                ? 'com.mishabitos.app://google-auth'
                : window.location.origin

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo
                }
            })
            if (error) throw error
        } catch (error) {
            toast.error(`Error al iniciar sesión: ${error.message}`)
            console.error(error)
        }
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            toast.success('Sesión cerrada correctamente')
        } catch (error) {
            toast.error(`Error al cerrar sesión: ${error.message}`)
            console.error(error)
        }
    }

    const value = {
        signInWithGoogle,
        signOut,
        user,
        session,
        loading
    }

    return (
        <AuthContext.Provider value={value}>
            <Toaster position="top-center" richColors />
            {children}
        </AuthContext.Provider>
    )
}
