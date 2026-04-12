import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Trash2 } from 'lucide-react';
import { sendChatMessage } from '../../services/aiApi';

export default function AIChat({ expenses, habits, token }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hola 👋 Soy tu asesor financiero y coach de hábitos. Preguntame cualquier cosa sobre tu dinero o tus objetivos. ¿En qué puedo ayudarte hoy?'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Prepare context summary
            const context = {
                totalGastosMes: expenses?.reduce((a, e) => a + (e.amount || 0), 0) || 0,
                topCategoria: expenses && expenses.length > 0
                    ? Object.entries(
                        expenses.reduce((acc, e) => {
                            acc[e.category || 'General'] = (acc[e.category || 'General'] || 0) + 1;
                            return acc;
                        }, {})
                    ).sort((a, b) => b[1] - a[1])[0][0]
                    : 'N/A',
                habitosActivos: habits?.length || 0,
                rachaMaxima: habits?.reduce((max, h) => Math.max(max, h.currentStreak || 0), 0) || 0
            };

            const response = await sendChatMessage(messages, context, token);
            setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ No pude conectar. Intenta de nuevo en un momento.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([{
            role: 'assistant',
            content: 'Chat reiniciado. ¿En qué puedo ayudarte?'
        }]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] gap-4">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-nav-safe">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs px-4 py-3 rounded-2xl ${
                                msg.role === 'user'
                                    ? 'bg-white/5 text-white/90'
                                    : 'bg-primary/10 text-white border border-primary/20'
                            }`}
                        >
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-3 rounded-2xl">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#131f18] via-[#131f18] to-transparent">
                <div className="max-w-2xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Pregunta algo..."
                        disabled={loading}
                        className="flex-1 bg-white/5 border border-primary/20 rounded-full px-4 py-3 text-white text-sm placeholder:text-white/40 focus:ring-2 focus:ring-primary/40 focus:outline-none disabled:opacity-50"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || loading}
                        className="bg-primary text-[#131f18] rounded-full p-3 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleClearChat}
                        className="text-white/40 hover:text-white/60 p-3 transition-colors"
                        title="Limpiar chat"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
