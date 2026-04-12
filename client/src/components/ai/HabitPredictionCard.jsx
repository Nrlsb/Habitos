import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { getHabitPrediction } from '../../services/aiApi';

export default function HabitPredictionCard({ habit, completions, currentStreak, token }) {
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!habit || !completions || !token) return;

        const loadPrediction = async () => {
            setLoading(true);
            setError(false);
            try {
                const data = await getHabitPrediction(habit, completions, currentStreak, token);
                setPrediction(data);
            } catch (err) {
                console.error('Error loading prediction:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        loadPrediction();
    }, [habit, completions, currentStreak, token]);

    if (error || !prediction) return null;

    const getColorClass = (probability) => {
        if (probability >= 75) return 'text-green-400';
        if (probability >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getBgClass = (probability) => {
        if (probability >= 75) return 'bg-green-500/10 border-green-500/20';
        if (probability >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
        return 'bg-red-500/10 border-red-500/20';
    };

    return (
        <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Predicción de Hoy</h3>
            </div>

            {/* Probability Circle */}
            <div className={`p-8 rounded-2xl border ${getBgClass(prediction.probability)}`}>
                <div className="text-center">
                    <div className={`text-6xl font-bold ${getColorClass(prediction.probability)}`}>
                        {prediction.probability}%
                    </div>
                    <p className="text-white/60 text-sm mt-2">Probabilidad de Completar</p>
                </div>
            </div>

            {/* Insight */}
            {prediction.insight && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-white/70 text-sm">{prediction.insight}</p>
                </div>
            )}

            {/* Tip */}
            {prediction.tip && (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-primary uppercase mb-1">Tip del Día</p>
                            <p className="text-white/80 text-sm">{prediction.tip}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
