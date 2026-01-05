
import React, { createContext, useContext, useEffect, useState } from 'react'
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

    const signInWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
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
