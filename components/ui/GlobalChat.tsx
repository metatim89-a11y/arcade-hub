// components/ui/GlobalChat.tsx v1.0.0
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from './GlassButton';

interface Message {
    id: string;
    username: string;
    text: string;
    timestamp: number;
    avatar?: string;
}

const GlobalChat: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Mock initial messages
    useEffect(() => {
        setMessages([
            { id: '1', username: 'System', text: 'Welcome to the Global Chat!', timestamp: Date.now() - 100000 },
            { id: '2', username: 'ArcadeBot', text: 'Someone just won big in Crash!', timestamp: Date.now() - 50000 }
        ]);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (!inputText.trim() || !user) return;
        
        const newMessage: Message = {
            id: Date.now().toString(),
            username: user.username,
            text: inputText.trim(),
            timestamp: Date.now(),
            avatar: user.avatar
        };
        
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 bg-yellow-500 text-black font-bold p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 border-2 border-yellow-400"
            >
                💬 <span className="hidden md:inline">Global Chat</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 h-96 bg-gray-900/95 backdrop-blur-lg border-2 border-yellow-400/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-yellow-500/10 p-3 border-b border-yellow-400/20 flex justify-between items-center">
                <span className="text-yellow-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Global Chat
                </span>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-grow p-3 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-yellow-400 text-xs font-bold">{msg.username}</span>
                            <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg text-sm text-gray-200 break-words border border-white/5">
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex gap-2">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-grow bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-yellow-400/50"
                />
                <button 
                    onClick={handleSend}
                    className="bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400 transition-colors"
                >
                    ✈️
                </button>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234, 179, 8, 0.3); border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default GlobalChat;
