import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { getHabitCoaching } from '../../services/aiApi';

export default function HabitCoachingBanner({ habits, token }) {
    const [coaching, setCoaching] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!habits || habits.length === 0 || !token || dismissed) return;

        // Check if already dismissed today
        const today = new Date().toISOString().split('T')[0];
        const lastDismissed = localStorage.getItem('coaching_dismissed_date');
        if (lastDismissed === today) {
            setDismissed(true);
            return;
        }

        const loadCoaching = async () => {
            setLoading(true);
            try {
                const data = await getHabitCoaching(habits, token);
                if (data.message) {
                    setCoaching(data);
                }
            } catch (error) {
                console.error('Error loading coaching:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCoaching();
    }, [habits, token, dismissed]);

    const handleDismiss = () => {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('coaching_dismissed_date', today);
        setDismissed(true);
    };

    if (dismissed || !coaching || loading) return null;

    return (
        <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-white/80 text-sm leading-relaxed">
                            {coaching.message}
                        </p>
                        {coaching.highlight && (
                            <p className="text-primary text-xs font-semibold mt-2 uppercase">
                                ✨ {coaching.highlight}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-white/40 hover:text-white/60 transition-colors p-1"
                    aria-label="Cerrar"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
