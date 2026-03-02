
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { supabase } from '../services/supabaseClient'
import { Toaster, toast } from 'sonner'

const WidgetAuth = registerPlugin('WidgetAuth')

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    const processAuthUrl = async (url) => {
        try {
            const parsed = new URL(url)

            // Ignorar deep links del Widget (mishabitos://)
            if (parsed.protocol === 'mishabitos:') {
                console.log('Deep link del widget detectado, ignorando auth check.')
                return
            }

            // Supabase a veces manda los tokens en el hash (#)
            let params = new URLSearchParams(parsed.hash.substring(1))

            // Si no están en el hash, probar en search (?)
            if (!params.get('access_token')) {
                params = new URLSearchParams(parsed.search)
            }

            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')

            if (access_token && refresh_token) {
                const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token
                })
                if (error) throw error
                toast.success('¡Sesión establecida!')
            }
        } catch (error) {
            toast.error(`Error login: ${error.message}`)
            console.error('Error procesando deep link:', error)
        }
    }

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

            if (Capacitor.isNativePlatform() && session?.access_token) {
                // Save token for the widget
                WidgetAuth.saveAuthToken({
                    token: session.access_token,
                    url: supabase.supabaseUrl,
                    key: supabase.supabaseKey
                }).catch(e => console.error('Error saving widget token:', e))
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return

        let appUrlListener = null

        const setupDeepLinks = async () => {
            // Cold start: verificar URL de lanzamiento
            try {
                const launchUrl = await App.getLaunchUrl()
                if (launchUrl?.url) {
                    await processAuthUrl(launchUrl.url)
                }
            } catch (e) {
                console.log('Error checking launch URL', e)
            }

            // Warm start: registrar listener y guardar referencia para cleanup
            appUrlListener = await App.addListener('appUrlOpen', async (event) => {
                await processAuthUrl(event.url)
            })
        }

        setupDeepLinks()

        return () => {
            appUrlListener?.remove()
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
