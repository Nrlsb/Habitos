import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const PlantIllustration = () => (
  <svg width="90" height="100" viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Ground arc */}
    <path d="M12 90 Q45 80 78 90" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    {/* Main stem */}
    <line x1="45" y1="90" x2="45" y2="36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Center top leaf */}
    <path d="M45 36 Q28 20 32 6 Q50 10 45 36" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Right leaf */}
    <path d="M45 52 Q62 38 74 42 Q68 58 45 52" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Left leaf */}
    <path d="M45 64 Q28 52 16 56 Q20 72 45 64" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
)

const ScalesIllustration = () => (
  <svg width="88" height="100" viewBox="0 0 88 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pivot circle */}
    <circle cx="44" cy="13" r="5" stroke="white" strokeWidth="2" fill="none"/>
    {/* Vertical post */}
    <line x1="44" y1="18" x2="44" y2="90" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Horizontal arm */}
    <line x1="8" y1="28" x2="80" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Left arm tip */}
    <line x1="8" y1="28" x2="8" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Right arm tip */}
    <line x1="80" y1="28" x2="80" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Left hanging strings */}
    <line x1="6" y1="28" x2="2" y2="60" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="28" x2="20" y2="60" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Left plate */}
    <path d="M0 60 Q11 55 22 60" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* Right hanging strings */}
    <line x1="78" y1="28" x2="68" y2="52" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="82" y1="28" x2="86" y2="52" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Right plate */}
    <path d="M64 52 Q77 47 88 52" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* Base */}
    <line x1="30" y1="90" x2="58" y2="90" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

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
    <div
      className="min-h-screen bg-black flex flex-col items-center relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
      }}
    >
      {/* Bottom radial green glow */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '45%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(46,204,112,0.38) 0%, rgba(46,204,112,0.10) 45%, transparent 72%)',
        }}
      />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 w-full">
        {/* Illustrations */}
        <div className="flex items-end justify-center gap-3 mb-10 select-none">
          <PlantIllustration />
          <ScalesIllustration />
        </div>

        {/* Headline */}
        <h1 className="text-[2.6rem] font-extrabold text-white text-center leading-[1.15] mb-5 tracking-tight">
          'Domina tus hábitos, asegura tu futuro
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-center text-base leading-relaxed max-w-xs">
          Tu camino hacia el crecimiento personal y la libertad financiera comienza aquí.
        </p>
      </div>

      {/* CTA section */}
      <div className="w-full px-6 space-y-4 relative z-10">
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-primary text-[#0a0a0a] font-bold py-5 rounded-[28px] text-lg flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-70 shadow-lg"
          style={{ boxShadow: '0 0 32px rgba(46,204,112,0.35)' }}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            'Empezar Ahora'
          )}
        </button>

        <p className="text-center text-slate-500 text-sm pb-1">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="text-white underline font-medium"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
