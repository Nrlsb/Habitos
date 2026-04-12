import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { getExpenseInsights } from '../../services/aiApi';
import { toast } from 'sonner';

export default function AIInsightsPanel({ expenses, month, dolarRate, token }) {
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!expenses || expenses.length === 0 || !month || !token) return;

        const loadInsights = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getExpenseInsights(expenses, month, dolarRate, token);
                setInsights(data);
            } catch (err) {
                setError(err.message);
                console.error('Error loading insights:', err);
            } finally {
                setLoading(false);
            }
        };

        loadInsights();
    }, [expenses, month, dolarRate, token]);

    const handleRetry = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getExpenseInsights(expenses, month, dolarRate, token);
            setInsights(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="mt-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                <div className="text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Análisis IA no disponible</span>
                </div>
                <button
                    onClick={handleRetry}
                    className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                    <RefreshCw className="w-3 h-3" /> Reintentar
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mt-8 space-y-3 animate-pulse">
                <div className="h-20 bg-white/5 rounded-2xl" />
                <div className="h-4 bg-white/5 rounded-full w-3/4" />
                <div className="h-4 bg-white/5 rounded-full w-1/2" />
            </div>
        );
    }

    if (!insights) return null;

    const getScoreColor = (score) => {
        if (score >= 70) return 'text-green-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreBg = (score) => {
        if (score >= 70) return 'bg-green-500/10 border-green-500/20';
        if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
        return 'bg-red-500/10 border-red-500/20';
    };

    return (
        <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Análisis Inteligente</h3>
            </div>

            {/* Score Card */}
            <div className={`p-6 rounded-2xl border ${getScoreBg(insights.score)}`}>
                <div className="text-center">
                    <div className={`text-5xl font-bold ${getScoreColor(insights.score)}`}>
                        {insights.score}
                    </div>
                    <p className="text-white/60 text-sm mt-1">Salud Financiera del Mes</p>
                </div>
            </div>

            {/* Insights */}
            {insights.insights && (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <p className="text-white/80 text-sm leading-relaxed">
                        {insights.insights}
                    </p>
                </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/60 uppercase">Recomendaciones</p>
                    <div className="space-y-2">
                        {insights.recommendations.map((rec, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                            >
                                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                <p className="text-white/70 text-sm">{rec}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Anomalies */}
            {insights.anomalies && insights.anomalies.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/60 uppercase">Alertas</p>
                    <div className="space-y-2">
                        {insights.anomalies.map((anom, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20"
                            >
                                <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-orange-300 text-sm font-medium">{anom.description}</p>
                                    <p className="text-orange-200/60 text-xs mt-1">{anom.reason}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
