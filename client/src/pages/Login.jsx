
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, CheckCircle, ArrowRight } from 'lucide-react';

const Login = () => {
    const { signInWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">

                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-slate-800 rounded-2xl shadow-lg border border-slate-700 mb-6 group transition-transform hover:scale-105 duration-300">
                        <div className="mr-3 p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:text-indigo-300 transition-colors">
                            <CheckCircle size={32} />
                        </div>
                        <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:text-cyan-300 transition-colors">
                            <Wallet size={32} />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">Bienvenido</h1>
                    <p className="text-slate-400 mb-8">Administra tus hábitos y finanzas en un solo lugar.</p>

                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full bg-white text-slate-900 hover:bg-slate-100 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        )}
                        <span>{isLoading ? 'Iniciando sesión...' : 'Continuar con Google'}</span>
                        {!isLoading && <ArrowRight size={18} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />}
                    </button>

                    <p className="mt-6 text-xs text-slate-500">
                        Al continuar, aceptas nuestros términos de servicio y política de privacidad.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
