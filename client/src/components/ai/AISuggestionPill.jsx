import { Sparkles, Check } from 'lucide-react';

export default function AISuggestionPill({ suggestion, loading, onAccept }) {
    if (loading) {
        return (
            <div className="mt-2 flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary animate-spin" />
                <span className="text-white/60">Analizando...</span>
            </div>
        );
    }

    if (!suggestion) return null;

    return (
        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <button
                onClick={onAccept}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors text-sm"
            >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sugerencia: {suggestion}</span>
                <Check className="w-3.5 h-3.5 opacity-60" />
            </button>
        </div>
    );
}
